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
3. Em **Authentication → Users**, crie o usuário administrativo. Não habilite cadastro público para este painel.
4. No repositório separado do app, publique a pasta `app-argus` como raiz do projeto na Vercel. O portal individual deve estar publicado separadamente no endereço definido em `clientPortalUrl`. O portal deve ser a versão integrada ao Supabase, não apenas a demonstração.

Alternativamente, para aplicar as migrations pelo CLI contra o projeto hospedado, instale o Supabase CLI, autentique com `supabase login` e, na raiz `Argos`, execute `supabase link --project-ref fnbhulysivjphxjupvul` e `supabase db push`. Isso não requer iniciar a stack local com Docker.

Use somente a chave pública do projeto no navegador. Nunca coloque uma chave `service_role` no `config.js` do painel nem no `src/js/config.js` do site. O portal usa um link privado individual; qualquer pessoa com esse link poderá ver somente o projeto associado a ele. Não inclua informações financeiras no portal.

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
