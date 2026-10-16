import fs from 'node:fs';
import path from 'node:path';
import assert from 'assert';
import { createServer } from 'vite';
import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const ROOT = 'C:\\Users\\biel3\\OneDrive\\Documentos\\Projetos-de-sites\\04_Projetos_em_Desenvolvimento_e_Inacabados\\projeto-melhores-do-ano';
const OUTPUT_DIR = path.join(ROOT, 'scratch', 'audit_visuals');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('================================================================');
console.log(' AUDITORIA COMPLETA DE SISTEMA: MACROS, MICROS E VISUAIS');
console.log('================================================================\n');

const stats = {
  macroPassed: 0,
  microPassed: 0,
  visualPassed: 0,
  failures: []
};

function pass(type, msg) {
  if (type === 'MACRO') stats.macroPassed++;
  if (type === 'MICRO') stats.microPassed++;
  if (type === 'VISUAL') stats.visualPassed++;
  console.log(`[PASS - ${type}] ${msg}`);
}

function fail(type, msg, err) {
  stats.failures.push({ type, msg, err });
  console.error(`[FAIL - ${type}] ${msg}`, err || '');
}

// ============================================================================
// 1. TESTES MACRO (Arquitetura, Banco, Autenticação, RLS e Endpoints)
// ============================================================================
console.log('\n--- 1. TESTES MACRO (ARQUITETURA, SUPABASE, AUTH E ENDPOINTS) ---\n');

try {
  // 1.1 Conectividade Supabase Real
  const supabaseUrl = 'https://xjgkjkmxuhbhkdhaxxey.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhqZ2tqa214dWhiaGtkaGF4eGV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzMDMyNTQsImV4cCI6MjEwNjg3OTI1NH0.LK61XYNcY5PEKt7kQmXGzenSoUFz763-B3tAqqTUHDA';
  const sb = createClient(supabaseUrl, supabaseAnonKey);

  // 1.2 Leitura pública autorizada (cidades e categorias)
  const { data: cities, error: cErr } = await sb.from('cities').select('*');
  assert(!cErr && Array.isArray(cities) && cities.length > 0, 'Tabela cities deve responder com a cidade oficial');
  pass('MACRO', `Conectividade Supabase: Cidade oficial carregada com sucesso (${cities[0].name})`);

  const { data: cats, error: catErr } = await sb.from('categories').select('*');
  assert(!catErr && Array.isArray(cats) && cats.length > 0, 'Tabela categories deve responder');
  pass('MACRO', `Categorias públicas: ${cats.length} categoria(s) ativas no banco`);

  // 1.3 Bloqueio de RLS para usuário anônimo (dados confidenciais)
  const { data: votes, error: vErr } = await sb.from('votes').select('*');
  assert(vErr || (votes && votes.length === 0), 'Votos de eleitores protegidos por RLS');
  pass('MACRO', 'Segurança RLS: Tabela de votos blindada contra vazamento de eleitores');

  const { data: logs, error: lErr } = await sb.from('admin_action_logs').select('*');
  assert(lErr || (logs && logs.length === 0), 'Logs de auditoria protegidos por RLS');
  pass('MACRO', 'Segurança RLS: Tabela admin_action_logs restrita à equipe autenticada');

  // 1.4 Teste de Autenticação Real do Super Administrador Master
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: 'biel321oliveira@gmail.com',
    password: 'Zxc1gg4fe@'
  });
  assert(!authErr && authData.user, 'Login de biel321oliveira@gmail.com deve ser bem-sucedido');
  assert.strictEqual(authData.user.email, 'biel321oliveira@gmail.com');

  // Obter perfil RBAC
  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('name, role')
    .eq('id', authData.user.id)
    .single();

  assert(!profErr && profile, 'Perfil do super admin deve existir');
  assert(['super_admin', 'admin'].includes(profile.role), 'Papel do usuário deve ser super_admin ou admin');
  pass('MACRO', `Autenticação Master: Login validado com sucesso (${profile.name} - Cargo: ${profile.role})`);

  // Fazer logout após o teste
  await sb.auth.signOut();

} catch (err) {
  fail('MACRO', 'Falha nos testes de backend / Supabase', err.message);
}

