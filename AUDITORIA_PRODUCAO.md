# Auditoria Fullstack Para Producao

Data da auditoria: 16/06/2026  
Projeto: `projetos-melhores-do-ano`  
Escopo executado: relatorio completo, sem alteracao de codigo funcional, sem gravacao em Supabase real.

## Veredito Executivo

**Status geral: Nao pronto para producao.**

O projeto tem uma base funcional promissora: Vite multi-page compila, as paginas principais carregam, ha separacao de views publicas no Supabase, RLS esta habilitado nas tabelas e o voto em candidato aprovado passa por uma Edge Function com Turnstile, HMAC e RPC `cast_vote`.

Ainda assim, existem bloqueadores de producao em seguranca, integridade de voto, fluxo administrativo, dados ficticios e assets. Os mais importantes sao:

- O fluxo de indicacao grava direto na tabela `nominations`, sem Edge Function, sem Turnstile server-side e sem gerar voto contabilizavel.
- A politica publica `insert_nominations_public` permite insert anonimo com `with check (true)`.
- O painel admin usa `state.selectedElectionId` sem declarar `state`, o que quebra a aba de mesclagem quando executada.
- Ha uso amplo de `innerHTML` com dados vindos do banco/mock, criando risco real de XSS.
- O cliente contem modo mock completo com contas e senhas de teste, podendo ir para producao se variaveis de ambiente falharem.
- O teste local capturou erro de Turnstile em `votar.html`.
- Existem assets referenciados e nao presentes, incluindo os arquivos de marketing e o fallback `default-logo.webp`.

## Validacoes Executadas

### Build

Comando executado em pasta temporaria, sem mexer no `dist` do projeto:

```powershell
$env:VITE_SUPABASE_URL=''
$env:VITE_SUPABASE_ANON_KEY=''
$env:VITE_TURNSTILE_SITE_KEY='1x00000000000000000000AA'
npx vite build --outDir <temp>
```

Resultado: **passou**.

Resumo do build:

- 72 modulos transformados.
- Paginas geradas: `index.html`, `votar.html`, `resultados.html`, `candidato.html`, `admin.html`.
- Principais bundles:
  - `assets/supabaseClient-D69yqNOd.js`: 225.92 kB, gzip 59.27 kB.
  - `assets/main-BvbkRebs.js`: 147.97 kB, gzip 53.90 kB.
  - `assets/main-CBgXp6bB.css`: 40.34 kB, gzip 7.12 kB.

Observacao: o build passar nao garante seguranca, integridade de fluxo ou prontidao de deploy.

### Smoke test local em modo mock

Foi iniciado um servidor Vite local com variaveis placeholder para manter o cliente em modo mock. Foram carregadas as cinco paginas em desktop `1366x900` e mobile `390x844`.

Resultado:

- `index.html`: HTTP 200 desktop, HTTP 304 mobile, sem overflow horizontal detectado.
- `votar.html`: carregou, mas registrou erro de Turnstile.
- `resultados.html`: carregou sem erro de console relevante.
- `candidato.html`: carregou sem erro de console relevante.
- `admin.html`: carregou sem erro inicial relevante, mas a aba de mesclagem tem erro estatico confirmado no codigo.

Erro capturado no voto:

```text
Uncaught TurnstileError: [Cloudflare Turnstile] Invalid or missing type for parameter "sitekey", expected "string", got "object".
```

Tambem houve `404` para `favicon.ico`, que nao bloqueia o uso, mas deve ser corrigido antes de producao.

### Scanner de links, ancoras e assets

Resultado:

- As ancoras internas da home existem: `#heroSection`, `#about`, `#gallerySection`, `#methodologySection`.
- A home aponta para `votar.html`, `resultados.html`, `candidato.html` e `admin.html`.
- Ha links placeholder `href="#"` em termos, privacidade, logo e rodape.
- Existem assets faltantes no painel do candidato:
  - `/assets/marketing/selo-votacao-aberta-stories.png`
  - `/assets/marketing/selo-vencedor-feed.png`
  - `/assets/marketing/logo-excelencia-vetor.svg`
