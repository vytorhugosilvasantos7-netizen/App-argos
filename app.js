import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const config = window.ARGOS_CONFIG ?? {};
const metaInstagramFunctionUrl = config.supabaseUrl
  ? `${String(config.supabaseUrl).replace(/\/$/, "")}/functions/v1/meta-instagram`
  : "";
const loginScreen = document.querySelector("#login-screen");
const appShell = document.querySelector("#app-shell");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const configNotice = document.querySelector("#config-notice");
const appStatus = document.querySelector("#app-status");
const clientForm = document.querySelector("#client-form");
const entryForm = document.querySelector("#entry-form");
const marketingForm = document.querySelector("#marketing-form");
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
let supabase;
let clients = [];
let entries = [];
let marketingPosts = [];

const today = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const amountValue = (value) => Number(value) || 0;
const formatCurrency = (value) => currency.format(value);
const formatDate = (value) => value ? dateFormat.format(new Date(`${value}T00:00:00Z`)) : "—";
const statusLabels = { pending: "Aguardando início", in_progress: "Em andamento", finishing: "Finalização", completed: "Concluído" };
const statusLabel = (status) => statusLabels[status] ?? status;
const marketingStatusLabels = { idea: "Ideia", draft: "Rascunho", planned: "Planejado", published: "Publicado" };
const marketingDateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const paidEntries = (items) => items.filter((entry) => entry.payment_status === "paid");
const sumKind = (items, kind) => items.filter((entry) => entry.kind === kind).reduce((sum, entry) => sum + amountValue(entry.amount), 0);

function showNotice(message, isError = false) {
  appStatus.textContent = message;
  appStatus.classList.toggle("notice-error", isError);
  appStatus.hidden = !message;
}

function setAuthView(user) {
  loginScreen.hidden = Boolean(user);
  appShell.hidden = !user;
  if (user) {
    document.querySelector("#user-email").textContent = user.email || "Administração";
    document.querySelector("#user-avatar").textContent = (user.email || "A").charAt(0).toUpperCase();
  }
}

function getMonthlyEntries() {
  const month = today().slice(0, 7);
  return entries.filter((entry) => entry.occurred_on.startsWith(month));
}