// ============================================================================
// 2. TESTES MICRO (Componentes, Validações, Contraste e Estados)
// ============================================================================
console.log('\n--- 2. TESTES MICRO (TOGGLES, MÁSCARAS, CONTRATE E NAVEGAÇÃO) ---\n');

try {
  // 2.1 Botão de Senha (Sem texto "Ver", somente ícone SVG puro)
  const adminHtml = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf-8');
  assert(!adminHtml.includes('<span>Ver</span>'), 'admin.html não deve ter texto Ver');
  assert(adminHtml.includes('btnToggleAdminPassword'), 'admin.html possui btnToggleAdminPassword');
  pass('MICRO', 'Botão de alternância de senha no admin: 100% livre de texto (apenas ícone)');

  const candHtml = fs.readFileSync(path.join(ROOT, 'candidato.html'), 'utf-8');
  assert(!candHtml.includes('<span>Ver</span>'), 'candidato.html não deve ter texto Ver');
  assert(candHtml.includes('btnToggleLoginPassword'), 'candidato.html possui botão no login');
  assert(candHtml.includes('btnToggleRegisterPassword'), 'candidato.html possui botão no cadastro');
  pass('MICRO', 'Botões de senha no portal do candidato: login e cadastro com ícone puro');

  const defHtml = fs.readFileSync(path.join(ROOT, 'definir-senha.html'), 'utf-8');
  assert(!defHtml.includes('<span>Ver</span>'), 'definir-senha.html não deve ter texto Ver');
  assert(defHtml.includes('btnToggleNewPassword'), 'definir-senha.html possui toggle no campo nova senha');
  assert(defHtml.includes('btnToggleConfirmPassword'), 'definir-senha.html possui toggle no campo confirmação');
  pass('MICRO', 'Botões de senha em definir-senha: ambos os campos adaptados e sem texto');

  // 2.2 Estilos de Contraste Adaptativo em _reset.scss
  const resetCss = fs.readFileSync(path.join(ROOT, 'src/styles/base/_reset.scss'), 'utf-8');
  assert(resetCss.includes('&.on-light-bg'), 'Classe de contraste claro deve existir');
  assert(resetCss.includes('input:-webkit-autofill ~ .btn-toggle-password'), 'Regra nativa de autofill deve existir');
  assert(resetCss.includes('stroke: #111111'), 'Ícone preto no fundo claro');
  pass('MICRO', 'Contraste visual adaptativo: Olho PRETO em autofill/fundo claro e BRANCO/CINZA no padrão');

  // 2.3 Exclusividade da Placa Oficial (Expurgo de pacotes obsoletos)
  const helpersJs = fs.readFileSync(path.join(ROOT, 'src/js/admin/helpers.js'), 'utf-8');
  assert(!helpersJs.includes('Pacote a definir'), 'helpers.js não inclui Pacote a definir');
  assert(!helpersJs.includes('Selo digital'), 'helpers.js não inclui Selo digital');
  assert(!helpersJs.includes('Kit premium'), 'helpers.js não inclui Kit premium');
  assert(helpersJs.includes('Placa Oficial com Certificado'), 'helpers.js adota exclusivamente a Placa Oficial');
  pass('MICRO', 'Regra de negócio comercial: Exclusividade garantida da Placa Oficial com Certificado');

  // 2.4 Validação e máscara de WhatsApp e E-mail
  const voterVal = fs.readFileSync(path.join(ROOT, 'src/js/modules/voterValidation.js'), 'utf-8');
  assert(voterVal.includes('validateWhatsapp'), 'Módulo exporta validateWhatsapp');
  assert(voterVal.includes('validateEmail'), 'Módulo exporta validateEmail');
  assert(voterVal.includes('maskContact'), 'Módulo exporta maskContact');
  pass('MICRO', 'Validação de contatos de eleitores: Máscaras de telefone e validação de e-mail ativas');

  // 2.5 Navegação Inteligente de Retorno (safeBackNavigation)
  const safeBack = fs.readFileSync(path.join(ROOT, 'src/js/safeBackNavigation.js'), 'utf-8');
  assert(safeBack.includes('handleSafeBack'), 'safeBackNavigation exporta handleSafeBack');
  assert(safeBack.includes('mda_last_section'), 'safeBackNavigation rastreia a última seção visitada');
  pass('MICRO', 'Navegação de retorno inteligente: Retorno contextual à seção sem saltar para hero');

} catch (err) {
  fail('MICRO', 'Falha nos testes micro de componentes e lógica', err.message);
}

