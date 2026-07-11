Você é um desenvolvedor sênior full-stack, especialista em arquitetura segura, SaaS, sistemas de votação, Supabase, autenticação, banco de dados, painéis administrativos e experiência de usuário.

Quero criar o sistema do projeto “Empório Excelência”.

Contexto do negócio:
É uma premiação local por cidade. O público vota nos melhores profissionais ou empresas da cidade em categorias fixas, como Gastronomia, Estética, Saúde, Advocacia, Comércio, Serviços, Educação etc. Os vencedores recebem o título de “Melhor do Ano” ou “Destaque do Ano” e podem comprar uma plaquinha personalizada, selo digital e divulgação.

Eu já tenho a página de vendas pronta. Agora preciso construir a parte do sistema com:

1. Página pública de votação
2. Painel administrativo da equipe
3. Painel do candidato/vencedor
4. Área pública de resultados/vencedores

Antes de começar a codar, faça um plano técnico completo. Não comece implementando direto. Primeiro analise o projeto, proponha a arquitetura, as tabelas, os fluxos, as permissões, as regras de segurança, as páginas necessárias e os riscos.

Quero usar o máximo possível de ferramentas gratuitas no início.

Sugestão de stack:

* Frontend moderno
* Supabase no plano gratuito para banco de dados, autenticação, storage e funções server-side
* Cloudflare Turnstile gratuito para proteção anti-bot
* Vercel Hobby para deploy
* Banco relacional com estrutura profissional
* Sistema preparado para crescer no futuro

Não quero apenas algo simples. Quero algo profissional, seguro e escalável.

Objetivo principal:
Criar um sistema onde pessoas possam votar em profissionais/empresas da cidade, indicar novos candidatos caso não encontrem o nome, e a equipe possa validar indicações, juntar nomes duplicados, aprovar candidatos, acompanhar votos, detectar votos suspeitos e publicar resultados.

Regras principais do sistema:

1. Cidades

* O sistema deve permitir várias cidades.
* Cada cidade terá sua própria votação.
* Cada cidade pode ter status: rascunho, aberta, encerrada, apuração, resultado publicado.
* Cada cidade deve ter data de início e fim da votação.

2. Categorias

* Categorias fixas, mas editáveis pelo admin.
* Exemplos: Gastronomia, Saúde, Estética, Advocacia, Comércio, Serviços, Educação.
* Cada categoria pertence a uma cidade ou pode ser global e ativada por cidade.

3. Candidatos

* Candidatos podem ser empresas ou profissionais.
* Dados do candidato:

  * nome oficial
  * tipo: profissional ou empresa
  * cidade
  * categoria
  * Instagram
  * WhatsApp
  * e-mail
  * foto ou logo
  * descrição curta
  * status: pendente, aprovado, rejeitado, vencedor
  * criado por admin ou indicado pelo público

4. Indicações abertas

* O público não precisa escolher apenas nomes já cadastrados.
* A pessoa deve poder pesquisar um candidato.
* Se não encontrar, poderá indicar um novo.
* A indicação deve ficar pendente no painel admin.
* A indicação não deve virar candidato oficial automaticamente sem validação.
* A equipe deve conseguir aprovar, rejeitar ou mesclar indicações parecidas.

5. Nomes duplicados e erros de digitação

* O sistema deve ter uma área de “possíveis duplicados”.
* Exemplos:

  * “Dr João Silva”
  * “João Silva Advogado”
  * “Advocacia João Silva”
* O admin deve conseguir unir tudo em um único candidato oficial.
* Deve existir uma tabela ou lógica de aliases/apelidos do candidato.
* O sistema deve sugerir nomes parecidos quando alguém digitar.

6. Votação

* A pessoa escolhe:

  * cidade
  * categoria
  * candidato
* Depois informa dados básicos:

  * nome
  * WhatsApp ou e-mail
* Regra de voto:

  * 1 voto por pessoa por categoria por cidade.
* A mesma pessoa pode votar em categorias diferentes.
* A mesma pessoa não pode votar várias vezes no mesmo candidato/categoria.
* Registrar IP, user agent, data/hora, identificador do navegador/cookie e dados enviados.
* Não confiar apenas no IP.
* Usar camadas de proteção:

  * e-mail ou WhatsApp
  * cookie/local storage
  * IP
  * user agent
  * Cloudflare Turnstile
  * limite de tentativas por tempo
  * logs de auditoria

7. Votos suspeitos
   O painel admin deve mostrar alertas como:

* muitos votos do mesmo IP
* muitos votos em pouco tempo
* mesmo WhatsApp/e-mail tentando votar várias vezes
* user agent repetido demais
* votos em sequência para o mesmo candidato
* candidatos com crescimento anormal

O admin deve poder marcar votos como:

* válido
* suspeito
* anulado

8. Painel administrativo
   Criar painel admin com login seguro.

Funcionalidades:

