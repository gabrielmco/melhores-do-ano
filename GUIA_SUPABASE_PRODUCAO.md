# Guia pelo site do Supabase — Bom Jardim/MG

Este fluxo é feito pelo painel web do Supabase, sem PowerShell e sem instalar a CLI. Os nomes em português podem aparecer acompanhados do nome original em inglês.

## Antes de começar

Você já criou a organização **Melhores do Ano**. Agora confira se existe um projeto dentro dela.

Pode me enviar somente estas informações:

1. Nome do projeto.
2. `Project ref` do projeto.
3. URL do projeto, parecida com `https://xxxxxxxx.supabase.co`.
4. Chave **Publishable**, começando com `sb_publishable_`, ou a chave pública `anon` antiga.
5. Domínio final onde o site será publicado.
6. Se o projeto está vazio ou se já possui tabelas.

Nunca envie:

- senha do banco;
- senha da sua conta ou do administrador;
- chave `Secret`, `service_role` ou `sb_secret_`;
- secret key do Cloudflare Turnstile;
- valor de `VOTE_HASH_SECRET`;
- códigos de autenticação em duas etapas.

### Se uma Secret key foi enviada por engano

Considere a chave comprometida, mesmo que a conversa pareça privada. No projeto correto:

1. Abra **Configurações** pelo ícone de engrenagem.
2. Entre em **Chaves da API** ou **API Keys**.
3. Na área **Secret keys**, localize a chave exposta.
4. Abra o menu de três pontos e clique em **Revogar** ou **Revoke**.
5. Confirme a revogação.

Não crie outra Secret key para o frontend e não coloque esse tipo de chave no arquivo `.env`. Este site usa apenas a **Project URL** e a **Publishable key** no navegador. As Edge Functions hospedadas recebem as credenciais internas necessárias diretamente do Supabase.

## 1. Criar o projeto dentro da organização

Se ainda não existir um projeto:

1. Entre em `supabase.com/dashboard`.
2. Clique na organização **Melhores do Ano**.
3. Clique em **Novo projeto** ou **New project**.
4. Em **Nome**, use `melhores-do-ano-bom-jardim`.
5. Crie uma senha forte para o banco e guarde em um gerenciador de senhas.
6. Em **Região**, escolha a opção mais próxima do Brasil; normalmente **South America — São Paulo**.
7. Confirme a criação e espere o projeto terminar de preparar o banco.

Não crie outro projeto se já houver um projeto correto dentro da organização.

## 2. Criar o banco pelo Editor SQL

Dentro do projeto:

1. No menu lateral, abra **Editor SQL** ou **SQL Editor**.
2. Clique em **Nova consulta** ou **New query**.
3. Abra o arquivo indicado abaixo, copie todo o conteúdo e cole no editor.
4. Clique em **Executar** ou **Run**.
5. Espere aparecer a mensagem de sucesso antes de seguir para o próximo arquivo.

### Projeto novo e vazio

Execute exatamente nesta ordem, uma única vez:

1. [`supabase_schema.sql`](./supabase_schema.sql)
2. [`202607130001_security_hardening.sql`](./supabase/migrations/202607130001_security_hardening.sql)
3. [`202607140001_bom_jardim_scope.sql`](./supabase/migrations/202607140001_bom_jardim_scope.sql)

### Projeto que já possui as tabelas do sistema

Não execute novamente `supabase_schema.sql`. Execute somente:

1. [`202607130001_security_hardening.sql`](./supabase/migrations/202607130001_security_hardening.sql)
2. [`202607140001_bom_jardim_scope.sql`](./supabase/migrations/202607140001_bom_jardim_scope.sql)

Se aparecer erro, pare e copie apenas a mensagem de erro para me enviar. Não repita o arquivo e não clique várias vezes em **Executar**.

## 3. Confirmar Bom Jardim no banco

Crie outra consulta no **Editor SQL** e execute:

```sql
select id, name, created_at
from public.cities
order by created_at;
```

O resultado público oficial deve conter **Bom Jardim - MG**. A migration também bloqueia novas cidades e operações fora dessa localidade.