- O fallback `/assets/images/default-logo.webp` e usado pelo JS, mas nao existe em `public/assets/images`.

## Arquitetura Atual

### Front-end

- Stack: Vite multi-page com HTML estatico, Sass e JavaScript modular.
- Entradas definidas em `vite.config.js:19-24`: `index`, `votar`, `resultados`, `candidato`, `admin`.
- Dependencias principais em `package.json:11-19`: Supabase JS, GSAP, Lenis, Puppeteer, Sass e Vite.
- Estilos globais em `src/styles/main.scss` com parciais para navbar, hero, about, gallery, metodologia, CTA e footer.
- As paginas internas possuem bastante CSS inline dentro dos HTMLs.

### Backend e banco

- Backend principal: Supabase, Postgres, RLS, views publicas e RPCs.
- Edge Function de voto em `supabase/functions/vote/index.ts`.
- Schema em `supabase_schema.sql`.
- Dados de teste SQL em `supabase_test_queries.sql`.

### Autenticacao e permissoes

- Admin e candidato usam `supabase.auth.signInWithPassword`.
- Perfis sao controlados pela tabela `profiles`.
- RLS esta habilitado para as tabelas principais em `supabase_schema.sql:172-184`.
- Helpers de role usam `security definer` com `search_path` vazio.

## Navegacao Entre Paginas

### O que esta correto

- A home liga para a votacao no menu principal: `index.html:39`.
- A home liga para resultados no menu principal: `index.html:40`.
- A home tem CTA para votar: `index.html:93`.
- O rodape liga para votacao e resultados: `index.html:511-512`.
- O rodape liga para painel do concorrente e admin: `index.html:521-522`.
- As ancoras internas da home foram verificadas e existem.

### Lacunas

- As paginas `votar.html`, `resultados.html`, `candidato.html` e `admin.html` nao possuem navegacao consistente de volta para a home.
- O logo da pagina de voto e apenas imagem, nao link para `/`.
- `resultados.html` nao tem menu nem link claro para voltar ao site principal.
- Expor `admin.html` no rodape publico (`index.html:522`) facilita descoberta da area administrativa. A protecao real deve estar no Auth/RLS, mas em producao e melhor remover esse link publico ou mover para URL menos promocional.
- Termos e politica ainda apontam para `#`: `index.html:541-543` e `votar.html:557`.

## Achados Criticos

### C1 - Fluxo de indicacao nao passa pela mesma seguranca do voto

Evidencias:

- O front grava indicacoes direto em `nominations`: `src/js/votar.js:529-543`.
- O proprio comentario informa que indicacao nao passa por `cast_vote`: `src/js/votar.js:549-550`.
- A chamada segura a Edge Function so acontece para voto em candidato aprovado: `src/js/votar.js:567`.
- O banco permite insert publico irrestrito em indicacoes: `supabase_schema.sql:274`.

Impacto:

- Indicacoes podem ser enviadas sem a protecao server-side usada no voto.
- O Turnstile fica dependente do front e nao e validado no servidor para indicacoes.
- A indicacao nao gera registro em `votes`, entao o "primeiro voto" do eleitor nao entra automaticamente na apuracao.
- Ha risco de spam, abuso, lixo operacional no painel admin e inconsistencias de contagem.

Recomendacao:

- Criar uma Edge Function `nominate` ou ampliar a `vote` para tratar indicacao.
- Validar Turnstile, consentimentos, rate limit, cidade, eleicao aberta e categoria no servidor.
- Armazenar consentimentos e auditoria da indicacao.
- Definir regra explicita: indicacao aprovada deve ou nao virar voto. Se deve virar voto, criar fluxo transacional que gere `votes` ou uma tabela propria de votos pendentes vinculada a indicacoes.
- Trocar a policy publica `with check (true)` por uma abordagem mediada por RPC/Edge Function.

