# Plano de Implementacao da Auditoria

Data: 16/06/2026  
Base: `AUDITORIA_PRODUCAO.md`  
Objetivo: transformar o projeto de "Nao pronto para producao" em "Pronto para publicar" com seguranca, integridade de dados, navegacao correta e validacao local/staging.

## Veredito de Partida

O projeto compila e a home liga com as paginas principais, mas ainda nao deve ir ao ar. A implementacao deve atacar primeiro os bloqueadores que podem quebrar voto, permitir abuso, expor dados ficticios ou gerar falhas administrativas.

Ordem recomendada:

1. Corrigir bugs que quebram fluxo.
2. Fechar seguranca de voto/indicacao.
3. Remover mock de producao.
4. Sanear XSS e renderizacao dinamica.
5. Corrigir banco/RPCs/admin.
6. Completar assets, links legais, SEO e navegacao.
7. Validar tudo com build, smoke tests e checklist de deploy.

## Fase 0 - Preparacao Segura

### Objetivo

Preparar o projeto para alteracoes sem perder controle do que mudou.

### Tarefas

- Criar `.gitignore` com no minimo:
  - `.env`
  - `node_modules/`
  - `dist/`
  - `.cache/`
  - arquivos temporarios de teste
- Criar uma branch ou snapshot antes das mudancas.
- Preservar `AUDITORIA_PRODUCAO.md` como documento de referencia.
- Criar uma checklist manual de secrets de producao:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_TURNSTILE_SITE_KEY`
  - `CLOUDFLARE_TURNSTILE_SECRET_KEY`
  - `VOTE_HASH_SECRET`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

### Criterios de aceite

- `.env` nao deve ser versionado.
- Build local continua passando antes de iniciar correcoes profundas.
- Projeto deve ter uma lista clara de variaveis obrigatorias por ambiente.

## Fase 1 - Correcoes Bloqueadoras de Front-end

### 1. Corrigir estado inexistente no painel admin

Arquivos provaveis:

- `src/js/admin.js`

Implementacao:

- Declarar um estado local do painel admin, por exemplo:
  - `let adminState = { selectedElectionId: '' };`
- Trocar:
  - `state.selectedElectionId = election.id`
  - `.eq('election_id', state.selectedElectionId)`
- Por:
  - `adminState.selectedElectionId = election.id`
  - `.eq('election_id', adminState.selectedElectionId)`

Criterios de aceite:

- Login admin em modo mock abre dashboard.
- Aba "Mesclar Candidatos" carrega cidades.
- Ao selecionar uma cidade, categorias sao carregadas sem `ReferenceError`.
- Ao selecionar uma categoria com candidatos, selects de candidato oficial e duplicado sao preenchidos.

### 2. Corrigir Turnstile no fluxo de voto

Arquivos provaveis:

- `votar.html`
- `src/js/votar.js`
- `.env.example`

Implementacao:

- Garantir que `sitekey` seja sempre string valida antes de chamar `window.turnstile.render`.
- Evitar render duplicado do widget se a API carregar depois do `DOMContentLoaded`.
- Criar fallback visual quando Turnstile falhar:
  - mensagem clara para o usuario
  - botao de tentar novamente
  - log tecnico no console apenas em desenvolvimento
- Validar comportamento com site key de teste e depois com site key real de staging.

Criterios de aceite:

- `votar.html` nao dispara `TurnstileError`.
- Widget aparece no navegador.
- `state.turnstileToken` e preenchido pelo callback.
- Botao de confirmar voto so habilita depois de contato valido, consentimentos e Turnstile.

### 3. Corrigir assets faltantes

Arquivos/pastas provaveis:

- `public/assets/images/default-logo.webp`
- `public/assets/marketing/selo-votacao-aberta-stories.png`
- `public/assets/marketing/selo-vencedor-feed.png`
- `public/assets/marketing/logo-excelencia-vetor.svg`
- `candidato.html`
- `src/js/votar.js`
- `src/js/resultados.js`

Implementacao:

- Criar ou adicionar os assets com os nomes ja referenciados.
- Se os assets finais ainda nao existirem, trocar os links para assets existentes e profissionais.
- Garantir fallback unico para logos ausentes.

Criterios de aceite:

- Nenhum link `/assets/marketing/*` retorna 404.
- Nenhuma tela exibe imagem quebrada quando candidato/vencedor nao tem logo.
- Scanner local de assets passa sem faltantes.

## Fase 2 - Mock, Ambiente e Configuracao de Producao

### Objetivo

Impedir que dados ficticios e credenciais mockadas sejam enviados ao usuario final.

Arquivos provaveis:

- `src/js/supabaseClient.js`
- `.env.example`
- `package.json`

Implementacao:

- Criar flag explicita:
  - `VITE_ENABLE_MOCKS=true`
- Permitir mock apenas quando:
  - `import.meta.env.DEV === true`
  - ou `VITE_ENABLE_MOCKS === 'true'`
- Em ambiente de producao, se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estiverem ausentes, bloquear inicializacao com erro claro.
- Remover logs que imprimem contas e senhas de teste.
- Separar dados mockados em modulo proprio, carregado apenas em desenvolvimento, se possivel.

Criterios de aceite:

- Build de producao nao exibe credenciais mock no console.
- Aplicacao nao entra em modo fake silenciosamente se env real estiver ausente.
- Em desenvolvimento, mock ainda funciona quando explicitamente habilitado.
- `.env.example` documenta variaveis reais e flag de mock.

## Fase 3 - Seguranca do Voto e Indicacao

### Objetivo

Unificar a disciplina de seguranca entre voto e indicacao.

### 1. Criar fluxo server-side de indicacao

Arquivos provaveis:

- `supabase/functions/nominate/index.ts` ou `supabase/functions/vote/index.ts`
- `src/js/votar.js`
- `supabase_schema.sql`

Decisao tecnica recomendada:

- Criar uma Edge Function separada: `nominate`.
- Manter `vote` focada em voto para candidato aprovado.

Implementacao da Edge Function `nominate`:

- Aceitar:
  - `election_id`
  - `category_id`
  - `name`
  - `type`
  - `instagram`
  - `voter_name`
  - `voter_identifier`
  - `voter_type`
  - `cookie_id`
  - `privacy_consent`
  - `validation_consent`
  - `turnstile_token`
- Validar:
  - metodo `POST`
  - Turnstile server-side
  - consentimentos obrigatorios
  - eleicao aberta e dentro do periodo
  - categoria ativa
  - formato de email/WhatsApp
  - tamanho minimo e maximo de nome
  - tipo `profissional` ou `empresa`
- Normalizar:
  - nome indicado
  - WhatsApp
  - email
  - Instagram
- Registrar:
  - indicacao
  - IP
  - user agent
  - cookie id
  - consentimentos
  - hash do contato do eleitor, quando aplicavel

Alteracoes no banco:

- Adicionar campos em `nominations`:
  - `voter_name`
  - `voter_identifier_hash`
  - `voter_type`
  - `ip_address`
  - `user_agent`
  - `cookie_id`
  - `privacy_consent`
  - `validation_consent`
- Criar indice para auditoria/rate limit de indicacoes:
  - por `ip_address` e `created_at`
  - por `election_id`, `category_id`, `voter_identifier_hash`
- Remover ou restringir policy anonima direta de insert em `nominations`.
- Permitir insert apenas via service role da Edge Function ou RPC segura.

Alteracoes no front:

- Em `src/js/votar.js`, trocar o insert direto em `nominations` por `fetch` para `/functions/v1/nominate`.
- Mostrar sucesso apenas depois da resposta server-side.
- Resetar Turnstile em erro.

Criterios de aceite:

- Indicacao sem Turnstile valido falha.
- Indicacao sem consentimento falha.
- Indicacao para eleicao fechada falha.
- Indicacao valida aparece no painel admin como pendente.
- Nenhum usuario anonimo consegue inserir diretamente em `nominations` via Supabase client.

### 2. Definir regra de voto em indicacao

Regra recomendada:

- Indicacao nao conta como voto publico ate ser aprovada.
- Ao aprovar uma indicacao, o sistema deve converter a indicacao em candidato e registrar o voto inicial do indicador se ainda for valido e nao duplicado.

Implementacao recomendada:

- Criar coluna em `nominations` para guardar dados suficientes do eleitor de forma segura.
- Criar RPC `approve_nomination` que:
  - valida role admin/moderador
  - cria candidato
  - vincula `candidate_id` na indicacao
  - tenta criar voto inicial usando dados hasheados da indicacao
  - respeita duplicidade por `election_id`, `category_id`, `voter_identifier`
  - registra log administrativo
- Se houver duplicidade, aprovar candidato mesmo assim e registrar no log que o voto inicial nao foi contabilizado.

Criterios de aceite:

- Indicacao aprovada vira candidato.
- Voto inicial e registrado quando permitido.
- Duplicidade nao quebra aprovacao.
- Log informa candidato criado, indicacao vinculada e status do voto inicial.

## Fase 4 - RPCs Administrativas e RLS

### 1. Criar RPC `approve_nomination`

Arquivos provaveis:

- `supabase_schema.sql`
- `src/js/admin.js`

Implementacao:

- Mover logica de aprovacao do front para o banco.
- RPC deve validar role `admin`, `super_admin` ou `moderador`.
- RPC deve ser `security definer` com `set search_path = ''`.
- Front deve chamar `supabase.rpc('approve_nomination', { p_nomination_id: nominationId })`.

Criterios de aceite:

- Admin/moderador aprova indicacao.
- Comercial nao aprova indicacao.
- Log e gerado no banco.
- Operacao nao fica parcialmente aplicada.

### 2. Criar RPC `reject_nomination`

Implementacao:

- Validar role admin/moderador.
- Atualizar status para `rejeitado`.
- Gerar log.

Criterios de aceite:

- Rejeicao aparece no log.
- Comercial nao rejeita indicacao.

### 3. Criar RPC `close_election`

Implementacao:

- Validar role `admin` ou `super_admin`.
- Permitir fechar apenas eleicao `aberta`.
- Atualizar status para `encerrada`.
- Gerar log.
- Trocar update direto do front por RPC.

Criterios de aceite:

- Fechamento da votacao fica auditado.
- Moderador/comercial nao fecha eleicao.

### 4. Revisar views publicas

Arquivos provaveis:

- `supabase_schema.sql`

Implementacao:

- `public_candidates` deve fazer join com `elections`.
- Expor candidatos somente quando:
  - candidato `status = 'aprovado'`
  - eleicao `status = 'aberta'`
  - data atual dentro de `start_date` e `end_date`, se essa for a regra de negocio final.
- `public_winners` deve fazer join com `elections`.
- Expor vencedores somente quando:
  - `winners.is_public = true`
  - eleicao `status = 'publicada'`

Criterios de aceite:

- Candidato de eleicao encerrada nao aparece na votacao.
- Resultado de eleicao nao publicada nao aparece na pagina publica.

## Fase 5 - XSS e Renderizacao Segura

### Objetivo

Eliminar interpolacao insegura de dados de usuarios em HTML.

Arquivos provaveis:

- `src/js/votar.js`
- `src/js/resultados.js`
- `src/js/admin.js`
- `src/js/supabaseClient.js`

Implementacao:

- Criar helpers pequenos:
  - `createTextElement(tag, className, text)`
  - `setSafeImageBackground(element, url)`
  - `normalizeInstagramHandle(value)`
  - `createSafeInstagramLink(handle)`
- Substituir render com `innerHTML` por `document.createElement` e `textContent` nos pontos que usam dados do banco.
- Manter `innerHTML` apenas para HTML estatico totalmente controlado pelo codigo, sem interpolar dados externos.
- Toast deve montar DOM com `textContent`, nao interpolar `message` em HTML.
- Validar URLs:
  - aceitar `https:`
  - aceitar caminhos internos que comecem com `/assets/`
  - rejeitar `javascript:`, `data:` e strings com aspas quebrando CSS.

Criterios de aceite:

- Payload em nome de indicacao como `<img src=x onerror=alert(1)>` aparece como texto inofensivo.
- Payload em observacao de CRM nao executa.
- Payload em Instagram nao cria link malicioso.
- Build passa.
- Smoke test nao registra erro de console.

## Fase 6 - Navegacao, Links Legais e SEO

### 1. Links legais

Arquivos provaveis:

- `index.html`
- `votar.html`
- novos arquivos `termos.html` e `privacidade.html`

Implementacao:

- Criar paginas simples:
  - `termos.html`
  - `privacidade.html`
- Substituir `href="#"` dos termos e politica por links reais.
- Adicionar link de privacidade no fluxo de voto.

Criterios de aceite:

- Nenhum link legal aponta para `#`.
- Politica explica coleta de nome, WhatsApp/email, IP, user agent, cookie id, finalidade, retencao e contato.

### 2. Navegacao de volta

Arquivos provaveis:

- `votar.html`
- `resultados.html`
- `candidato.html`
- `admin.html`

Implementacao:

- Adicionar link discreto para `/` nas paginas internas.
- Tornar o logo da votacao clicavel para home.
- Em admin/candidato, usar link "Voltar ao site" sem expor informacao sensivel.

Criterios de aceite:

- Usuario consegue voltar para home a partir de qualquer pagina.
- Home continua ligando corretamente com votacao e resultados.

### 3. SEO e indexacao

Arquivos provaveis:

- `index.html`
- `votar.html`
- `resultados.html`
- `candidato.html`
- `admin.html`
- `public/robots.txt`
- `public/sitemap.xml`

Implementacao:

- Adicionar Open Graph para home, votacao e resultados.
- Adicionar canonical.
- Adicionar `noindex,nofollow` em `admin.html`.
- Adicionar `noindex` em `candidato.html`.
- Criar `robots.txt`.
- Criar `sitemap.xml` com paginas publicas.
- Adicionar `public/favicon.ico`.

Criterios de aceite:

- Admin e candidato nao devem ser indexados.
- Home, votacao e resultados devem ter preview social minimamente correto.
- Navegador nao deve pedir `favicon.ico` inexistente.

## Fase 7 - Responsividade e UI

### Objetivo

Melhorar robustez mobile sem redesenhar tudo.

Arquivos provaveis:

- `src/styles/sections/_navbar.scss`
- `src/styles/sections/_methodology.scss`
- `votar.html`
- `resultados.html`
- `candidato.html`
- `admin.html`

Implementacao:

- Trocar `height: 100vh` por `min-height: 100dvh` ou `height: 100dvh` onde fizer sentido.
- Revisar tabelas do admin:
  - permitir rolagem horizontal clara
  - manter cabecalho legivel
  - evitar botoes espremidos
- Validar formulario de voto em telas de 360 px.
- Evitar depender de `overflow-x: hidden` para esconder problemas.

Criterios de aceite:

- Sem overflow horizontal incoerente em 360 px, 390 px, 768 px, 1366 px.
- Tabelas admin continuam operaveis no mobile.
- Modais cabem na tela mobile.

## Fase 8 - Testes Automatizados e Validacao Final

### Scripts recomendados

Adicionar em `package.json`:

- `test:build`
- `test:smoke`
- `test:assets`
- `test:links`

### Smoke tests minimos

Criar script com Puppeteer usando o pacote ja instalado.

Cenarios:

1. Home carrega e CTAs principais existem.
2. Home navega para votacao.
3. Home navega para resultados.
4. Votacao carrega cidades.
5. Votacao seleciona cidade e categoria.
6. Votacao lista candidatos.
7. Turnstile renderiza ou mostra fallback controlado.
8. Login candidato mock abre dashboard em desenvolvimento.
9. Login admin mock abre dashboard em desenvolvimento.
10. Aba mesclagem admin carrega cidade/categoria sem erro.
11. Resultados carrega estado vazio sem quebrar.
12. Scanner de assets nao encontra faltantes.

### Testes SQL/RLS

Atualizar `supabase_test_queries.sql` para cobrir:

- anon nao insere diretamente em `nominations`.
- anon nao executa RPC administrativa.
- comercial acessa CRM, mas nao aprova indicacao.
- moderador aprova/rejeita indicacao.
- admin fecha eleicao e publica resultado.
- candidato acessa somente proprio perfil por RPC.
- views publicas respeitam status da eleicao.

### Comandos finais

Executar antes de publicar:

```powershell
npm run build
npm run test:assets
npm run test:links
npm run test:smoke
```

Criterios de aceite:

- Build passa.
- Nenhum 404 de asset obrigatorio.
- Nenhum link legal placeholder.
- Nenhum erro de console em fluxo principal.
- Voto e indicacao passam por Edge Function.
- Admin executa acoes sensiveis por RPC.

## Fase 9 - Deploy e Monitoramento

### Antes do deploy

- Configurar variaveis de ambiente no host do front.
- Configurar secrets das Edge Functions no Supabase.
- Aplicar schema/migracoes em staging.
- Rodar teste real com Supabase staging.
- Confirmar dominio no Cloudflare Turnstile.
- Confirmar CORS com dominio final.

### Depois do deploy

- Testar voto real em staging/producao controlada.
- Testar indicacao real.
- Testar aprovacao/rejeicao.
- Testar publicacao de resultado.
- Monitorar logs da Edge Function.
- Monitorar erros de console via ferramenta de observabilidade, se disponivel.

### Rollback

- Manter build anterior disponivel no host.
- Manter backup do schema antes das migracoes.
- Migrations devem ser reversiveis quando alterarem policies ou colunas criticas.

## Priorizacao Pratica

### Sprint 1 - Essencial para nao quebrar

- Corrigir `admin.js`.
- Corrigir Turnstile.
- Remover mock de producao.
- Adicionar `.gitignore`.
- Adicionar assets faltantes.

### Sprint 2 - Seguranca e banco

- Criar Edge Function `nominate`.
- Alterar `nominations` para auditoria/consentimento.
- Restringir policy de insert anonimo.
- Criar RPCs `approve_nomination`, `reject_nomination`, `close_election`.
- Revisar views publicas.

### Sprint 3 - XSS e qualidade

- Remover `innerHTML` inseguro.
- Sanitizar URLs e Instagram.
- Corrigir toast.
- Adicionar testes smoke e scanners.

### Sprint 4 - Producao

- Termos e privacidade.
- SEO publico.
- `noindex` admin/candidato.
- Responsividade final.
- Deploy staging e validacao final.

## Definicao de Pronto

O projeto so deve ser considerado pronto para ir ao ar quando todos estes itens forem verdadeiros:

- Fluxo de voto funciona com Supabase real e Turnstile real.
- Fluxo de indicacao funciona por Edge Function e nao por insert anonimo direto.
- Indicacoes armazenam consentimento e auditoria.
- Admin nao possui erro de estado na mesclagem.
- Acoes administrativas sensiveis sao transacionais e auditadas.
- Mock nao entra em producao.
- Dados ficticios e senhas de teste nao aparecem no bundle final.
- Renderizacao dinamica nao executa HTML vindo de usuario.
- Assets obrigatorios existem.
- Politica de Privacidade e Termos existem.
- Build e smoke tests passam.
- CORS e secrets estao configurados.
- Admin/candidato nao sao indexados.

## Observacao Final

Este plano deve ser executado na ordem proposta. A tentacao de arrumar primeiro detalhes visuais e grande, mas o maior risco atual esta na integridade do voto, no fluxo de indicacao, no mock em producao e na renderizacao insegura de dados dinamicos. Depois que esses pontos estiverem fechados, o restante vira acabamento de publicacao.
