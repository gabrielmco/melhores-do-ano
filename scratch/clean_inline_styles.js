import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function cleanFile(fileName, transformFn) {
  const filePath = path.join(projectRoot, fileName);
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Arquivo não encontrado: ${fileName}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const beforeLen = content.length;
  content = transformFn(content);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[OK] ${fileName} limpo com sucesso (${beforeLen} -> ${content.length} bytes)`);
}

// 1. index.html - Remover bloco de loading inline (já migrado para _reset.scss)
cleanFile('index.html', (content) => {
  return content.replace(
    /\s*<!-- Prevent FOUC\/flash on page load before GSAP initialises -->\s*<style>[\s\S]*?<\/style>/,
    ''
  );
});

// 2. admin.html - Remover tag <style> (já migrado para _admin.scss)
cleanFile('admin.html', (content) => {
  return content.replace(/\s*<style>[\s\S]*?<\/style>/, '');
});

// 3. votar.html - Remover tag <style> (já migrado para _votar.scss)
cleanFile('votar.html', (content) => {
  return content.replace(/\s*<style>[\s\S]*?<\/style>/, '');
});

// 4. comercial.html - Remover tag <style>
cleanFile('comercial.html', (content) => {
  return content.replace(/\s*<style>[\s\S]*?<\/style>/, '');
});

// 5. candidato.html - Remover tag <style>
cleanFile('candidato.html', (content) => {
  return content.replace(/\s*<style>[\s\S]*?<\/style>/, '');
});

// 6. resultados.html - Remover tag <style>
cleanFile('resultados.html', (content) => {
  return content.replace(/\s*<style>[\s\S]*?<\/style>/, '');
});

// 7. privacidade.html - Remover <style>, vincular main.scss e adicionar classe institutional-main
cleanFile('privacidade.html', (content) => {
  let res = content.replace(/\s*<style>[\s\S]*?<\/style>/, '\n  <link rel="stylesheet" href="/src/styles/main.scss">');
  res = res.replace(/<main>/, '<main class="institutional-main">');
  return res;
});

// 8. termos.html - Remover <style>, vincular main.scss e adicionar classe institutional-main
cleanFile('termos.html', (content) => {
  let res = content.replace(/\s*<style>[\s\S]*?<\/style>/, '\n  <link rel="stylesheet" href="/src/styles/main.scss">');
  res = res.replace(/<main>/, '<main class="institutional-main">');
  return res;
});

// 9. definir-senha.html - Remover <style>, vincular main.scss e envolver em auth-page-wrapper
cleanFile('definir-senha.html', (content) => {
  let res = content.replace(/\s*<style>[\s\S]*?<\/style>/, '\n  <link rel="stylesheet" href="/src/styles/main.scss">');
  res = res.replace(/<body>\s*<div class="card">/, '<body>\n  <main class="auth-page-wrapper">\n    <div class="card">');
  res = res.replace(/<\/div>\s*<script type="module"/, '</div>\n  </main>\n\n  <script type="module"');
  return res;
});

console.log('[CONCLUÍDO] Todos os arquivos HTML processados e limpos sem corrupção de encoding.');
