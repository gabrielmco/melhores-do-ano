// ============================================================================
// PROJETOS MELHORES DO ANO - GERADOR DE CARDS PARA INSTAGRAM STORIES
// Criação de artes em alta resolução (1080x1920 - 9:16) via HTML5 Canvas
// Totalmente responsivo e blindado contra estouro de texto fora da moldura
// ============================================================================

function drawFittedText(ctx, text, x, y, maxW, {
  baseSize = 42,
  minSize = 22,
  weight = '700',
  family = '"Plus Jakarta Sans", sans-serif',
  color = '#ffffff',
  letterSpacing = '0px',
  align = 'center'
} = {}) {
  ctx.save();
  ctx.letterSpacing = letterSpacing;
  ctx.textAlign = align;
  ctx.fillStyle = color;

  let currentSize = baseSize;
  ctx.font = `${weight} ${currentSize}px ${family}`;
  while (ctx.measureText(text).width > maxW && currentSize > minSize) {
    currentSize -= 2;
    ctx.font = `${weight} ${currentSize}px ${family}`;
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawMultilineCentered(ctx, text, centerX, centerY, maxW, {
  baseSize = 64,
  minSize = 34,
  weight = '800',
  family = '"Plus Jakarta Sans", sans-serif',
  color = '#ffffff',
  lineHeightRatio = 1.2
} = {}) {
  ctx.save();
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;

  let fontSize = baseSize;
  let lines = [];

  function splitIntoLines(size) {
    ctx.font = `${weight} ${size}px ${family}`;
    const words = String(text || '').trim().split(/\s+/);
    const result = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > maxW && currentLine) {
        result.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) result.push(currentLine);
    return result;
  }

  lines = splitIntoLines(fontSize);
  while (lines.some(l => ctx.measureText(l).width > maxW) && fontSize > minSize) {
    fontSize -= 2;
    lines = splitIntoLines(fontSize);
  }

  const lineHeight = fontSize * lineHeightRatio;
  const totalHeight = lines.length * lineHeight;
  const startY = centerY - (totalHeight / 2) + (fontSize * 0.85);

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + (index * lineHeight));
  });

  ctx.restore();
}

