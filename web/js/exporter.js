// Сохранение схемы картинкой: один шаг или лист со всеми шагами.
import { courtAspect } from './geometry.js';
import { drawBoard } from './render.js';

const BG = '#121820';

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  return lines;
}

function text(ctx, str, x, y, maxW, size, color, weight = 400, maxLines = 3) {
  if (!str) return 0;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Roboto, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = wrapText(ctx, str, maxW, maxLines);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * 1.3));
  return lines.length * size * 1.3;
}

export function renderStep(tactic, variant, index, width = 1440) {
  const frame = variant.frames[index];
  const pad = width * 0.04;
  const boardW = width - 2 * pad;
  const boardH = boardW / courtAspect(tactic.court);
  const header = width * 0.13;
  const noteH = frame.note ? width * 0.13 : 0;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(header + boardH + noteH + pad * 2);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, c.width, c.height);
  text(ctx, `${tactic.name} · ${variant.name}`, pad, pad, boardW, width * 0.045, '#fff', 700, 1);
  const sub = `Шаг ${index + 1} из ${variant.frames.length}` + (tactic.category ? ` · ${tactic.category}` : '');
  text(ctx, sub, pad, pad + width * 0.06, boardW, width * 0.03, '#ffb74d', 400, 1);
  drawBoard(ctx, { x: pad, y: header + pad * 0.5, w: boardW, h: boardH }, tactic.court, frame);
  text(ctx, frame.note, pad, header + boardH + pad, boardW, width * 0.032, '#fff', 400, 3);
  return c;
}

export function renderSheet(tactic, variant, width = 2000) {
  const n = variant.frames.length;
  const cols = n === 1 ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const pad = width * 0.03;
  const cellW = (width - pad * (cols + 1)) / cols;
  const boardH = cellW / courtAspect(tactic.court);
  const capSize = (width * 0.02 * 2) / cols;
  const cellH = boardH + capSize * 3.2;
  const header = width * 0.09;
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(header + rows * (cellH + pad) + pad);
  const ctx = c.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, c.width, c.height);
  text(ctx, `${tactic.name} · ${variant.name}`, pad, pad, width - 2 * pad, width * 0.035, '#fff', 700, 1);
  if (tactic.category) text(ctx, tactic.category, pad, pad + width * 0.045, width - 2 * pad, width * 0.022, '#ffb74d', 400, 1);
  variant.frames.forEach((f, i) => {
    const x = pad + (i % cols) * (cellW + pad);
    const y = header + pad + Math.floor(i / cols) * (cellH + pad);
    drawBoard(ctx, { x, y, w: cellW, h: boardH }, tactic.court, f);
    text(ctx, `${i + 1}. ${f.note || `Шаг ${i + 1}`}`, x, y + boardH + pad * 0.3, cellW, capSize, '#fff', 400, 2);
  });
  return c;
}

const fileName = (tactic) => {
  const safe = tactic.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'tactic';
  return `${safe}.png`;
};

/**
 * На телефоне открываем системное меню «Поделиться» (там есть «Сохранить изображение»),
 * иначе просто скачиваем файл.
 */
export async function shareOrDownload(canvas, tactic) {
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], fileName(tactic), { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: tactic.name });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