### C2 - Painel admin quebra na mesclagem por `state` inexistente

Evidencias:

- `src/js/admin.js` declara `currentStaff` e `currentTab`, mas nao declara `state`: `src/js/admin.js:43-44`.
- A aba de mesclagem escreve `state.selectedElectionId`: `src/js/admin.js:425`.
- A busca de candidatos usa `state.selectedElectionId`: `src/js/admin.js:464`.

Impacto:

- Ao carregar categorias/candidatos na mesclagem, o navegador tende a disparar `ReferenceError: state is not defined`.
- Mesclagem de duplicados fica indisponivel ou instavel.
- E um bug que o build nao captura porque JavaScript puro nao tem checagem estatica.

Recomendacao:

- Declarar estado local do admin, por exemplo `let adminState = { selectedElectionId: '' }`.
- Substituir os usos de `state.selectedElectionId` por esse estado local.
- Adicionar smoke test automatizado para login admin, troca de aba, selecao de cidade, selecao de categoria e listagem de candidatos.

### C3 - Risco de XSS por `innerHTML` com dados dinamicos

Evidencias:

- Render de candidatos usa `card.innerHTML` com `candidate.name`, `candidate.instagram` e `logo_url`: `src/js/votar.js:379`.
- Resumo de candidato usa `selectedCandidateSummary.innerHTML`: `src/js/votar.js:435` e `src/js/votar.js:449`.
- Resultados usam HTML string com `candidate_name`, `candidate_instagram`, `candidate_logo`: `src/js/resultados.js:152`, `src/js/resultados.js:186`, `src/js/resultados.js:220`.
- Admin usa `row.innerHTML` em varias tabelas com dados de indicacoes, CRM, logs e votos: `src/js/admin.js:279`, `src/js/admin.js:594`, `src/js/admin.js:686`, `src/js/admin.js:773`, `src/js/admin.js:803`.
- Toast usa `toast.innerHTML` com `message`: `src/js/supabaseClient.js:695`.

Impacto:

- Nomes, Instagram, descricoes, observacoes de CRM e logs podem conter HTML ou payload malicioso.
- Como parte desses dados pode vir de usuarios anonimos por indicacao, o risco e alto.
- Um payload em uma indicacao poderia executar no painel administrativo.

Recomendacao:

- Renderizar dados de usuarios com `textContent`, `setAttribute` validado e construcao via `createElement`.
- Sanitizar URLs de imagem e links, aceitando apenas `https:` ou assets internos esperados.
- Nunca interpolar dados brutos em `style="background-image: url(valor_vindo_do_banco)"`.
- Sanitizar mensagens de erro antes de enviar para o toast, ou montar o toast sem `innerHTML`.

### C4 - Modo mock e credenciais ficticias estao no bundle do cliente

Evidencias:

- Mock DB fica no front em `src/js/supabaseClient.js:7-115`.
- Contas e senhas de teste estao no codigo: `src/js/supabaseClient.js:105-107`.
- O modo mock ativa quando `VITE_SUPABASE_URL` esta vazio ou contem placeholder: `src/js/supabaseClient.js:465`.
- As credenciais de teste sao exibidas no console: `src/js/supabaseClient.js:477-481`.
- `.env.example` tem placeholders publicos de Supabase e Turnstile.

Impacto:

- Se o deploy sair sem env real, a aplicacao abre em modo fake e parece funcionar com dados ficticios.
- O bundle de producao inclui codigo de mock, senhas e interceptador global de `fetch`.
- Isso pode mascarar falhas de integracao real e confundir usuarios.

Recomendacao:

- Remover o mock do bundle de producao ou ativar apenas com `VITE_ENABLE_MOCKS=true` e `import.meta.env.DEV`.
- Em producao, falhar de forma explicita se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estiverem ausentes.
- Remover logs de credenciais do console.
- Criar `.gitignore` antes de versionar o projeto, incluindo `.env`, `node_modules`, `dist`, caches e arquivos temporarios.