export function renderStoryCardToCanvas(canvas, {
  candidateName = 'Empresa Participante',
  categoryName = 'Categoria Oficial',
  cityName = 'Bom Jardim – MG',
  year = '2026'
}) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = 1080;
  const height = 1920;
  canvas.width = width;
  canvas.height = height;

  const safeW = 860; // Largura útil máxima centralizada entre X=110 e X=970
  const centerX = width / 2;

  // 1. Fundo Gradiente Luxury Dark
  const bgGrad = ctx.createRadialGradient(centerX, height / 2, 80, centerX, height / 2, 1150);
  bgGrad.addColorStop(0, '#1c1a16');
  bgGrad.addColorStop(0.5, '#0d0d10');
  bgGrad.addColorStop(1, '#050506');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Borda Dupla Dourada Decorativa
  ctx.strokeStyle = '#d4af37';
  ctx.lineWidth = 6;
  ctx.strokeRect(40, 40, width - 80, height - 80);

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(56, 56, width - 112, height - 112);

  // Cantoneiras decorativas douradas
  const cornerSize = 44;
  ctx.fillStyle = '#f5d788';
  // Top-left
  ctx.fillRect(40, 40, cornerSize, 6);
  ctx.fillRect(40, 40, 6, cornerSize);
  // Top-right
  ctx.fillRect(width - 40 - cornerSize, 40, cornerSize, 6);
  ctx.fillRect(width - 46, 40, 6, cornerSize);
  // Bottom-left
  ctx.fillRect(40, height - 46, cornerSize, 6);
  ctx.fillRect(40, height - 40 - cornerSize, 6, cornerSize);
  // Bottom-right
  ctx.fillRect(width - 40 - cornerSize, height - 46, cornerSize, 6);
  ctx.fillRect(width - 46, height - 40 - cornerSize, 6, cornerSize);

  // 3. Estrelas do Topo
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 76px serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ ★ ★', centerX, 190);

  // 4. Cabeçalho do Evento (Fitted Text para nunca cortar)
  drawFittedText(ctx, 'PRÊMIO OFICIAL DE EXCELÊNCIA', centerX, 260, safeW, {
    baseSize: 32,
    minSize: 22,
    weight: '700',
    color: '#f5d788',
    letterSpacing: '3px'
  });

  drawFittedText(ctx, 'MELHORES DO ANO', centerX, 360, safeW, {
    baseSize: 84,
    minSize: 52,
    weight: '900',
    color: '#ffffff',
    letterSpacing: '1px'
  });

  drawFittedText(ctx, `${cityName.toUpperCase()} • ${year}`, centerX, 440, safeW, {
    baseSize: 42,
    minSize: 28,
    weight: '700',
    color: '#d4af37'
  });

  // Linha divisória dourada
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(centerX - 240, 490);
  ctx.lineTo(centerX + 240, 490);
  ctx.stroke();

  // 5. Chamada de Indicação e Categoria (Ajustadas com segurança)
  drawFittedText(ctx, 'ESTAMOS CONCORRENDO AO PRÊMIO NA CATEGORIA:', centerX, 580, safeW, {
    baseSize: 32,
    minSize: 22,
    weight: '600',
    color: 'rgba(255, 255, 255, 0.85)'
  });

  drawMultilineCentered(ctx, categoryName.toUpperCase(), centerX, 680, safeW, {
    baseSize: 52,
    minSize: 32,
    weight: '800',
    color: '#f5d788'
  });

  // 6. Card Central do Candidato
  const cardY = 780;
  const cardH = 390;
  const cardW = safeW;
  const cardX = (width - cardW) / 2;

  // Fundo suave e borda dourada com cantos arredondados
  ctx.fillStyle = 'rgba(212, 175, 55, 0.05)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(cardX, cardY, cardW, cardH, 16);
  } else {
    ctx.rect(cardX, cardY, cardW, cardH);
  }
  ctx.fill();

  ctx.strokeStyle = 'rgba(212, 175, 55, 0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Nome do Candidato Perfeitamente Centralizado e Quebrado dentro do Card
  drawMultilineCentered(ctx, candidateName, centerX, cardY + (cardH / 2), cardW - 80, {
    baseSize: 66,
    minSize: 34,
    weight: '800',
    color: '#ffffff',
    lineHeightRatio: 1.15
  });

  // 7. Chamada de Votação (Call To Action)
  drawFittedText(ctx, 'VOTE AGORA NO SITE OFICIAL', centerX, 1270, safeW, {
    baseSize: 50,
    minSize: 32,
    weight: '800',
    color: '#ffffff'
  });

  drawFittedText(ctx, 'Sua escolha é fundamental para nosso reconhecimento!', centerX, 1340, safeW, {
    baseSize: 32,
    minSize: 20,
    weight: '500',
    color: 'rgba(255, 255, 255, 0.78)'
  });

  // Botão Estilo Sticker dos Stories
  const btnW = 760;
  const btnH = 110;
  const btnX = (width - btnW) / 2;
  const btnY = 1420;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#f5d788');
  btnGrad.addColorStop(1, '#d4af37');
  ctx.fillStyle = btnGrad;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(btnX, btnY, btnW, btnH, 55);
  } else {
    ctx.rect(btnX, btnY, btnW, btnH);
  }
  ctx.fill();

  drawFittedText(ctx, 'CLIQUE NO LINK DOS STORIES PARA VOTAR', centerX, btnY + 68, btnW - 60, {
    baseSize: 32,
    minSize: 22,
    weight: '800',
    color: '#070708'
  });

  // Dica da figurinha de link no Instagram
  drawFittedText(ctx, 'Use a figurinha de link do Instagram direcionando para o site oficial', centerX, 1580, safeW, {
    baseSize: 26,
    minSize: 18,
    weight: '400',
    color: 'rgba(255, 255, 255, 0.55)'
  });

  // 8. Rodapé Oficial
  drawFittedText(ctx, 'Votação Popular Auditada • Empório Excelência Oficial', centerX, 1780, safeW, {
    baseSize: 28,
    minSize: 18,
    weight: '400',
    color: 'rgba(255, 255, 255, 0.45)'
  });

  return canvas;
}

export function generateStoryCardBlob(candidateInfo) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof document === 'undefined') {
        return resolve(null);
      }
      const canvas = document.createElement('canvas');
      renderStoryCardToCanvas(canvas, candidateInfo);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    } catch (e) {
      reject(e);
    }
  });
}

export async function downloadStoryCard(candidateInfo) {
  if (typeof document === 'undefined') return;
  const blob = await generateStoryCardBlob(candidateInfo);
  if (!blob) return;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = (candidateInfo.candidateName || 'candidato').toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.href = url;
  a.download = `story_voto_${safeName}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