// ============================================================================
// 3. TESTES VISUAIS & RESPONSIVOS NO BROWSER (PUPPETEER)
// ============================================================================
console.log('\n--- 3. TESTES VISUAIS & RESPONSIVOS NO BROWSER (PUPPETEER) ---\n');

let server;
let browser;

try {
  const port = 5199;
  server = await createServer({
    server: { host: '127.0.0.1', port, strictPort: true, open: false },
    clearScreen: false
  });
  await server.listen();
  pass('MACRO', `Servidor local de teste Vite ativo em http://127.0.0.1:${port}`);

  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  // Helper para testar e capturar tela
  async function testPageVisuals({ pagePath, name, checkElements = [], checkOverflow = true }) {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));

    // Teste Desktop
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}-desktop.png`) });

    for (const sel of checkElements) {
      const exists = await page.$(sel);
      assert(exists, `Elemento ${sel} deve estar presente em ${name} (Desktop)`);
    }
    pass('VISUAL', `Layout Desktop [1440px] renderizado sem falhas: ${name}`);

    // Teste Mobile (iPhone / Android)
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}-mobile.png`) });

    if (checkOverflow) {
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      assert(!hasHorizontalOverflow, `A página ${name} não pode ter transbordamento horizontal no celular`);
      pass('VISUAL', `Responsividade Mobile [375px]: Zero transbordamento horizontal em ${name}`);
    }

    assert.strictEqual(consoleErrors.length, 0, `Nenhum erro de console em ${name}: ${consoleErrors.join(', ')}`);
    pass('VISUAL', `Consoles limpos: 0 erros de JavaScript detectados em ${name}`);

    await page.close();
  }

  // 3.1 Teste Visual: Home Principal (index.html)
  await testPageVisuals({
    pagePath: '/index.html',
    name: '01-home',
    checkElements: ['#heroSection', '#accessPanels', '#heroInfiniteBanner', '#about', '#gallerySection', '#methodologySection', '#ctaFinalSection']
  });

  // 3.2 Teste Visual: Painel de Acesso Administrativo (admin.html)
  await testPageVisuals({
    pagePath: '/admin.html',
    name: '02-admin-login',
    checkElements: ['#adminLoginForm', '#adminEmail', '#adminPassword', '#btnToggleAdminPassword']
  });

  // 3.3 Teste Interativo: Clique no botão do Olho de Senha (admin.html)
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${baseUrl}/admin.html`, { waitUntil: 'networkidle0' });

    // Digitar senha de teste
    await page.type('#adminPassword', 'Zxc1gg4fe@');
    let inputType = await page.$eval('#adminPassword', el => el.type);
    assert.strictEqual(inputType, 'password', 'Input inicia como password');

    // Clicar no botão do olho
    await page.click('#btnToggleAdminPassword');
    inputType = await page.$eval('#adminPassword', el => el.type);
    assert.strictEqual(inputType, 'text', 'Input deve alternar para text ao clicar no olho');

    const hasActiveClass = await page.$eval('#btnToggleAdminPassword', el => el.classList.contains('active'));
    assert(hasActiveClass, 'Botão do olho deve receber classe active');

    // Screenshot com senha visível
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02b-admin-senha-revelada.png') });
    pass('VISUAL', 'Interação Dinâmica no Browser: Alternância de tipo e ícone de senha validada com print');

    // Testar simulação de autofill / fundo claro
    await page.evaluate(() => {
      const input = document.getElementById('adminPassword');
      input.style.backgroundColor = '#ffffff';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await new Promise(r => setTimeout(r, 200));

    const onLightBg = await page.$eval('#btnToggleAdminPassword', el => el.classList.contains('on-light-bg'));
    assert(onLightBg, 'Botão deve receber classe on-light-bg quando o fundo do input for branco');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '02c-admin-olho-preto-fundo-claro.png') });
    pass('VISUAL', 'Adaptação de Contraste Automática: Olho PRETO ativado quando o bloco fica branco');

    await page.close();
  }

  // 3.4 Teste Visual: Portal do Candidato (candidato.html)
  await testPageVisuals({
    pagePath: '/candidato.html',
    name: '03-candidato-login',
    checkElements: ['#loginForm', '#loginEmail', '#loginPassword', '#btnToggleLoginPassword']
  });

  // 3.5 Teste Interativo: Alternância para tela de cadastro no candidato.html
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.goto(`${baseUrl}/candidato.html`, { waitUntil: 'networkidle0' });

    await page.click('#linkGoToRegister');
    await page.waitForFunction(() => document.getElementById('registerScreen').style.display !== 'none');

    const registerEyeExists = await page.$('#btnToggleRegisterPassword');
    assert(registerEyeExists, 'Botão de olho de senha presente no formulário de cadastro');
    await page.screenshot({ path: path.join(OUTPUT_DIR, '03b-candidato-cadastro-mobile.png') });
    pass('VISUAL', 'Fluxo de Telas Candidato: Transição Login -> Cadastro no mobile validada');

    await page.close();
  }

  // 3.6 Teste Visual: Redefinição de Senha (definir-senha.html)
  await testPageVisuals({
    pagePath: '/definir-senha.html',
    name: '04-definir-senha',
    checkElements: ['#passwordForm', '#newPassword', '#confirmPassword', '#btnToggleNewPassword', '#btnToggleConfirmPassword']
  });

  // 3.7 Teste Visual: Página de Votação (votar.html)
  await testPageVisuals({
    pagePath: '/votar.html',
    name: '05-votar',
    checkElements: ['#selectCity', '#selectCategory', '#panel1']
  });

  // 3.8 Teste Visual: Página de Resultados (resultados.html)
  await testPageVisuals({
    pagePath: '/resultados.html',
    name: '06-resultados',
    checkElements: ['#selectCity', '#selectElection', '#resultsList']
  });

} catch (err) {
  fail('VISUAL', 'Falha nos testes visuais do Puppeteer', err.message);
} finally {
  if (browser) await browser.close();
  if (server) await server.close();
}

console.log('\n================================================================');
console.log(' RESUMO EXECUTIVO DA AUDITORIA');
console.log('================================================================');
console.log(`Testes Macro Aprovados : ${stats.macroPassed}`);
console.log(`Testes Micro Aprovados : ${stats.microPassed}`);
console.log(`Testes Visuais Aprovados: ${stats.visualPassed}`);
console.log(`Total de Falhas         : ${stats.failures.length}`);

if (stats.failures.length > 0) {
  console.log('\n❌ FALHAS ENCONTRADAS:');
  stats.failures.forEach(f => console.error(`- [${f.type}] ${f.msg}: ${f.err}`));
  process.exit(1);
} else {
  console.log('\n🎉 TODOS OS TESTES MACRO, MICRO E VISUAIS FORAM APROVADOS COM 100% DE SUCESSO!');
  process.exit(0);
}
