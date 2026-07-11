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

if (hasError) {
  process.exit(1);
}

console.log('Links, âncoras e assets obrigatórios verificados com sucesso.');
