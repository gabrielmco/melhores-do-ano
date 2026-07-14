import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';
import { createServer } from 'vite';

const port = 4174;
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotDir = path.join(process.cwd(), 'test-results');
const screenshots = {
  homeDesktop: path.join(screenshotDir, 'home-paineis-desktop.png'),
  homeHover: path.join(screenshotDir, 'home-paineis-hover-desktop.png'),
  homeMobile: path.join(screenshotDir, 'home-paineis-mobile.png'),
  vote: path.join(screenshotDir, 'voto-verificado.png'),
  admin: path.join(screenshotDir, 'admin-verificado.png'),
  commercial: path.join(screenshotDir, 'comercial-verificado.png')
};

const server = await createServer({
  server: { host: '127.0.0.1', port, strictPort: true, open: false },
  clearScreen: false
});
let browser;
const failures = [];

async function createPage() {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => failures.push(`Erro no navegador: ${error.message}`));
  return page;
}

async function loginAndVerify({ pageName, email, pathName, emailSelector, passwordSelector, formSelector, dashboardSelector, userSelector, screenshot }) {
  const page = await createPage();
  await page.goto(`${baseUrl}${pathName}`, { waitUntil: 'networkidle0' });
  await page.type(emailSelector, email);
  await page.type(passwordSelector, '123456');
  await Promise.all([
    page.click(`${formSelector} button[type="submit"]`),
    page.waitForFunction((selector) => getComputedStyle(document.querySelector(selector)).display !== 'none', {}, dashboardSelector)
  ]);
  const userName = await page.$eval(userSelector, (element) => element.textContent.trim());
  if (!userName || userName === 'Carregando...') {
    throw new Error(`${pageName}: usuário não foi carregado.`);
  }
  await page.screenshot({ path: screenshot, fullPage: false });
  await page.close();
  console.log(`OK: ${pageName} autenticou como ${userName}`);
}