### C5 - Turnstile apresentou erro no smoke test local

Evidencias:

- Script externo carregado em `votar.html:15`.
- Widget renderizado via JS em `src/js/votar.js:490-491`.
- Smoke test capturou erro: `Invalid or missing type for parameter "sitekey", expected "string", got "object"`.

Impacto:

- Se o widget nao renderizar, o botao de confirmar voto permanece bloqueado porque `state.turnstileToken` nao e preenchido.
- Em producao, o usuario pode ficar preso no fluxo de voto.

Recomendacao:

- Validar o valor final de `import.meta.env.VITE_TURNSTILE_SITE_KEY` no runtime.
- Garantir que `turnstile.render` receba o container e parametros conforme a API atual.
- Criar fallback de erro visual claro quando o widget falhar.
- Testar com site key real do dominio de producao e chave secreta configurada na Edge Function.

### C6 - Assets obrigatorios ausentes

Evidencias:

- Painel do candidato referencia `/assets/marketing/selo-votacao-aberta-stories.png`: `candidato.html:373`.
- Painel do candidato referencia `/assets/marketing/selo-vencedor-feed.png`: `candidato.html:383`.
- Painel do candidato referencia `/assets/marketing/logo-excelencia-vetor.svg`: `candidato.html:393`.
- Fallback de logo inexistente em `src/js/votar.js:377`, `src/js/votar.js:448`, `src/js/resultados.js:163`, `src/js/resultados.js:198`.

Impacto:

- Downloads do kit de divulgacao quebram.
- Candidatos sem logo exibem imagem quebrada.
- Resultado publico pode parecer incompleto ou amador.

Recomendacao:

- Adicionar `public/assets/marketing/*` com os nomes usados ou ajustar os links.
- Adicionar `public/assets/images/default-logo.webp` ou trocar o fallback para `logo.webp`.
- Adicionar teste local de existencia de assets antes do deploy.

### C7 - Edge Function nao valida configuracao obrigatoria ao iniciar

Evidencias:

- Segredos usam fallback para string vazia: `supabase/functions/vote/index.ts:5-8`.
- HMAC usa `VOTE_HASH_SECRET` diretamente: `supabase/functions/vote/index.ts:96-106`.
- Cliente service role usa `SUPABASE_SERVICE_ROLE_KEY`: `supabase/functions/vote/index.ts:112`.

Impacto:

- Se um segredo nao estiver configurado, a funcao pode falhar em runtime ou gerar hashes com segredo vazio.
- Erros de configuracao podem virar falhas 500 durante votacao.

Recomendacao:

