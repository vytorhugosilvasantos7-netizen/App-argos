# Painel administrativo Argos

Painel web para acompanhar clientes, status dos projetos e lucro por meio de lançamentos de receitas e despesas. O acesso é feito com Supabase Auth; o cadastro de usuários fica desativado na interface e deve ser feito pelo administrador no painel Supabase.

## Configuração do projeto Supabase

O painel administrativo e o portal de clientes usam o mesmo projeto Supabase, mas podem ser publicados separadamente. A configuração do painel fica no `config.js` desta pasta; a configuração do portal fica em `src/js/config.js` no repositório do site.

1. No `config.js` do painel, confira a URL do projeto Supabase, a chave pública `anon` ou `publishable` e o endereço completo `clientPortalUrl` da página do cliente. No repositório do site, configure a mesma URL e chave pública em `src/js/config.js`.
2. No **SQL Editor**, execute, nesta ordem, os arquivos de `supabase/migrations/` do projeto:
   - `20261109000000_create_form_rate_limits.sql`
   - `20261111000000_create_admin_dashboard.sql`
   - `20261112000000_create_client_portal.sql`
   - `20261113000000_admin_management.sql`
   - `20261115000000_create_marketing_posts.sql`
   - `20261118000000_meta_instagram_oauth.sql`
3. Em **Authentication → Users**, crie o usuário administrativo. Não habilite cadastro público para este painel.
4. No repositório separado do app, publique a pasta `app-argus` como raiz do projeto na Vercel. O portal individual deve estar publicado separadamente no endereço definido em `clientPortalUrl`. O portal deve ser a versão integrada ao Supabase, não apenas a demonstração.

Alternativamente, para aplicar as migrations pelo CLI contra o projeto hospedado, instale o Supabase CLI, autentique com `supabase login` e, na raiz `Argos`, execute `supabase link --project-ref fnbhulysivjphxjupvul` e `supabase db push`. Isso não requer iniciar a stack local com Docker.

Use somente a chave pública do projeto no navegador. Nunca coloque uma chave `service_role` no `config.js` do painel nem no `src/js/config.js` do site. O portal usa um link privado individual; qualquer pessoa com esse link poderá ver somente o projeto associado a ele. Não inclua informações financeiras no portal.

### Conectar o Instagram profissional

A migration `20261118000000_meta_instagram_oauth.sql` e a Edge Function `meta-instagram` guardam o token criptografado no servidor. A URL de callback para cadastrar em **Facebook Login for Business → Settings → Valid OAuth Redirect URIs** é:

```text
https://fnbhulysivjphxjupvul.supabase.co/functions/v1/meta-instagram
```

No Supabase, publique as migrations e a função. Em **Edge Functions → Secrets**, configure `META_APP_ID` com o ID público `3824811700999928`, `META_APP_SECRET` com o segredo obtido no painel do app Meta, `META_TOKEN_ENCRYPTION_KEY` com uma chave privada Base64 de 32 bytes, `META_GRAPH_API_VERSION` como `v27.0`, `ARGOS_ADMIN_URL` como `https://app-argos-livid.vercel.app/` e `ARGOS_ADMIN_ORIGINS` como `https://app-argos-livid.vercel.app`. `https://app-argos.vercel.app/` é o site público, não o painel administrativo. O Supabase fornece `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ao runtime da função; não os copie para o site.

Gere a chave de criptografia localmente no PowerShell e cole o resultado diretamente no campo de secret do Supabase. Não a envie por chat nem a salve no repositório:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Na raiz `Argos`, depois de vincular o projeto com `supabase link --project-ref fnbhulysivjphxjupvul`, publique com `supabase db push` e `supabase functions deploy meta-instagram`. Em seguida, abra **Marketing → Conectar Instagram** no painel. O app Meta deve ter o Facebook Login for Business e as permissões necessárias aprovadas para a conta que fará a conexão. Consulte o [guia oficial de início do Instagram API com Facebook Login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/get-started) e o [guia oficial de publicação](https://developers.facebook.com/documentation/instagram-platform/content-publishing).

Esta etapa conecta e protege a conta; ainda não agenda nem publica conteúdo automaticamente e não sincroniza métricas.

### Autorizar os dois administradores

Após executar a migration `20261113000000_admin_management.sql`, somente usuários incluídos em `argos_admins` acessam os dados administrativos compartilhados. Até serem incluídos, ambos ficam sem acesso aos registros, inclusive os anteriores. No SQL Editor do Supabase, com acesso administrativo, adicione os UUIDs das duas contas existentes em **Authentication → Users**:

```sql
insert into public.argos_admins (user_id)
values ('UUID-DO-PRIMEIRO-USUARIO'), ('UUID-DO-SEGUNDO-USUARIO')
on conflict (user_id) do nothing;
```

Substitua cada valor pelo UUID real da conta antes de executar. Não ative cadastro público. Para retirar acesso, remova o UUID da tabela pelo SQL Editor. Apenas membros cadastrados compartilham todos os projetos e lançamentos, inclusive os criados antes da migration.

O arquivo `../supabase/.env.example` é destinado somente à Edge Function legada `project-request`; ele não configura o painel nem o portal.

## O que o painel acompanha

- Visão geral de clientes, projetos em andamento, finalização e concluídos.
- Cadastro, edição, busca e exclusão de clientes e previsão de entrega.
- Edição de progresso, etapas, escopo e prévias para computador/celular, compartilhadas com o portal individual publicado no site dos clientes.
- Os links privados estão nas ações de cada cliente; o portal busca as atualizações automaticamente a cada 30 segundos enquanto estiver aberto.
- Lançamentos de receitas e despesas, vinculáveis a projetos, com situação paga ou pendente. Faturamento recebido e lucro consideram apenas os lançamentos pagos; os valores pendentes de receita aparecem separadamente. Lançamentos anteriores são preservados como pagos.
- Indicadores financeiros de receitas, despesas e resultado do mês.
- Área de marketing para guardar ideias, legendas, hashtags, links de mídia, datas planejadas e métricas preenchidas manualmente.
- A área de marketing ainda não publica automaticamente nem busca métricas do Instagram. Para ativar a integração oficial, é necessário concluir a configuração e autorização do app Meta; nunca coloque App Secret ou tokens no código do navegador ou no chat.