## 4. Configurar o Cloudflare Turnstile

Esta é a única etapa fora do Supabase, porque o Turnstile pertence à Cloudflare e protege a votação contra robôs.

1. Entre em `dash.cloudflare.com`.
2. Abra **Turnstile**.
3. Clique em **Adicionar site** ou **Add widget**.
4. Nomeie como `Votação Bom Jardim`.
5. Adicione o domínio final do site.
6. Use o modo **Gerenciado** ou **Managed**.
7. Salve.

A **Site key** é pública e pode ser enviada para mim. A **Secret key** deve ser guardada e cadastrada diretamente no Supabase; não envie essa chave na conversa.

## 5. Criar o segredo de proteção dos votos

No Supabase, abra **Editor SQL > Nova consulta** e execute:

```sql
select encode(gen_random_bytes(64), 'hex') as vote_hash_secret;
```

Copie o resultado. Esse valor é o `VOTE_HASH_SECRET`. Não envie para ninguém e não troque durante uma votação aberta.

## 6. Cadastrar os segredos no painel

No menu do projeto:

1. Abra **Edge Functions**.
2. Entre em **Segredos** ou **Secrets**.
3. Clique em **Adicionar novo segredo** ou **Add new secret**.
4. Cadastre os itens abaixo, um por vez.

| Nome | Valor |
|---|---|
| `CLOUDFLARE_TURNSTILE_SECRET_KEY` | Secret key recebida no Cloudflare |
| `VOTE_HASH_SECRET` | Resultado hexadecimal gerado no Editor SQL |
| `ALLOWED_ORIGINS` | URL completa do site, por exemplo `https://seudominio.com.br` |
| `TURNSTILE_EXPECTED_HOSTNAMES` | Somente o domínio, por exemplo `seudominio.com.br` |
| `TURNSTILE_EXPECTED_ACTION` | `voting` |

Não cadastre manualmente `SUPABASE_URL`, `SUPABASE_SECRET_KEYS` ou `SUPABASE_SERVICE_ROLE_KEY`: o ambiente hospedado do Supabase fornece essas variáveis automaticamente às funções.

## 7. Publicar a função `vote` pelo navegador

1. Abra **Edge Functions**.
2. Clique em **Implantar uma nova função** ou **Deploy a new function**.
3. Escolha **Pelo editor** ou **Via Editor**.
4. Dê o nome exato `vote`.
5. Apague todo o código de exemplo.
6. Copie todo o conteúdo de [`supabase/functions/vote/index.ts`](./supabase/functions/vote/index.ts) e cole no editor.
7. Em **Configurações**, **Detalhes** ou **Configurações avançadas**, desligue **Verificar JWT** / **Verify JWT with legacy secret**.
8. Clique em **Implantar função** ou **Deploy function**.
9. Aguarde a confirmação de publicação.

A verificação JWT precisa ficar desligada porque a votação é pública. A função continua protegida por origem permitida, Turnstile, validação dos dados, limite de tentativas, HMAC e uma RPC privada no banco.

## 8. Publicar a função `nominate`

Repita o processo anterior:

1. Nome exato: `nominate`.
2. Código: [`supabase/functions/nominate/index.ts`](./supabase/functions/nominate/index.ts).
3. Desligue **Verificar JWT** / **Verify JWT with legacy secret**.
4. Clique em **Implantar função**.

Não use o Assistente de IA do Supabase para reescrever essas funções. O código já contém as regras específicas de segurança do projeto.

## 9. Obter os dados públicos do projeto

No painel do projeto:

1. Clique no ícone de engrenagem **Configurações**.
2. Abra **Chaves da API** ou **API Keys**.
3. Copie a **Publishable key**. Ela começa com `sb_publishable_`.
4. Abra **Configurações da API** ou use o botão **Connect** do projeto.
5. Copie a **Project URL**.

Pode me enviar a Project URL e a Publishable key. Elas são destinadas ao frontend. Não copie a Secret key.

## 10. Criar o primeiro administrador

