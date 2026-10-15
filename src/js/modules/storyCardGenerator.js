// ============================================================================
// PROJETOS MELHORES DO ANO - GERADOR DE CARDS PARA INSTAGRAM STORIES
// Criação de artes em alta resolução (1080x1920 - 9:16) via HTML5 Canvas
// ============================================================================

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

  // 1. Fundo Gradiente Luxury Dark
  const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 1100);
  bgGrad.addColorStop(0, '#1c1b17');
  bgGrad.addColorStop(0.5, '#0e0e11');
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
  const cornerSize = 40;
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

  // 3. Selo / Ícone Superior
  ctx.fillStyle = '#d4af37';
  ctx.font = 'bold 84px serif';
  ctx.textAlign = 'center';
  ctx.fillText('★ ★ ★', width / 2, 220);

  // 4. Título do Evento
  ctx.font = 'bold 42px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f5d788';
  ctx.letterSpacing = '6px';
  ctx.fillText('PRÊMIO OFICIAL DE EXCELÊNCIA', width / 2, 320);

  ctx.font = '800 88px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`MELHORES DO ANO`, width / 2, 420);

  ctx.font = '600 48px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#d4af37';
  ctx.fillText(`${cityName.toUpperCase()} • ${year}`, width / 2, 500);

  // Linha divisória
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 250, 560);
  ctx.lineTo(width / 2 + 250, 560);
  ctx.stroke();

  // 5. Chamada de Indicação
  ctx.font = '600 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.fillText('ESTAMOS CONCORRENDO AO PRÊMIO NA CATEGORIA:', width / 2, 700);

  // Categoria
  ctx.font = 'bold 54px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f5d788';
  ctx.fillText(categoryName.toUpperCase(), width / 2, 780);

  // 6. Card Central do Candidato
  const cardY = 880;
  const cardH = 380;
  const cardW = width - 200;
  const cardX = (width - cardW) / 2;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  // Nome do Candidato
  ctx.font = '800 72px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  
  // Quebra de linha inteligente se o nome for longo
  const maxCardTextW = cardW - 60;
  const words = candidateName.split(' ');
  let line = '';
  let lines = [];
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxCardTextW && n > 0) {
      lines.push(line.trim());
      line = words[n] + ' ';
    } else {
      line = testLine;
    }
  }
  lines.push(line.trim());

  const startY = cardY + (cardH / 2) - ((lines.length - 1) * 40);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], width / 2, startY + (i * 80));
  }

  // 7. Chamada de Votação (Call To Action)
  ctx.font = '700 52px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('VOTE AGORA NO SITE OFICIAL', width / 2, 1420);

  ctx.font = '400 38px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText('Sua escolha é fundamental para nosso reconhecimento!', width / 2, 1490);

  // Botão visual / Badge
  const btnW = 680;
  const btnH = 110;
  const btnX = (width - btnW) / 2;
  const btnY = 1580;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX + btnW, btnY + btnH);
  btnGrad.addColorStop(0, '#f5d788');
  btnGrad.addColorStop(1, '#d4af37');
  ctx.fillStyle = btnGrad;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 16);
  ctx.fill();

  ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#070708';
  ctx.fillText('melhores-do-ano-chi.vercel.app', width / 2, btnY + 70);

  // Rodapé
  ctx.font = '400 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Votação Popular Auditada • Empório Excelência Oficial', width / 2, 1820);

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
