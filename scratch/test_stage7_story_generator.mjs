import assert from 'node:assert/strict';
import { renderStoryCardToCanvas } from '../src/js/modules/storyCardGenerator.js';

console.log('=== INICIANDO SUÍTE DE TESTES: ETAPA 7 - GERADOR DE STORIES 9:16 ===');

class MockCanvasRenderingContext2D {
  constructor() {
    this.commands = [];
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = 'left';
    this.letterSpacing = '';
  }

  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return {
      addColorStop: (offset, color) => {
        this.commands.push({ type: 'radialGradientColor', offset, color });
      }
    };
  }

  createLinearGradient(x0, y0, x1, y1) {
    return {
      addColorStop: (offset, color) => {
        this.commands.push({ type: 'linearGradientColor', offset, color });
      }
    };
  }

  fillRect(x, y, w, h) {
    this.commands.push({ type: 'fillRect', x, y, w, h });
  }

  strokeRect(x, y, w, h) {
    this.commands.push({ type: 'strokeRect', x, y, w, h });
  }

  fillText(text, x, y) {
    this.commands.push({ type: 'fillText', text, x, y });
  }

  beginPath() {
    this.commands.push({ type: 'beginPath' });
  }

  moveTo(x, y) {
    this.commands.push({ type: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.commands.push({ type: 'lineTo', x, y });
  }

  roundRect(x, y, w, h, r) {
    this.commands.push({ type: 'roundRect', x, y, w, h, r });
  }

  fill() {
    this.commands.push({ type: 'fill' });
  }

  stroke() {
    this.commands.push({ type: 'stroke' });
  }

  measureText(text) {
    // Simula largura proporcional aos caracteres
    return { width: text.length * 20 };
  }
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this.ctx = new MockCanvasRenderingContext2D();
  }

  getContext(type) {
    if (type === '2d') return this.ctx;
    return null;
  }
}

// TESTE 1: Resolução estrita 1080x1920 (Instagram Stories 9:16)
{
  const canvas = new MockCanvas();
  renderStoryCardToCanvas(canvas, {
    candidateName: 'Padaria Central Bom Jardim',
    categoryName: 'Melhor Panificadora & Confeitaria',
    cityName: 'Bom Jardim – MG',
    year: '2026'
  });

  assert.equal(canvas.width, 1080, 'A largura do canvas deve ser exatamente 1080px');
  assert.equal(canvas.height, 1920, 'A altura do canvas deve ser exatamente 1920px');
  console.log('✔ Teste 1 Aprovado: Dimensões estritas 1080x1920 (Stories 9:16).');
}

// TESTE 2: Verificação dos textos cruciais da premiação
{
  const canvas = new MockCanvas();
  renderStoryCardToCanvas(canvas, {
    candidateName: 'Supermercado Progresso de Minas',
    categoryName: 'Melhor Supermercado & Hipermercado',
    cityName: 'Bom Jardim – MG',
    year: '2026'
  });

  const filledTexts = canvas.ctx.commands
    .filter(c => c.type === 'fillText')
    .map(c => c.text);

  assert.ok(filledTexts.includes('PRÊMIO OFICIAL DE EXCELÊNCIA'), 'Deve conter o título oficial do prêmio');
  assert.ok(filledTexts.includes('MELHORES DO ANO'), 'Deve conter MELHORES DO ANO');
  assert.ok(filledTexts.includes('BOM JARDIM – MG • 2026'), 'Deve conter a cidade e ano formatados');
  assert.ok(filledTexts.includes('ESTAMOS CONCORRENDO AO PRÊMIO NA CATEGORIA:'), 'Deve conter chamada de concorrência');
  assert.ok(filledTexts.includes('MELHOR SUPERMERCADO & HIPERMERCADO'), 'Deve conter o nome da categoria em uppercase');
  assert.ok(filledTexts.includes('VOTE AGORA NO SITE OFICIAL'), 'Deve conter o Call to Action');
  assert.ok(filledTexts.includes('melhores-do-ano-chi.vercel.app'), 'Deve conter a URL do portal oficial');
  console.log('✔ Teste 2 Aprovado: Todos os textos institucionais e metadados renderizados.');
}

// TESTE 3: Quebra de linhas inteligente para candidatos com nomes extensos
{
  const canvas = new MockCanvas();
  const longName = 'Clinica Veterinaria e Pet Shop Especializado Bom Jardim de Minas';
  renderStoryCardToCanvas(canvas, {
    candidateName: longName,
    categoryName: 'Pet Shop',
    cityName: 'Bom Jardim – MG',
    year: '2026'
  });

  const namePieces = canvas.ctx.commands
    .filter(c => c.type === 'fillText' && longName.includes(c.text))
    .map(c => c.text);

  assert.ok(namePieces.length >= 2, 'Candidato com nome extenso deve ser dividido em múltiplas linhas sem estourar o card');
  console.log('✔ Teste 3 Aprovado: Quebra inteligente de linhas em nomes extensos.');
}

// TESTE 4: Resistência a parâmetros nulos ou indefinidos
{
  const canvas = new MockCanvas();
  renderStoryCardToCanvas(canvas, {}); // Valores default
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 1920);

  const resNull = renderStoryCardToCanvas(null, {});
  assert.equal(resNull, null, 'Deve retornar null com segurança se canvas não for fornecido');
  console.log('✔ Teste 4 Aprovado: Resiliência a entradas vazias e fallbacks default.');
}

console.log('=================================================================');
console.log('🏆 100% DOS TESTES DA ETAPA 7 (STORIES GENERATOR) APROVADOS (4/4)!');
console.log('=================================================================');