function renderOverview() {
  const inProgress = clients.filter((client) => client.status === "in_progress").length;
  const completed = clients.filter((client) => client.status === "completed").length;
  const finishing = clients.filter((client) => client.status === "finishing").length;
  const paid = paidEntries(entries);
  const income = sumKind(paid, "income");
  const expenses = sumKind(paid, "expense");
  const monthly = paidEntries(getMonthlyEntries());
  const monthIncome = sumKind(monthly, "income");
  const monthExpenses = sumKind(monthly, "expense");

  document.querySelector("#metric-clients").textContent = String(clients.length);
  document.querySelector("#metric-progress").textContent = String(inProgress);
  document.querySelector("#metric-finishing").textContent = String(finishing);
  document.querySelector("#metric-completed").textContent = String(completed);
  document.querySelector("#metric-profit").textContent = formatCurrency(income - expenses);
  document.querySelector("#month-income").textContent = formatCurrency(monthIncome);
  document.querySelector("#month-expenses").textContent = formatCurrency(monthExpenses);
  document.querySelector("#month-profit").textContent = formatCurrency(monthIncome - monthExpenses);

  const recent = document.querySelector("#recent-clients");
  recent.replaceChildren(...clients.slice(0, 5).map((client) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = client.name;
    const date = document.createElement("span");
    date.textContent = `Desde ${formatDate(client.created_at.slice(0, 10))}`;
    name.append(strong, date);
    nameCell.append(name);
    const serviceCell = document.createElement("td");
    serviceCell.textContent = client.service;
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill is-${client.status}`;
    badge.textContent = statusLabel(client.status);
    statusCell.append(badge);
    row.append(nameCell, serviceCell, statusCell);
    return row;
  }));
  document.querySelector("#recent-empty").hidden = clients.length > 0;
}

function renderClients() {
  const query = document.querySelector("#client-search").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = clients.filter((client) => `${client.name} ${client.service}`.toLocaleLowerCase("pt-BR").includes(query));
  const table = document.querySelector("#clients-table");
  table.replaceChildren(...filtered.map((client) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = client.name;
    const since = document.createElement("span");
    since.textContent = `Cliente desde ${formatDate(client.created_at.slice(0, 10))}`;
    name.append(strong, since);
    nameCell.append(name);
    const serviceCell = document.createElement("td");
    serviceCell.textContent = client.service;
    const dueCell = document.createElement("td");
    dueCell.textContent = formatDate(client.due_date);
    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `status-pill is-${client.status}`;
    badge.textContent = statusLabel(client.status);
    statusCell.append(badge);
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.textContent = "Gerenciar projeto";
    edit.addEventListener("click", () => openClientDialog(client));
    const portal = document.createElement("a");
    portal.className = "row-action";
    portal.textContent = "Abrir portal";
    portal.href = getPortalUrl(client.portal_token);
    portal.target = "_blank";
    portal.rel = "noopener noreferrer";
    const copyLink = document.createElement("button");
    copyLink.className = "row-action";
    copyLink.type = "button";
    copyLink.textContent = "Copiar link";
    copyLink.addEventListener("click", () => copyPortalLink(client.portal_token));
    const remove = document.createElement("button");
    remove.className = "row-action is-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => deleteClient(client));
    actions.append(edit, portal, copyLink, remove);
    actionCell.append(actions);
    row.append(nameCell, serviceCell, dueCell, statusCell, actionCell);
    return row;
  }));
  document.querySelector("#client-count-label").textContent = `${clients.length} ${clients.length === 1 ? "cliente cadastrado" : "clientes cadastrados"}`;
  document.querySelector("#clients-empty").hidden = filtered.length > 0;
}

function renderFinance() {
  const paid = paidEntries(entries);
  const income = sumKind(paid, "income");
  const expenses = sumKind(paid, "expense");
  document.querySelector("#total-income").textContent = formatCurrency(income);
  document.querySelector("#total-pending").textContent = formatCurrency(sumKind(entries.filter((entry) => entry.payment_status === "pending"), "income"));
  document.querySelector("#total-expenses").textContent = formatCurrency(expenses);
  document.querySelector("#total-profit").textContent = formatCurrency(income - expenses);
  const filter = document.querySelector("#finance-filter").value;
  const filtered = entries.filter((entry) => filter === "all" || entry.kind === filter);
  const table = document.querySelector("#finance-table");
  table.replaceChildren(...filtered.map((entry) => {
    const row = document.createElement("tr");
    const descriptionCell = document.createElement("td");
    const description = document.createElement("div");
    description.className = "client-cell";
    const strong = document.createElement("strong");
    strong.textContent = entry.description;
    description.append(strong);
    descriptionCell.append(description);
    const projectCell = document.createElement("td");
    const project = clients.find((client) => client.id === entry.client_id);
    projectCell.textContent = project ? `${project.name} · ${project.service}` : "—";
    const kindCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `type-pill is-${entry.kind}`;
    badge.textContent = entry.kind === "income" ? "Receita" : "Despesa";
    kindCell.append(badge);
    const paymentCell = document.createElement("td");
    const paymentBadge = document.createElement("span");
    paymentBadge.className = `status-pill is-${entry.payment_status === "paid" ? "completed" : "pending"}`;
    paymentBadge.textContent = entry.payment_status === "paid" ? "Pago" : "Pendente";
    paymentCell.append(paymentBadge);
    const dateCell = document.createElement("td");
    dateCell.textContent = formatDate(entry.occurred_on);
    const amountCell = document.createElement("td");
    amountCell.textContent = formatCurrency(amountValue(entry.amount));
    const actionCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openEntryDialog(entry));
    const remove = document.createElement("button");
    remove.className = "row-action is-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => deleteEntry(entry));
    actions.append(edit, remove);
    actionCell.append(actions);
    row.append(descriptionCell, projectCell, kindCell, paymentCell, dateCell, amountCell, actionCell);
    return row;
  }));
  document.querySelector("#finance-empty").hidden = filtered.length > 0;
}

function renderAll() {
  renderOverview();
  renderClients();
  renderFinance();
  renderMarketing();
}

function formatMarketingDate(value) {
  if (!value) return "Sem data planejada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data inválida" : marketingDateFormat.format(date);
}

function toLocalDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function renderMarketing() {
  const ideasAndDrafts = marketingPosts.filter((post) => ["idea", "draft"].includes(post.status)).length;
  const planned = marketingPosts.filter((post) => post.status === "planned").length;
  const published = marketingPosts.filter((post) => post.status === "published").length;
  const reach = marketingPosts.reduce((total, post) => total + Number(post.reach || 0), 0);
  document.querySelector("#marketing-drafts").textContent = String(ideasAndDrafts);
  document.querySelector("#marketing-planned").textContent = String(planned);
  document.querySelector("#marketing-published").textContent = String(published);
  document.querySelector("#marketing-reach").textContent = new Intl.NumberFormat("pt-BR").format(reach);

  const table = document.querySelector("#marketing-table");
  const sortedPosts = [...marketingPosts].sort((left, right) => {
    const leftDate = left.scheduled_at ? new Date(left.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDate = right.scheduled_at ? new Date(right.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDate - rightDate || new Date(right.created_at) - new Date(left.created_at);
  });
  table.replaceChildren(...sortedPosts.map((post) => {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    const date = document.createElement("div");
    date.className = "client-cell";
    const status = document.createElement("span");
    status.className = `marketing-status is-${post.status}`;
    status.textContent = marketingStatusLabels[post.status] ?? "Ideia";
    const dateText = document.createElement("span");
    dateText.textContent = formatMarketingDate(post.scheduled_at);
    date.append(status, dateText);
    dateCell.append(date);

    const contentCell = document.createElement("td");
    const content = document.createElement("div");
    content.className = "marketing-cell";
    const title = document.createElement("strong");
    title.textContent = post.title;
    const caption = document.createElement("span");
    caption.textContent = post.caption || post.hashtags || "Legenda ainda não escrita.";
    content.append(title, caption);
    contentCell.append(content);

    const mediaCell = document.createElement("td");
    if (post.media_url) {
      const mediaLink = document.createElement("a");
      mediaLink.className = "row-action";
      mediaLink.href = post.media_url;
      mediaLink.target = "_blank";
      mediaLink.rel = "noopener noreferrer";
      mediaLink.textContent = "Abrir arquivo ↗";
      mediaCell.append(mediaLink);
    } else {
      mediaCell.textContent = "—";
    }

    const reachCell = document.createElement("td");
    reachCell.textContent = new Intl.NumberFormat("pt-BR").format(post.reach || 0);
    const engagementCell = document.createElement("td");
    const engagement = document.createElement("div");
    engagement.className = "client-cell";
    const engagementTotal = document.createElement("strong");
    engagementTotal.textContent = new Intl.NumberFormat("pt-BR").format(
      Number(post.likes || 0) + Number(post.comments || 0) + Number(post.shares || 0),
    );
    const engagementDetails = document.createElement("span");
    engagementDetails.textContent = `${post.likes || 0} curtidas · ${post.comments || 0} comentários · ${post.shares || 0} compartilhamentos`;
    engagement.append(engagementTotal, engagementDetails);
    engagementCell.append(engagement);

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const edit = document.createElement("button");
    edit.className = "row-action";
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openMarketingDialog(post));
    const remove = document.createElement("button");
    remove.className = "row-action is-delete";
    remove.type = "button";
    remove.textContent = "Excluir";
    remove.addEventListener("click", () => void deleteMarketingPost(post));
    actions.append(edit, remove);
    actionsCell.append(actions);
    row.append(dateCell, contentCell, mediaCell, reachCell, engagementCell, actionsCell);
    return row;
  }));
  const hasPosts = marketingPosts.length > 0;
  document.querySelector("#marketing-empty").hidden = hasPosts;
  document.querySelector("#marketing-table-wrap").hidden = !hasPosts;
}

async function loadMarketingPosts() {
  const status = document.querySelector("#marketing-load-status");
  const { data, error } = await supabase
    .from("marketing_posts")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    marketingPosts = [];
    renderMarketing();
    status.textContent = `Não foi possível carregar o conteúdo de marketing. Confira se a migration 20261115000000_create_marketing_posts.sql foi aplicada. Detalhe: ${error.message}`;
    status.hidden = false;
    return false;
  }
  marketingPosts = data;
  status.hidden = true;
  renderMarketing();
  return true;
}

async function callMetaInstagramFunction(action, method = "GET") {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Não foi possível validar a sessão: ${error.message}`);
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão expirou. Entre novamente no painel.");

  const url = new URL(metaInstagramFunctionUrl);
  if (method === "GET") url.searchParams.set("action", action);
  const response = await fetch(url, {
    method,
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "POST" ? { body: JSON.stringify({ action }) } : {}),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("A função de conexão retornou uma resposta inválida.");
  }
  if (!response.ok) throw new Error(payload.error || "Não foi possível comunicar com a função de conexão.");
  return payload;
}

async function loadMarketingConnection() {
  const notice = document.querySelector(".marketing-connection-notice");
  const errorNotice = document.querySelector("#marketing-connection-error");
  const title = document.querySelector("#marketing-connection-title");
  const description = document.querySelector("#marketing-connection-description");
  const connectButton = document.querySelector("#connect-instagram");
  const disconnectButton = document.querySelector("#disconnect-instagram");
  const redirectUri = document.querySelector("#meta-redirect-uri");

  if (!metaInstagramFunctionUrl) {
    errorNotice.textContent = "Configure a URL do Supabase para habilitar a conexão com a Meta.";
    errorNotice.hidden = false;
    return;
  }

  redirectUri.textContent = metaInstagramFunctionUrl;
  try {
    const result = await callMetaInstagramFunction("status");
    errorNotice.hidden = true;
    if (result.connected && result.connection) {
      notice.classList.add("is-connected");
      title.textContent = `Instagram conectado: @${result.connection.instagram_username}`;
      description.textContent = `Página ${result.connection.page_name} autorizada. A conexão está protegida no servidor; a publicação automática ainda precisa ser concluída.`;
      connectButton.hidden = true;
      disconnectButton.hidden = false;
    } else {
      notice.classList.remove("is-connected");
      title.textContent = "Instagram ainda não conectado.";
      description.textContent = "Cadastre o Redirect URI da Meta e conecte a conta profissional da Argos para autorizar a integração.";
      connectButton.hidden = false;
      disconnectButton.hidden = true;
    }
  } catch (error) {
    notice.classList.remove("is-connected");
    title.textContent = "Conexão com a Meta ainda não configurada.";
    description.textContent = "Aplique a migration e publique a função meta-instagram no Supabase antes de conectar a conta.";
    errorNotice.textContent = `Não foi possível verificar a conexão: ${error.message}`;
    errorNotice.hidden = false;
    connectButton.hidden = false;
    disconnectButton.hidden = true;
  }
}

function openMarketingDialog(post = null) {
  marketingForm.reset();
  document.querySelector("#marketing-id").value = post?.id ?? "";
  document.querySelector("#marketing-title").value = post?.title ?? "";
  document.querySelector("#marketing-caption").value = post?.caption ?? "";
  document.querySelector("#marketing-hashtags").value = post?.hashtags ?? "";
  document.querySelector("#marketing-media-url").value = post?.media_url ?? "";
  document.querySelector("#marketing-post-status").value = post?.status ?? "idea";
  document.querySelector("#marketing-scheduled-at").value = toLocalDateTimeInput(post?.scheduled_at);
  document.querySelector("#marketing-reach-input").value = String(post?.reach ?? 0);
  document.querySelector("#marketing-likes-input").value = String(post?.likes ?? 0);
  document.querySelector("#marketing-comments-input").value = String(post?.comments ?? 0);
  document.querySelector("#marketing-shares-input").value = String(post?.shares ?? 0);
  document.querySelector("#marketing-dialog-title").textContent = post ? "Editar conteúdo" : "Novo conteúdo";
  document.querySelector("#marketing-form-status").textContent = "";
  document.querySelector("#marketing-dialog").showModal();
}

async function deleteMarketingPost(post) {
  await deleteRecord("marketing_posts", post, `Excluir o conteúdo "${post.title}"?`);
}

async function loadData() {
  showNotice("");
  const access = await supabase.rpc("is_argos_admin");
  if (access.error || !access.data) {
    clients = [];
    entries = [];
    marketingPosts = [];
    renderAll();
    showNotice(access.error ? `Não foi possível verificar o acesso: ${access.error.message}` : "Esta conta não está autorizada como administradora. Peça a inclusão dela em argos_admins no Supabase.", true);
    return;
  }
  const [clientsResult, entriesResult] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }),
    supabase.from("finance_entries").select("*").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (clientsResult.error || entriesResult.error) {
    const error = clientsResult.error || entriesResult.error;
    showNotice(`Não foi possível carregar os dados: ${error.message}`, true);
    return;
  }
  clients = clientsResult.data;
  entries = entriesResult.data;
  renderAll();
  await loadMarketingPosts();
  await loadMarketingConnection();
  const callbackUrl = new URL(window.location.href);
  const metaResult = callbackUrl.searchParams.get("meta");
  if (metaResult) {
    callbackUrl.searchParams.delete("meta");
    window.history.replaceState(null, "", callbackUrl);
    showNotice(
      metaResult === "connected" ? "Instagram conectado com sucesso." : "A conexão com o Instagram não foi concluída.",
      metaResult !== "connected",
    );
  }
}