* Dashboard geral
* Gerenciar cidades
* Gerenciar categorias
* Gerenciar candidatos
* Ver indicações pendentes
* Aprovar/rejeitar/mesclar indicações
* Ver ranking por cidade e categoria
* Ver votos detalhados
* Ver votos suspeitos
* Anular ou validar votos
* Definir vencedores
* Publicar resultados
* Exportar CSV
* Ver logs de ações administrativas
* Gerenciar usuários admin
* Definir permissões por função

Funções de usuário:

* super_admin
* admin
* moderador
* comercial
* candidato

Permissões:

* super_admin acessa tudo
* admin gerencia cidade/categorias/candidatos/votos
* moderador valida indicações e votos suspeitos
* comercial vê vencedores e dados para venda de plaquinhas
* candidato acessa apenas o próprio perfil

9. Painel do candidato/vencedor
   O candidato deve poder acessar uma área própria.

Funcionalidades:

* Ver e editar dados do perfil, se permitido
* Enviar logo/foto
* Ver status na premiação
* Ver se foi aprovado
* Ver se venceu
* Baixar selo digital, se disponível
* Acessar link para comprar plaquinha
* Ver orientações de divulgação
* Copiar texto pronto para postar no Instagram
* Gerar QR Code do perfil público

10. Página pública de resultados
    Deve mostrar:

* cidade
* categoria
* vencedor
* finalistas, se permitido
* selo “Melhor do Ano”
* perfil do vencedor
* botão para Instagram/WhatsApp
* regras da premiação
* transparência da votação

Opção estratégica:
Durante a votação, o ranking pode ficar oculto para o público. O admin vê tudo, mas o público só vê resultado final. Isso evita manipulação.

11. Página pública de votação
    Precisa ser bonita, confiável e com visual premium.
    Estilo:

* preto, dourado, branco
* elegante
* autoridade
* sensação de premiação oficial
* responsivo para celular
* pensado para tráfego vindo do Instagram

Fluxo:

* pessoa vem do Instagram
* escolhe cidade
* escolhe categoria
* pesquisa candidato
* se encontrar, vota
* se não encontrar, indica
* preenche nome + WhatsApp/e-mail
* confirma Turnstile
* voto registrado
* tela final incentiva compartilhar nos stories

12. Segurança
    Implementar segurança profissional:

* autenticação segura
* proteção de rotas
* permissões por função
* políticas de acesso no banco
* validação server-side para votos
* nunca confiar apenas no frontend
* logs de auditoria
* sanitização de inputs
* proteção contra spam
* proteção contra manipulação de votos
* rate limit quando possível
* separar dados públicos e privados
* não expor dados sensíveis no frontend

13. Banco de dados
    Planeje tabelas para:

* users/profiles
* roles
* cities
* categories
* city_categories
* candidates
* candidate_aliases
* nominations
* votes
* vote_audit_logs
* admin_action_logs
* suspicious_vote_flags
* winners
* badges
* orders ou purchase_intents
* settings
* public_pages

Defina os relacionamentos, campos importantes, status, índices e constraints únicas.

Constraints importantes:

* impedir voto duplicado por pessoa/cidade/categoria
* impedir candidato duplicado óbvio
* manter histórico de mudanças
* preservar logs

14. LGPD e privacidade
    Como o sistema coleta nome, WhatsApp, e-mail e IP, inclua:

* checkbox de aceite
* política de privacidade
* finalidade dos dados
* tempo de retenção
* opção de solicitar remoção
* acesso restrito aos dados pessoais no admin

15. Monetização
    Após a votação:

* painel comercial deve listar vencedores
* mostrar status: não contatado, contatado, interessado, comprou, recusou
* link para página de vendas já existente
* campo para observações comerciais
* possibilidade futura de pagamento online

16. Entregáveis que eu quero primeiro
    Antes de codar, entregue:

* plano geral do sistema
* mapa de páginas
* fluxos de usuário
* estrutura de banco
* regras de segurança
* regras de votação
* permissões
* ordem de implementação
* riscos e soluções
* checklist de MVP
* checklist de versão profissional

Depois do plano aprovado, aí sim implemente.

17. Importante
    Não faça gambiarra.
    Não implemente votação só no frontend.
    Não conte voto apenas por IP.
    Não deixe indicação virar candidato oficial sem validação.
    Não exponha dados pessoais publicamente.
    Não deixe qualquer usuário acessar painel admin.
    Não permita alterar votos sem log.
    Não permita publicar resultado sem votação encerrada.
    Não permita candidato ver dados privados de outros candidatos.

18. Prioridade do MVP
    Primeira versão precisa ter:

* votação pública
* indicação pública
* painel admin
* validação de indicações
* candidatos aprovados
* contagem de votos
* prevenção básica de voto duplicado
* votos suspeitos
* resultados
* painel comercial simples para vender plaquinhas

Faça primeiro o plano. Depois peça minha aprovação antes de implementar.


vc precisa analisar a pasta skills de elite para ver quais skills vc ira usar para fazer esse projeto da melhor maneira possivel e me apresentar o plano.

Não use todas as skills, apenas as necessárias.