- Validar todos os segredos no inicio da funcao.
- Retornar erro claro de configuracao somente em ambiente interno, sem expor detalhes ao cliente.
- Adicionar checklist de secrets no deploy: `CLOUDFLARE_TURNSTILE_SECRET_KEY`, `VOTE_HASH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

### C8 - Dados pessoais em indicacoes nao tem consentimento persistido

Evidencias:

- `nominations` armazena `whatsapp` e `email`: `supabase_schema.sql:89-103`.
- A tabela nao tem campos de consentimento, IP, user agent ou hash do identificador.
- Votos possuem consentimentos obrigatorios: `supabase_schema.sql:105-120`.
- Front envia indicacoes diretamente para `nominations`: `src/js/votar.js:529-543`.

Impacto:

- O fluxo de indicacao coleta dados pessoais sem auditoria equivalente ao voto.
- A conformidade LGPD fica incompleta.

Recomendacao:

- Adicionar campos de consentimento/auditoria para indicacoes ou unificar indicacao com o fluxo server-side de voto.
- Armazenar identificador com hash quando possivel.
- Documentar retencao, finalidade e exclusao de dados pessoais.

## Achados Moderados

### M1 - CORS da Edge Function esta aberto para qualquer origem

Evidencia:

- `Access-Control-Allow-Origin: "*"` em `supabase/functions/vote/index.ts:12`.

Impacto:

- Sites externos conseguem chamar a funcao. A seguranca depende do Turnstile e da validacao server-side, mas a origem nao e restringida.

Recomendacao:

- Restringir CORS aos dominios oficiais de producao e staging.
- Manter `OPTIONS` para preflight, mas com allowlist de origem.

### M2 - Aprovacao de indicacao nao e transacional e pode falhar parcialmente

Evidencias:

- Admin insere candidato diretamente: `src/js/admin.js:315-327`.
- Depois atualiza a indicacao: `src/js/admin.js:334-339`.
- Depois tenta inserir log: `src/js/admin.js:344`.

Impacto:

- Se a ultima etapa falhar, o candidato pode ter sido criado e a indicacao atualizada, mas o usuario recebe erro.
- Moderadores podem ter permissao de moderar indicacoes, mas a tabela `admin_action_logs` aceita escrita apenas de admin/super_admin: `supabase_schema.sql:289`.

Recomendacao:

- Criar RPC `approve_nomination` com transacao unica, validacao de role e log server-side.
- Criar RPC `reject_nomination` para manter auditoria consistente.

### M3 - Fechamento de eleicao e publicacao misturam frontend e banco

Evidencias:

- Admin fecha eleicao com update direto: `src/js/admin.js:718-720`.
- Publicacao usa RPC `publish_results`: `supabase_schema.sql:798`.

Impacto:

- Fechamento direto depende de RLS, mas nao garante log transacional.
- Pode faltar trilha de auditoria para mudanca de status.

Recomendacao:

- Criar RPC `close_election` com validacao de role e log.
- Padronizar todas as acoes administrativas sensiveis via RPC.

### M4 - Views publicas podem expor dados fora do ciclo esperado

Evidencias:

- `public_candidates` filtra por `status = 'aprovado'`: `supabase_schema.sql:302-315`.
- A view nao filtra status/data da eleicao.
- `public_winners` filtra por `is_public = true`: `supabase_schema.sql:318-333`.

Impacto:

- Candidatos aprovados de eleicoes fora do periodo podem aparecer se o front consultar diretamente por IDs.
- A exposicao e limitada, mas a regra de negocio fica dividida entre front e banco.

Recomendacao:

- Incluir join com `elections` nas views publicas e filtrar status permitido.
- Para candidatos publicos, considerar apenas eleicoes `aberta`.
- Para resultados, manter apenas eleicoes `publicada`.

### M5 - Validacao de entrada e normalizacao precisam ser fortalecidas

Evidencias:

- `voter_type` e recebido pela Edge Function e enviado para RPC: `supabase/functions/vote/index.ts:38`, `supabase/functions/vote/index.ts:123`.
- WhatsApp e email possuem validacao basica no front, mas nao ha validacao equivalente clara na Edge Function antes do RPC.
- Instagram e URLs de logo sao aceitos em varios fluxos sem sanitizacao consistente.

Impacto:

- Dados invalidos podem gerar erro 500 ou poluir registros.
- URLs maliciosas podem ser usadas para tracking ou XSS se renderizadas de forma insegura.

Recomendacao:

- Validar `voter_type in ('email', 'whatsapp')` na Edge Function.
- Validar formato de email e WhatsApp no servidor.
- Normalizar Instagram sem HTML e validar URLs permitidas.

### M6 - Dependencia de `localStorage` para `cookie_id`

Evidencia:

- `cookie_id` e criado e persistido no `localStorage`: `src/js/votar.js:18-23`.

Impacto:

- Usuario pode limpar localStorage e receber novo identificador de dispositivo.
- Isso nao invalida a restricao principal por identificador do eleitor, mas limita deteccao por dispositivo.

Recomendacao:

- Manter `cookie_id` apenas como sinal auxiliar.
- Usar combinacao de hash de contato, IP, user agent e rate limit.
- Registrar tentativas suspeitas por heuristica server-side.

### M7 - Admin e candidato dependem de paginas publicamente acessiveis

Impacto:

- As paginas sao protegidas por login, mas ficam descobertas no HTML publico.
- Nao e falha de seguranca por si so, mas aumenta superficie de ataque e ruído.

Recomendacao:

- Remover link publico para admin.
- Adicionar `noindex` em `admin.html` e `candidato.html`.
- Configurar headers de seguranca no host.

### M8 - Build nao cobre regressao funcional

Impacto:

- Bugs como `state is not defined`, erro de Turnstile e XSS potencial passam pelo build.

Recomendacao:

- Adicionar testes smoke com Puppeteer/Playwright:
  - Home abre e CTAs navegam.
  - Voto carrega cidades/categorias/candidatos.
  - Turnstile renderiza ou fallback aparece.
  - Login admin abre dashboard.
  - Aba mesclagem carrega cidade/categoria.
  - Login candidato carrega perfil.

## Achados Leves

### L1 - Links legais e placeholders

Evidencias:

- `index.html:541-543`.
- `votar.html:557`.

Recomendacao:

- Criar paginas ou documentos reais de Termos de Uso e Politica de Privacidade.
- Ajustar os links antes de publicar.

### L2 - Favicon padrao ausente

Evidencia:

- Smoke test capturou `404 http://127.0.0.1:<porta>/favicon.ico`.
- Existe favicon webp em `index.html:8`, mas o navegador ainda tentou `favicon.ico`.