try {
  await server.listen();
  await fs.mkdir(screenshotDir, { recursive: true });
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const homeDesktop = await browser.newPage();
  await homeDesktop.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  await homeDesktop.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
  await homeDesktop.waitForSelector('#accessPanels .access-panel-card');
  const homeAudit = await homeDesktop.evaluate(() => ({
    cardCount: document.querySelectorAll('#accessPanels .access-panel-card').length,
    hrefs: [...document.querySelectorAll('#accessPanels .access-panel-card')].map((card) => card.getAttribute('href')),
    directlyAfterHero: document.querySelector('#heroSection')?.nextElementSibling?.id === 'accessPanels',
    hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    sectionBackground: getComputedStyle(document.querySelector('#accessPanels')).backgroundColor,
    cardBackgroundImages: [...document.querySelectorAll('#accessPanels .access-panel-card')]
      .map((card) => getComputedStyle(card).backgroundImage)
  }));
  const expectedHrefs = ['/candidato.html', '/comercial.html', '/admin.html'];
  if (homeAudit.cardCount !== 3) throw new Error(`A home exibiu ${homeAudit.cardCount} cards em vez de 3.`);
  if (JSON.stringify(homeAudit.hrefs) !== JSON.stringify(expectedHrefs)) throw new Error('Os cards não apontam para os três painéis esperados.');
  if (!homeAudit.directlyAfterHero) throw new Error('A seção dos painéis não está imediatamente após a hero.');
  if (homeAudit.hasHorizontalOverflow) throw new Error('A home possui estouro horizontal no desktop.');
  if (homeAudit.sectionBackground !== 'rgb(255, 255, 255)') throw new Error('O fundo da seção dos painéis não está branco.');
  if (homeAudit.cardBackgroundImages.some((value) => value !== 'none')) throw new Error('Um card ainda possui overlay ou gradiente de fundo.');
  await homeDesktop.click('a[href="#accessPanels"]');
  await new Promise((resolve) => setTimeout(resolve, 620));
  await homeDesktop.screenshot({ path: screenshots.homeDesktop, fullPage: false });

  const candidateSelector = '#accessPanels .access-panel-card--candidate';
  const restingTransform = await homeDesktop.$eval(candidateSelector, (card) => getComputedStyle(card).transform);
  await homeDesktop.hover(candidateSelector);
  await new Promise((resolve) => setTimeout(resolve, 520));
  const hoverTransform = await homeDesktop.$eval(candidateSelector, (card) => getComputedStyle(card).transform);
  if (hoverTransform === restingTransform) throw new Error('O hover premium não alterou a elevação do card.');
  const hoverBackgrounds = await homeDesktop.$$eval('#accessPanels .access-panel-card', (cards) =>
    cards.map((card) => getComputedStyle(card).backgroundColor)
  );
  if (hoverBackgrounds.some((value) => value === 'rgb(0, 0, 0)')) throw new Error('Um card ficou preto durante o hover.');
  await homeDesktop.screenshot({ path: screenshots.homeHover, fullPage: false });
  await homeDesktop.mouse.move(8, 8);
  await new Promise((resolve) => setTimeout(resolve, 520));
  const exitTransform = await homeDesktop.$eval(candidateSelector, (card) => getComputedStyle(card).transform);
  if (exitTransform !== restingTransform) throw new Error('O card não retornou suavemente ao estado inicial após a saída do mouse.');
  await homeDesktop.close();

  const homeMobile = await createPage();
  await homeMobile.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
  await homeMobile.waitForSelector('#accessPanels .access-panel-card');
  const mobileAudit = await homeMobile.evaluate(() => ({
    cardCount: document.querySelectorAll('#accessPanels .access-panel-card').length,
    hasHorizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  if (mobileAudit.cardCount !== 3) throw new Error(`A home mobile exibiu ${mobileAudit.cardCount} cards em vez de 3.`);
  if (mobileAudit.hasHorizontalOverflow) throw new Error('A home possui estouro horizontal no celular.');
  await homeMobile.mouse.move(6, 6);
  await homeMobile.$eval('#accessPanels', (section) => section.scrollIntoView({ block: 'start' }));
  await homeMobile.screenshot({ path: screenshots.homeMobile, fullPage: false });
  await homeMobile.close();
  console.log('OK: três painéis verificados após a hero em desktop e celular');

  const votePage = await createPage();
  await votePage.goto(`${baseUrl}/votar.html`, { waitUntil: 'networkidle0' });
  const cityId = '11111111-1111-1111-1111-111111111111';
  await votePage.waitForFunction((officialCityId) => {
    const select = document.querySelector('#selectCity');
    return select?.options.length === 1 && select.value === officialCityId && select.disabled;
  }, {}, cityId);
  await votePage.waitForFunction(() => document.querySelector('#selectCategory')?.options.length > 1);
  const categoryId = '33333333-3333-3333-3333-333333333331';
  await votePage.select('#selectCategory', categoryId);
  await votePage.click('#btnGoToStep2');
  await votePage.waitForSelector('.candidate-card');

  await votePage.click('#btnBackToStep1');
  const returnedToStepOne = await votePage.$eval('#panel1', (panel) => panel.classList.contains('active'));
  if (!returnedToStepOne) throw new Error('O botão Voltar da votação não retornou à etapa 1.');

  await votePage.click('#btnGoToStep2');
  await votePage.waitForSelector('.candidate-card');
  await votePage.click('.candidate-card');
  await votePage.click('#btnGoToStep3');
  await votePage.type('#voterName', 'Pessoa de Teste');
  await votePage.type('#voterIdentifier', '11999999999');
  await votePage.click('#privacyConsent');
  await votePage.click('#validationConsent');
  await votePage.waitForFunction(() => !document.querySelector('#btnSubmitVote')?.disabled, { timeout: 15000 });
  await votePage.click('#btnSubmitVote');
  await votePage.waitForFunction(() => document.querySelector('#panel4')?.classList.contains('active'));
  await votePage.screenshot({ path: screenshots.vote, fullPage: false });
  await votePage.close();
  console.log('OK: voto mock concluído e tela de sucesso exibida');

  await loginAndVerify({
    pageName: 'Painel administrativo',
    email: 'admin@teste.com',
    pathName: '/admin.html',
    emailSelector: '#adminEmail',
    passwordSelector: '#adminPassword',
    formSelector: '#adminLoginForm',
    dashboardSelector: '#adminDashboardLayout',
    userSelector: '#txtAdminUser',
    screenshot: screenshots.admin
  });

  await loginAndVerify({
    pageName: 'Portal comercial',
    email: 'comercial@teste.com',
    pathName: '/comercial.html',
    emailSelector: '#comercialEmail',
    passwordSelector: '#comercialPassword',
    formSelector: '#comercialLoginForm',
    dashboardSelector: '#comercialDashboardLayout',
    userSelector: '#txtComercialUser',
    screenshot: screenshots.commercial
  });

  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Screenshots: ${Object.values(screenshots).join(', ')}`);
} finally {
  if (browser) await browser.close();
  await server.close();
}
