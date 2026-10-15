import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

test('ETAPA 4 - Auditoria de Zero Estilos Inline nos Documentos HTML', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.html'));
  assert.ok(htmlFiles.length >= 8, 'Deve haver ao menos 8 páginas HTML na raiz');

  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const hasStyleTag = /<style[\s>]/i.test(content);
    assert.strictEqual(
      hasStyleTag,
      false,
      `O arquivo ${file} não deve conter nenhuma tag <style> inline (deve usar main.scss)`
    );
  }
});

test('ETAPA 4 - Vínculo Obrigatório com Folha Central main.scss em todos os HTMLs', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const content = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const hasMainScss = content.includes('/src/styles/main.scss');
    assert.strictEqual(
      hasMainScss,
      true,
      `O arquivo ${file} deve importar <link rel="stylesheet" href="/src/styles/main.scss">`
    );
  }
});

test('ETAPA 4 - Auditoria da Árvore Modular SCSS em src/styles/main.scss', () => {
  const mainScssPath = path.join(projectRoot, 'src', 'styles', 'main.scss');
  assert.ok(fs.existsSync(mainScssPath), 'main.scss deve existir');

  const mainScssContent = fs.readFileSync(mainScssPath, 'utf8');

  const requiredPartials = [
    './abstracts/variables',
    './base/reset',
    './base/toast',
    './base/modal',
    './sections/navbar',
    './sections/hero',
    './sections/access-panels',
    './sections/about',
    './sections/gallery',
    './sections/methodology',
    './sections/cta',
    './sections/footer',
    './sections/portal',
    './sections/votar',
    './sections/admin',
    './sections/resultados',
    './sections/institutional'
  ];

  for (const partial of requiredPartials) {
    assert.ok(
      mainScssContent.includes(partial),
      `main.scss deve importar o partial "${partial}"`
    );
  }
});

test('ETAPA 4 - Validação de Acessibilidade WCAG AA (Foco Visível e Área de Toque)', () => {
  const resetScssPath = path.join(projectRoot, 'src', 'styles', 'base', '_reset.scss');
  const resetContent = fs.readFileSync(resetScssPath, 'utf8');

  // Foco visível com anel dourado
  assert.ok(
    resetContent.includes(':focus-visible'),
    '_reset.scss deve definir regras para :focus-visible'
  );
  assert.ok(
    resetContent.includes('$color-gold') || resetContent.includes('#d4af37'),
    ':focus-visible deve usar a cor ouro oficial de alto contraste'
  );

  // Ergonomia mobile (área mínima de 44px)
  assert.ok(
    resetContent.includes('44px'),
    '_reset.scss deve garantir min-height: 44px para botões e controles de toque'
  );
  assert.ok(
    resetContent.includes('touch-action: manipulation'),
    '_reset.scss deve desativar double-tap zoom com touch-action: manipulation'
  );
});

test('ETAPA 4 - Semântica de Documento e Acessibilidade em Páginas Institucionais', () => {
  const institucionalPages = ['privacidade.html', 'termos.html'];

  for (const page of institucionalPages) {
    const content = fs.readFileSync(path.join(projectRoot, page), 'utf8');
    assert.ok(
      content.includes('<main class="institutional-main">'),
      `${page} deve conter <main class="institutional-main">`
    );
    assert.ok(
      content.includes('<h1>'),
      `${page} deve conter título principal h1 semântico`
    );
  }
});