Recomendacao:

- Adicionar `public/favicon.ico` ou declarar favicon consistente em todas as paginas.

### L3 - Paginas internas nao tem SEO completo

Estado atual:

- `index.html`, `votar.html` e `resultados.html` possuem `title`, `description` e `viewport`.
- `candidato.html` e `admin.html` tem `title` e `viewport`, mas nao precisam SEO publico.

Recomendacao:

- Adicionar Open Graph/Twitter Card para home, votacao e resultados.
- Adicionar canonical.
- Adicionar `robots noindex` para admin e candidato.
- Criar `sitemap.xml` e `robots.txt`.

### L4 - Responsividade basica esta boa, mas ha pontos de robustez

Evidencias:

- Smoke test nao detectou overflow horizontal em desktop ou mobile.
- `src/styles/base/_reset.scss:21` usa `overflow-x: hidden`, o que pode mascarar estouros reais.
- Varias paginas internas usam `min-height: 100vh`: `votar.html:28`, `resultados.html:24`, `candidato.html:23`, `admin.html:23`.
- A navbar mobile usa `height: 100vh`: `src/styles/sections/_navbar.scss:113`.
- Metodologia usa `height: 100vh`: `src/styles/sections/_methodology.scss:16` e `src/styles/sections/_methodology.scss:431`.

Recomendacao:

- Trocar `100vh` por `100dvh` onde a altura precisa acompanhar browsers mobile modernos.
- Testar iOS Safari e Chrome Android.
- Verificar se tabelas admin continuam usaveis em telas de 360 px.

### L5 - Consistencia visual e manutencao

Observacoes:

- A home usa Sass modular e componentes por secao.
- As paginas internas concentram muito CSS inline.
- Ha emojis em texto e UI de paineis, que podem variar por sistema operacional.

Recomendacao:

- Extrair CSS inline de `votar.html`, `resultados.html`, `candidato.html` e `admin.html` para parciais Sass.
- Substituir emojis de botoes/status por SVG ou icones consistentes.
- Padronizar componentes de formulario, tabela, botao, badge e estado vazio.

## Pontos Positivos

- Vite esta configurado para multiplas entradas em `vite.config.js:19-24`.
- Build de producao passa em ambiente local.
- `dist` ja contem saida de build anterior.
- Supabase RLS esta habilitado para todas as tabelas relevantes.
- `votes` tem restricao unica por eleicao, categoria e identificador: `supabase_schema.sql:120`.
- `cast_vote` e restrita a `service_role`: `supabase_schema.sql:487`.
- Edge Function usa IP do cabecalho da requisicao, nao do cliente.
- Edge Function normaliza identificador e usa HMAC antes de gravar voto.
- `publish_results` trata empate no primeiro lugar antes de publicar.
- Views publicas removem telefone e email de candidatos.
- A home liga com as paginas principais.
- Nao foi detectado overflow horizontal no smoke test desktop/mobile.