function openClientDialog(client = null) {
  clientForm.reset();
  renderProjectSteps(client?.project_steps ?? []);
  document.querySelector("#client-id").value = client?.id ?? "";
  document.querySelector("#client-name").value = client?.name ?? "";
  document.querySelector("#client-service").value = client?.service ?? "";
  document.querySelector("#client-status").value = client?.status ?? "in_progress";
  document.querySelector("#client-due-date").value = client?.due_date ?? "";
  document.querySelector("#client-description").value = client?.project_description ?? "";
  document.querySelector("#client-progress").value = String(client?.progress ?? 0);
  document.querySelector("#client-progress-output").value = `${client?.progress ?? 0}% concluído · ${100 - (client?.progress ?? 0)}% restante`;
  document.querySelector("#client-preview-desktop").value = client?.preview_desktop_url ?? "";
  document.querySelector("#client-preview-mobile").value = client?.preview_mobile_url ?? "";
  document.querySelector("#client-included-items").value = (client?.included_items ?? []).join("\n");
  document.querySelector("#client-dialog-title").textContent = client ? "Gerenciar projeto" : "Novo cliente";
  document.querySelector("#client-form-status").textContent = "";
  const portalLinkRow = document.querySelector("#portal-link-row");
  portalLinkRow.hidden = !client;
  portalLinkRow.dataset.portalToken = client?.portal_token ?? "";
  document.querySelector("#client-dialog").showModal();
}

