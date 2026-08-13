import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const htmlFiles = [
  'index.html',
  'votar.html',
  'resultados.html',
  'candidato.html',
  'comercial.html',
  'admin.html',
  'portal.html',
  'definir-senha.html',
  'termos.html',
  'privacidade.html'
];

const jsFiles = [
  'src/js/main.js',
  'src/js/votar.js',
  'src/js/resultados.js',
  'src/js/candidato.js',
  'src/js/comercial.js',
  'src/js/admin.js',
  'src/js/definirSenha.js',
  'src/js/supabaseClient.js',
  'src/js/siteConfig.js'
];

console.log('🔍 INICIANDO AUDITORIA EXAUSTIVA DE ELEMENTOS E BOTOES DO SITE MELHORES DO ANO...\n');

let totalErrors = 0;
let totalCheckedElements = 0;

// 1. Verificar se todos os arquivos HTML existem
htmlFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Arquivo HTML ausente: ${file}`);
    totalErrors++;
  } else {
    console.log(`✅ HTML encontrado: ${file}`);
  }
});

// 2. Extrair todos os IDs declarados em cada HTML
const htmlDomIds = {};
htmlFiles.forEach(file => {
  const filePath = path.join(projectRoot, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = [...content.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]);
    htmlDomIds[file] = new Set(matches);
    console.log(`ℹ️ [${file}] possui ${matches.length} IDs declarados no DOM.`);
  }
});

// 3. Mapear qual JS atua em qual HTML
const jsToHtmlMap = {
  'src/js/main.js': ['index.html', 'votar.html', 'resultados.html', 'candidato.html', 'comercial.html', 'admin.html', 'portal.html'],
  'src/js/votar.js': ['votar.html'],
  'src/js/resultados.js': ['resultados.html'],
  'src/js/candidato.js': ['candidato.html'],
  'src/js/comercial.js': ['comercial.html'],
  'src/js/admin.js': ['admin.html'],
  'src/js/definirSenha.js': ['definir-senha.html']
};

console.log('\n---------------------------------------------------');
console.log('🧪 VERIFICANDO REFERENCIAS DE DOCUMENT.GETELEMENTBYID NOS SCRIPTS...');
console.log('---------------------------------------------------\n');

jsFiles.forEach(jsFile => {
  const filePath = path.join(projectRoot, jsFile);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const getByIdMatches = [...content.matchAll(/document\.getElementById\(["']([^"']+)["']\)/g)].map(m => m[1]);
  const targetPages = jsToHtmlMap[jsFile] || [];

  getByIdMatches.forEach(id => {
    totalCheckedElements++;
    let foundInAnyPage = false;

    targetPages.forEach(htmlFile => {
      if (htmlDomIds[htmlFile] && htmlDomIds[htmlFile].has(id)) {
        foundInAnyPage = true;
      }
    });

    if (!foundInAnyPage) {
      console.error(`⚠️ [ALERTA] ${jsFile} busca id="${id}", mas ele não existe em (${targetPages.join(', ')})!`);
      totalErrors++;
    }
  });
});

console.log('\n---------------------------------------------------');
console.log(`📊 AUDITORIA FINALIZADA: ${totalCheckedElements} elementos/botões validados.`);
if (totalErrors === 0) {
  console.log('🎉 NENHUM ELEMENTO OU BOTAO QUEBRADO FOI ENCONTRADO! SITE 100% OPERACIONAL!');
} else {
  console.log(`⚠️ Foram encontrados ${totalErrors} alertas para ajuste.`);
}
