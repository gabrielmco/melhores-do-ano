import fs from 'node:fs';
import path from 'node:path';

const pages = [
  'index.html',
  'votar.html',
  'resultados.html',
  'candidato.html',
  'comercial.html',
  'portal.html',
  'admin.html',
  'termos.html',
  'privacidade.html'
];

let hasError = false;

for (const page of pages) {
  if (!fs.existsSync(page)) {
    console.error(`${page}: arquivo não encontrado`);
    hasError = true;
    continue;
  }

  const html = fs.readFileSync(page, 'utf8');
  const ids = new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map((match) => match[1]));
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map((match) => match[1]);

  if (/\son[a-z]+\s*=/i.test(html)) {
    console.error(`${page}: manipulador JavaScript inline incompatível com a CSP`);
    hasError = true;
  }

  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter((match) => match[1].trim());
  if (inlineScripts.length > 0) {
    console.error(`${page}: script inline incompatível com a CSP`);
    hasError = true;
  }

  for (const ref of refs) {
    if (ref === '#') {
      console.error(`${page}: link placeholder href="#" encontrado`);
      hasError = true;
      continue;
    }

    if (ref.startsWith('#')) {
      const anchor = ref.slice(1);
      if (anchor && !ids.has(anchor)) {
        console.error(`${page}: âncora ausente ${ref}`);
        hasError = true;
      }
      continue;
    }

    if (!ref.startsWith('/') || ref.startsWith('//')) {
      continue;
    }

    const cleanRef = ref.split('#')[0].split('?')[0];
    if (!cleanRef || cleanRef === '/') {
      continue;
    }

    const candidates = [];
    if (cleanRef.startsWith('/assets/')) {
      candidates.push(path.join('public', cleanRef.slice(1)));
    }
    candidates.push(cleanRef.slice(1));

    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      console.error(`${page}: asset/página não encontrado ${ref}`);
      hasError = true;
    }
  }
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

const sourceFiles = [
  ...walkFiles('src').filter((file) => /\.(?:js|scss|css)$/.test(file)),
  ...pages
];

for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  const assetRefs = [
    ...source.matchAll(/["'`](\/assets\/[^"'`?#]+)["'`]/g)
  ].map((match) => match[1]);

  for (const assetRef of assetRefs) {
    const assetPath = path.join('public', assetRef.slice(1));
    if (!fs.existsSync(assetPath)) {
      console.error(`${sourceFile}: asset não encontrado ${assetRef}`);
      hasError = true;
    }
  }
}

if (hasError) {
  process.exit(1);
}

console.log('Links, âncoras e assets obrigatórios verificados com sucesso.');