function renderProjectSteps(steps) {
  const container = document.querySelector("#project-steps-fields");
  container.replaceChildren(...steps.map((step) => createProjectStepRow(step)));
}

function createProjectStepRow(step = {}) {
  const row = document.createElement("div");
  row.className = "step-editor-row";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "Etapa";
  const titleInput = document.createElement("input");
  titleInput.className = "step-title";
  titleInput.type = "text";
  titleInput.maxLength = 120;
  titleInput.placeholder = "Ex.: Desenvolvimento do site";
  titleInput.value = step.title ?? "";
  titleLabel.append(titleInput);

  const detailLabel = document.createElement("label");
  detailLabel.textContent = "Detalhe";
  const detailInput = document.createElement("input");
  detailInput.className = "step-description";
  detailInput.type = "text";
  detailInput.maxLength = 240;
  detailInput.placeholder = "O que está sendo feito nesta etapa";
  detailInput.value = step.description ?? "";
  detailLabel.append(detailInput);

  const statusLabel = document.createElement("label");
  statusLabel.textContent = "Situação";
  const statusSelect = document.createElement("select");
  statusSelect.className = "step-status";
  [
    ["pending", "Pendente"],
    ["current", "Em andamento"],
    ["completed", "Concluída"],
  ].forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    statusSelect.append(option);
  });
  statusSelect.value = ["pending", "current", "completed"].includes(step.status) ? step.status : "pending";
  statusLabel.append(statusSelect);

  const remove = document.createElement("button");
  remove.className = "row-action is-delete remove-step";
  remove.type = "button";
  remove.textContent = "Remover etapa";
  remove.addEventListener("click", () => row.remove());
  row.append(titleLabel, detailLabel, statusLabel, remove);
  return row;
}