1. Abra **Autenticação > Usuários** ou **Authentication > Users**.
2. Clique em **Adicionar usuário**.
3. Use **Enviar convite** para o seu próprio e-mail.
4. Abra o convite recebido, confirme a conta e defina uma senha forte.
5. Volte para **Autenticação > Usuários**.
6. Abra o usuário e copie o **UID**.
7. Abra **Editor SQL > Nova consulta**.
8. Execute substituindo o UID e o nome:

```sql
insert into public.profiles (id, name, role)
values ('COLE_O_UID_AQUI', 'SEU NOME', 'super_admin')
on conflict (id) do update
set name = excluded.name,
    role = excluded.role;
```

Não coloque o e-mail no lugar do UID.

## 11. Cadastrar os dados da votação

Depois que eu configurar o frontend com a Project URL e a Publishable key:

1. Entre em `/admin.html` com o usuário criado.
2. Abra **Gerenciar Estrutura > Localidade** e confirme **Bom Jardim - MG**.
3. Cadastre as categorias.
4. Crie a edição com data inicial anterior ao momento atual e data final futura.
5. Vincule as categorias à edição.
6. Cadastre e aprove os candidatos.
7. Abra a eleição.

Sem uma eleição aberta, categoria vinculada e candidato aprovado, a página de votação ficará corretamente sem opções.

## 12. Conferência de segurança no painel

1. Abra **Banco de dados > Consultor de segurança** ou **Database > Security Advisor**.
2. Clique para executar novamente a análise.
3. Envie apenas os nomes dos avisos encontrados; não envie chaves ou dados pessoais.
4. Abra **Edge Functions > vote > Logs** e **nominate > Logs** depois de um teste.
5. Confira no **Editor de tabelas** que `votes`, `vote_attempts`, `profiles`, `nominations` e `admin_action_logs` não estão disponíveis para visitantes anônimos.

Depois de um voto real, a tabela `votes` deve guardar identificadores pseudonimizados, e não o contato, IP, navegador ou dispositivo em texto puro.

## 13. Dar acesso seguro ao Codex pelo MCP

O MCP oficial da Supabase usa OAuth: você autoriza pelo navegador, sem me enviar senha, Personal Access Token, Publishable key ou Secret key. O fluxo antigo por `npx` não é necessário.

Este repositório já possui [`.codex/config.toml`](./.codex/config.toml) configurado com:

- projeto restrito pelo `project_ref` encontrado na configuração local;
- modo `read_only=true`;
- somente ferramentas de banco, diagnóstico, desenvolvimento, funções e documentação;
- confirmação manual para toda chamada.

Antes de autorizar, confirme o identificador do projeto:

1. No painel Supabase, abra **Configurações > Geral** ou clique em **Conectar**.
2. Procure **Reference ID**, **Project ref** ou **ID de referência**.
3. Ele deve ser `gtdrnjxjcwfmekgfvjek`.
4. Se aparecer outro valor, não autorize ainda; envie somente esse novo identificador para eu corrigir a configuração.

Se o identificador estiver correto, no Codex:

1. Reinicie a extensão ou feche e abra novamente o Codex neste projeto.
2. Abra o ícone de engrenagem **Configurações**.
3. Entre em **Servidores MCP** ou **MCP servers**.
4. Localize `supabase_bom_jardim`.
5. Clique em **Autenticar** ou **Authenticate**.
6. O navegador abrirá a página oficial da Supabase. Entre na sua conta e autorize a organização **Melhores do Ano**.
7. Volte ao Codex e confirme que o servidor aparece como conectado. No campo de conversa, `/mcp` também mostra o estado.

Não habilite **Servidor OAuth** dentro de **Autenticação** do projeto. Essa opção serve para criar um provedor OAuth próprio e não é necessária para o MCP hospedado da Supabase.

Depois da autenticação, eu consigo verificar o banco real, RLS, migrations, consultores de segurança, logs e funções implantadas. O modo somente leitura impede que eu aplique SQL ou publique código. Qualquer fase posterior de escrita deve ser temporária, revisada e autorizada separadamente.
