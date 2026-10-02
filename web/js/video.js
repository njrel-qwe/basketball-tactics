// Запись анимации комбинации в видеофайл (MediaRecorder + captureStream).
import { drawBoard } from './render.js';

const BG = '#121820';
const STEP_MS = 1500;

export function videoSupported() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && !!pickMime();
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function caption(ctx, text, x, y, maxW, size, color, weight = 400) {
  ctx.font = `${weight} ${size}px system-ui, -apple-system, Roboto, sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const words = String(text).split(/\s+/);
  let line = '', row = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + row * size * 1.25);
      line = w;
      if (++row >= 2) return;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + row * size * 1.25);
}

/**
 * Проигрывает все шаги варианта и пишет их в видео.
 * Возвращает { blob, ext }. onProgress(0..1). signal.aborted — прервать.
 */
export async function recordVideo(tactic, variant, { speed = 1, onProgress, signal } = {}) {
  const mime = pickMime();
  if (!mime) throw new Error('браузер не умеет записывать видео');
  const W = 1280, H = 720;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  // Safari надёжнее пишет canvas, который находится в документе
  canvas.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');

  const frames = variant.frames;
  const step = STEP_MS / speed;
  const hold = 800 / speed;
  // временная шкала: пауза на шаге → переход → ... → финальная пауза
  const segments = [];
  frames.forEach((_, i) => {
    segments.push({ i, kind: 'hold', ms: i === 0 ? 1200 : hold });
    if (i < frames.length - 1) segments.push({ i, kind: 'move', ms: step });
  });
  segments.push({ i: frames.length - 1, kind: 'hold', ms: 1500 });
  const total = segments.reduce((s, x) => s + x.ms, 0);

  const footer = 96;
  function paint(i, progress) {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawBoard(ctx, { x: 16, y: 12, w: W - 32, h: H - footer - 12 }, tactic.court, frames[i], {
      next: frames[i + 1], progress,
    });
    const shown = progress > 0.5 ? frames[i + 1] : frames[i];
    const idx = progress > 0.5 ? i + 2 : i + 1;
    caption(ctx, `${tactic.name} · ${variant.name}`, 24, H - footer + 10, W - 220, 26, '#ffffff', 700);
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillStyle = '#ffb74d';
    ctx.textAlign = 'right';
    ctx.fillText(`Шаг ${idx}/${frames.length}`, W - 24, H - footer + 12);
    if (shown?.note) caption(ctx, shown.note, 24, H - footer + 44, W - 48, 20, '#d0d6dd');
  }

  paint(0, 0);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });
  rec.start(250);

  const start = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      if (signal?.aborted) return resolve();
      let t = now - start;
      if (t >= total) { paint(frames.length - 1, 0); return resolve(); }
      onProgress?.(t / total);
      for (const seg of segments) {
        if (t < seg.ms) {
          paint(seg.i, seg.kind === 'move' ? ease(t / seg.ms) : 0);
          break;
        }
        t -= seg.ms;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // последний кадр должен попасть в запись
  await new Promise((r) => setTimeout(r, 300));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((tr) => tr.stop());
  canvas.remove();
  if (signal?.aborted) return null;
  const type = mime.split(';')[0];
  return { blob: new Blob(chunks, { type }), ext: type === 'video/mp4' ? 'mp4' : 'webm' };
}

/** Отдать видео: меню «Поделиться» (там «Сохранить видео») или скачивание. */
export async function shareVideo({ blob, ext }, name) {
  const file = new File([blob], `${name}.${ext}`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
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
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}