function getProjectSteps() {
  return [...document.querySelectorAll("#project-steps-fields .step-editor-row")]
    .map((row) => ({
      title: row.querySelector(".step-title").value.trim(),
      description: row.querySelector(".step-description").value.trim(),
      status: row.querySelector(".step-status").value,
    }))
    .filter((step) => step.title);
}

function getPortalUrl(token) {
  const url = new URL(config.clientPortalUrl);
  url.searchParams.set("token", token);
  return url.href;
}

async function copyPortalLink(token) {
  try {
    await navigator.clipboard.writeText(getPortalUrl(token));
    showNotice("Link privado do portal copiado.");
  } catch (error) {
    showNotice(`Não foi possível copiar o link: ${error.message}`, true);
  }
}

function openEntryDialog(entry = null) {
  entryForm.reset();
  const projectSelect = document.querySelector("#entry-client");
  projectSelect.replaceChildren(new Option("Sem projeto vinculado", ""));
  clients.forEach((client) => projectSelect.add(new Option(`${client.name} · ${client.service}`, client.id)));
  projectSelect.value = entry?.client_id ?? "";
  document.querySelector("#entry-id").value = entry?.id ?? "";
  document.querySelector("#entry-description").value = entry?.description ?? "";
  document.querySelector("#entry-kind").value = entry?.kind ?? "income";
  document.querySelector("#entry-payment-status").value = entry?.payment_status ?? "paid";
  document.querySelector("#entry-amount").value = entry?.amount ?? "";
  document.querySelector("#entry-date").value = entry?.occurred_on ?? today();
  document.querySelector("#entry-dialog-title").textContent = entry ? "Editar lançamento" : "Novo lançamento";
  document.querySelector("#entry-form-status").textContent = "";
  document.querySelector("#entry-dialog").showModal();
}

