import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

test('ETAPA 6 - Auditoria GOTY: Existência e Estrutura dos Skeleton Loaders', () => {
  const skeletonScssPath = path.join(projectRoot, 'src', 'styles', 'base', '_skeleton.scss');
  assert.ok(fs.existsSync(skeletonScssPath), '_skeleton.scss deve existir');

  const content = fs.readFileSync(skeletonScssPath, 'utf8');
  assert.ok(content.includes('.skeleton'), 'Deve definir classe .skeleton');
  assert.ok(content.includes('.skeleton-text'), 'Deve definir classe .skeleton-text');
  assert.ok(content.includes('.skeleton-avatar'), 'Deve definir classe .skeleton-avatar');
  assert.ok(content.includes('.skeleton-candidate-card'), 'Deve definir classe .skeleton-candidate-card');
  assert.ok(content.includes('skeletonShimmer'), 'Deve definir animação @keyframes skeletonShimmer');
  assert.ok(content.includes('rgba(212, 175, 55'), 'Deve incorporar o tom ouro oficial no shimmer');
});

test('ETAPA 6 - Auditoria GOTY: Integração no main.scss', () => {
  const mainScssPath = path.join(projectRoot, 'src', 'styles', 'main.scss');
  const content = fs.readFileSync(mainScssPath, 'utf8');
  assert.ok(
    content.includes('./base/skeleton'),
    'main.scss deve importar o módulo de skeletons'
  );
});

test('ETAPA 6 - Auditoria GOTY: Acessibilidade de Imagens em Todas as Páginas', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const imgMatches = html.match(/<img[^>]*>/gi) || [];

    for (const tag of imgMatches) {
      assert.match(
        tag,
        /alt=["'][^"']*["']/i,
        `Imagem no arquivo ${file} deve ter atributo alt para acessibilidade: ${tag}`
      );
    }
  }
});

test('ETAPA 6 - Auditoria GOTY: Zero Inline Styles em Toda a Aplicação', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    assert.strictEqual(
      /<style[\s>]/i.test(html),
      false,
      `Arquivo ${file} não pode conter tags <style> inline`
    );
  }
});

test('ETAPA 6 - Auditoria GOTY: Módulos JavaScript Modernos (type="module")', () => {
  const htmlFiles = fs.readdirSync(projectRoot).filter(f => f.endsWith('.html'));

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    const scripts = html.match(/<script[^>]*src=["']\/src\/js\/[^"']*["'][^>]*>/gi) || [];

    for (const script of scripts) {
      assert.ok(
        script.includes('type="module"'),
        `Script em ${file} deve ser ESM com type="module": ${script}`
      );
    }
  }
});

test('ETAPA 6 - Auditoria GOTY: Verificação de Segurança e Metadados SEO/OG', () => {
  const pagesWithOg = ['votar.html', 'resultados.html', 'privacidade.html', 'termos.html'];

  for (const file of pagesWithOg) {
    const html = fs.readFileSync(path.join(projectRoot, file), 'utf8');
    assert.ok(html.includes('og:title'), `${file} deve ter meta og:title`);
    assert.ok(html.includes('og:description'), `${file} deve ter meta og:description`);
    assert.ok(html.includes('og:image'), `${file} deve ter meta og:image`);
    assert.ok(html.includes('canonical'), `${file} deve ter link canonical`);
  }
});