## Checklist Antes de Producao

### Bloqueadores

- Corrigir `state` inexistente em `src/js/admin.js`.
- Criar fluxo server-side para indicacoes, com Turnstile, rate limit, consentimento e auditoria.
- Definir e implementar se indicacao aprovada gera voto contabilizavel.
- Remover ou isolar modo mock do bundle de producao.
- Remover contas e senhas ficticias do codigo enviado ao cliente.
- Corrigir erro de Turnstile em `votar.html`.
- Substituir `innerHTML` com dados dinamicos por render seguro.
- Adicionar assets faltantes de marketing e `default-logo.webp`.
- Criar documentos reais de Termos e Politica de Privacidade.
- Validar secrets obrigatorios da Edge Function.

### Recomendados

- Restrigir CORS da Edge Function aos dominios oficiais.
- Criar RPCs transacionais para aprovar/rejeitar indicacao e fechar eleicao.
- Adicionar logs server-side para todas as acoes administrativas sensiveis.
- Adicionar filtros de status de eleicao nas views publicas.
- Validar email, WhatsApp, Instagram e URL no servidor.
- Adicionar testes smoke automatizados para paginas e fluxos.
- Adicionar `.gitignore` antes de versionar.
- Adicionar `robots.txt`, `sitemap.xml`, canonical e Open Graph.
- Marcar admin/candidato como `noindex`.

### Ajustes leves

- Adicionar `favicon.ico`.
- Criar navegacao de volta para home nas paginas internas.
- Padronizar layout e CSS das paginas internas.
- Trocar `100vh` por `100dvh` onde fizer sentido.
- Revisar microcopy e remover placeholders de Instagram generico.

## Plano Sugerido de Correcao

### Fase 1 - Bloqueio de deploy

1. Corrigir `admin.js` para a aba de mesclagem funcionar.
2. Corrigir Turnstile e validar com chave real de staging.
3. Remover mock de producao e falhar se env obrigatoria estiver ausente.
4. Criar fluxo server-side de indicacoes.
5. Sanear renderizacao dinamica para eliminar XSS.
6. Adicionar assets faltantes.

### Fase 2 - Integridade e auditoria

1. Mover aprovacao/rejeicao de indicacoes para RPC transacional.
2. Mover fechamento de eleicao para RPC com log.
3. Revisar policies para permitir apenas o minimo necessario.
4. Criar testes SQL de permissao por role.
5. Criar testes e2e para votar, indicar, aprovar, publicar e consultar resultados.

### Fase 3 - Acabamento de producao

1. SEO publico completo.
2. Noindex para paginas restritas.
3. Headers de seguranca no host.
4. Revisao responsiva em dispositivos reais.
5. Monitoramento de erros, logs da Edge Function e alertas de falha de voto.

## Criterios Para Mudar o Veredito Para Pronto

O projeto pode ser considerado **Pronto com ressalvas** quando todos os bloqueadores estiverem corrigidos e validados em staging.

O projeto pode ser considerado **Pronto** quando, alem dos bloqueadores, os itens recomendados de seguranca, auditoria, SEO basico e testes smoke estiverem cobertos.

## Conclusao

A pagina principal liga com as paginas essenciais, o build compila e a arquitetura Supabase tem boas fundacoes. O ponto central e que producao exige fechar as brechas entre front e servidor: indicacoes precisam da mesma disciplina do voto, admin precisa de transacoes auditadas, render dinamico precisa ser seguro e mocks nao podem vazar para o bundle final.

No estado atual, publicar o projeto exporia riscos reais de seguranca, fraude operacional, dados ficticios e experiencia quebrada no voto. A recomendacao profissional e segurar o deploy ate resolver os bloqueadores listados.