async function saveForm(table, statusElement, values) {
  const id = values.id;
  delete values.id;
  const { error } = id
    ? await supabase.from(table).update(values).eq("id", id)
    : await supabase.from(table).insert(values);
  if (error) {
    statusElement.textContent = `Não foi possível salvar: ${error.message}`;
    return false;
  }
  return true;
}

async function deleteRecord(table, record, message) {
  if (!window.confirm(message)) return;
  const { error } = await supabase.from(table).delete().eq("id", record.id);
  if (error) {
    showNotice(`Não foi possível excluir: ${error.message}`, true);
    return;
  }
  showNotice("");
  await loadData();
}

async function deleteClient(client) {
  await deleteRecord("clients", client, `Excluir o cadastro de ${client.name}?`);
}

async function deleteEntry(entry) {
  await deleteRecord("finance_entries", entry, `Excluir o lançamento "${entry.description}"?`);
}

function setCurrentView(viewName) {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const isActive = panel.dataset.panel === viewName;
    panel.hidden = !isActive;
    panel.classList.toggle("is-visible", isActive);
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
}

function configureNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setCurrentView(button.dataset.view));
  });
  document.querySelectorAll("[data-go-view]").forEach((button) => {
    button.addEventListener("click", () => setCurrentView(button.dataset.goView));
  });
  document.querySelectorAll("[data-open-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.openDialog === "client-dialog") openClientDialog();
      if (button.dataset.openDialog === "entry-dialog") openEntryDialog();
      if (button.dataset.openDialog === "marketing-dialog") openMarketingDialog();
    });
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelector("#add-project-step").addEventListener("click", () => {
    document.querySelector("#project-steps-fields").append(createProjectStepRow());
  });
}

document.querySelector("#topbar-date").textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
configureNavigation();
document.querySelector("#client-search").addEventListener("input", renderClients);
document.querySelector("#finance-filter").addEventListener("change", renderFinance);
document.querySelector("#client-progress").addEventListener("input", (event) => {
  const progress = Number(event.currentTarget.value);
  document.querySelector("#client-progress-output").value = `${progress}% concluído · ${100 - progress}% restante`;
});
document.querySelector("#copy-portal-link").addEventListener("click", () => {
  void copyPortalLink(document.querySelector("#portal-link-row").dataset.portalToken);
});
document.querySelector("#connect-instagram").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const result = await callMetaInstagramFunction("connect", "POST");
    const authorizeUrl = new URL(result.authorizeUrl);
    if (authorizeUrl.protocol !== "https:" || authorizeUrl.hostname !== "www.facebook.com") {
      throw new Error("A Meta retornou um endereço de autorização inválido.");
    }
    window.location.assign(authorizeUrl.href);
  } catch (error) {
    const notice = document.querySelector("#marketing-connection-error");
    notice.textContent = `Não foi possível iniciar a conexão: ${error.message}`;
    notice.hidden = false;
    button.disabled = false;
  }
});
document.querySelector("#disconnect-instagram").addEventListener("click", async (event) => {
  if (!window.confirm("Desconectar a conta profissional da Argos deste painel?")) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await callMetaInstagramFunction("disconnect", "POST");
    await loadMarketingConnection();
  } catch (error) {
    const notice = document.querySelector("#marketing-connection-error");
    notice.textContent = `Não foi possível desconectar: ${error.message}`;
    notice.hidden = false;
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#copy-meta-redirect-uri").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.querySelector("#meta-redirect-uri").textContent);
    showNotice("Redirect URI da Meta copiado.");
  } catch (error) {
    showNotice(`Não foi possível copiar o Redirect URI: ${error.message}`, true);
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  const button = loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  const formData = new FormData(loginForm);
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")).trim(),
    password: String(formData.get("password")),
  });
  button.disabled = false;
  if (error) loginStatus.textContent = `Não foi possível entrar: ${error.message}`;
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) showNotice(`Não foi possível sair da conta: ${error.message}`, true);
});

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!clientForm.reportValidity()) return;
  const formData = new FormData(clientForm);
  const values = {
    id: String(formData.get("id") || ""),
    name: String(formData.get("name")).trim(),
    service: String(formData.get("service")).trim(),
    status: String(formData.get("status")),
    due_date: String(formData.get("due_date")) || null,
    project_description: String(formData.get("project_description")).trim(),
    progress: Number(formData.get("progress")),
    preview_desktop_url: String(formData.get("preview_desktop_url")).trim() || null,
    preview_mobile_url: String(formData.get("preview_mobile_url")).trim() || null,
    included_items: String(formData.get("included_items")).split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    project_steps: getProjectSteps(),
  };
  for (const field of ["preview_desktop_url", "preview_mobile_url"]) {
    const value = values[field];
    if (!value) continue;
    try {
      if (!["http:", "https:"].includes(new URL(value).protocol)) throw new Error();
    } catch {
      document.querySelector("#client-form-status").textContent = "As prévias devem usar um endereço válido com http:// ou https://.";
      document.querySelector(`#client-${field.replaceAll("_", "-")}`).focus();
      return;
    }
  }
  const statusElement = document.querySelector("#client-form-status");
  const saved = await saveForm("clients", statusElement, values);
  if (!saved) return;
  document.querySelector("#client-dialog").close();
  showNotice("");
  await loadData();
});

marketingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!marketingForm.reportValidity()) return;
  const formData = new FormData(marketingForm);
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status"));
  const localSchedule = String(formData.get("scheduled_at") || "");
  const statusElement = document.querySelector("#marketing-form-status");
  if (status === "planned" && !localSchedule) {
    statusElement.textContent = "Defina a data e o horário para planejar a publicação.";
    document.querySelector("#marketing-scheduled-at").focus();
    return;
  }

  const mediaValue = String(formData.get("media_url") || "").trim();
  let mediaUrl = null;
  if (mediaValue) {
    try {
      const parsedUrl = new URL(mediaValue);
      if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) throw new Error();
      mediaUrl = parsedUrl.href;
    } catch {
      statusElement.textContent = "O link da imagem ou vídeo deve ser um endereço HTTPS público e válido.";
      document.querySelector("#marketing-media-url").focus();
      return;
    }
  }

  const countFields = ["reach", "likes", "comments", "shares"];
  const counts = Object.fromEntries(countFields.map((field) => [field, Number(formData.get(field) || 0)]));
  if (Object.values(counts).some((value) => !Number.isSafeInteger(value) || value < 0 || value > 2147483647)) {
    statusElement.textContent = "As métricas devem ser números inteiros positivos.";
    return;
  }

  const existingPost = marketingPosts.find((post) => post.id === id);
  const values = {
    id,
    title: String(formData.get("title")).trim(),
    caption: String(formData.get("caption") || "").trim(),
    hashtags: String(formData.get("hashtags") || "").trim(),
    media_url: mediaUrl,
    status,
    scheduled_at: localSchedule ? new Date(localSchedule).toISOString() : null,
    published_at: status === "published" ? existingPost?.published_at ?? new Date().toISOString() : null,
    ...counts,
    updated_at: new Date().toISOString(),
  };
  const saved = await saveForm("marketing_posts", statusElement, values);
  if (!saved) return;
  document.querySelector("#marketing-dialog").close();
  showNotice("");
  await loadMarketingPosts();
});

entryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!entryForm.reportValidity()) return;
  const formData = new FormData(entryForm);
  const values = {
    id: String(formData.get("id") || ""),
    description: String(formData.get("description")).trim(),
    kind: String(formData.get("kind")),
    client_id: String(formData.get("client_id")) || null,
    payment_status: String(formData.get("payment_status")),
    amount: Number(formData.get("amount")),
    occurred_on: String(formData.get("occurred_on")),
  };
  const statusElement = document.querySelector("#entry-form-status");
  const saved = await saveForm("finance_entries", statusElement, values);
  if (!saved) return;
  document.querySelector("#entry-dialog").close();
  showNotice("");
  await loadData();
});

if (!config.supabaseUrl || !config.supabaseAnonKey) {
  configNotice.hidden = false;
  loginForm.querySelectorAll("input, button").forEach((element) => { element.disabled = true; });
} else {
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  supabase.auth.onAuthStateChange((_event, session) => {
    setAuthView(session?.user);
    if (session?.user) window.setTimeout(() => void loadData(), 0);
    else {
      clients = [];
      entries = [];
      marketingPosts = [];
      renderAll();
      loginForm.reset();
      loginStatus.textContent = "";
    }
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      loginStatus.textContent = `Não foi possível verificar a sessão: ${error.message}`;
      return;
    }
    setAuthView(data.session?.user);
    if (data.session?.user) void loadData();
  });
}
