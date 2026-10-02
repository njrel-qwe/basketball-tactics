// Отрисовка площадки, линий, игроков и мяча на Canvas 2D.
import { COURT, Poly, Geometry, add, len, mul, pt, sub } from './geometry.js';
import { BALL_R, TOKEN_R, interpolate } from './model.js';

export const COLORS = {
  surround: '#2e4a3a',
  floor: '#e6b47f',
  paint: '#c8743e',
  lines: '#ffffff',
  home: '#1565c0',
  away: '#d32f2f',
  ink: '#1b1b1b',
  ball: '#f57c00',
  highlight: '#ffeb3b',
};

const arc = (c, r, from, to, n = 48) => {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    out.push(pt(c.x + r * Math.cos(a), c.y + r * Math.sin(a)));
  }
  return out;
};

function polyline(ctx, g, pts, flip, color, width, dash) {
  if (pts.length < 2) return;
  ctx.beginPath();
  pts.forEach((p, i) => {
    const o = g.toScreen(pt(p.x, flip ? g.length - p.y : p.y));
    i ? ctx.lineTo(o.x, o.y) : ctx.moveTo(o.x, o.y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

function halfMarkings(ctx, g, flip) {
  const w = Math.max(1.5, g.px(0.06));
  const c = COLORS.lines;
  const b = COURT.BASKET;
  const y = (v) => (flip ? g.length - v : v);

  const paint = g.rectOf(5.05, y(0), 9.95, y(5.8));
  ctx.fillStyle = COLORS.paint;
  ctx.fillRect(paint.x, paint.y, paint.w, paint.h);
  polyline(ctx, g, [pt(5.05, 0), pt(5.05, 5.8), pt(9.95, 5.8), pt(9.95, 0)], flip, c, w);
  for (const m of [1.75, 2.85, 3.7, 4.55]) {
    polyline(ctx, g, [pt(4.85, m), pt(5.05, m)], flip, c, w);
    polyline(ctx, g, [pt(9.95, m), pt(10.15, m)], flip, c, w);
  }
  polyline(ctx, g, arc(pt(7.5, 5.8), 1.8, 0, 180), flip, c, w);
  polyline(ctx, g, arc(pt(7.5, 5.8), 1.8, 180, 360), flip, c, w, [g.px(0.3), g.px(0.25)]);

  const cornerY = b.y + Math.sqrt(6.75 * 6.75 - 6.6 * 6.6);
  const ang = (Math.atan2(cornerY - b.y, 6.6) * 180) / Math.PI;
  polyline(ctx, g, [pt(0.9, 0), pt(0.9, cornerY)], flip, c, w);
  polyline(ctx, g, [pt(14.1, 0), pt(14.1, cornerY)], flip, c, w);
  polyline(ctx, g, arc(b, 6.75, ang, 180 - ang, 64), flip, c, w);

  polyline(ctx, g, arc(b, 1.25, 0, 180), flip, c, w);
  polyline(ctx, g, [pt(6.6, 1.2), pt(8.4, 1.2)], flip, c, Math.max(2.5, g.px(0.1)));
  polyline(ctx, g, [pt(7.5, 1.2), pt(7.5, 1.35)], flip, COLORS.ball, w);
  polyline(ctx, g, arc(b, 0.225, 0, 360, 24), flip, COLORS.ball, Math.max(2, g.px(0.07)));
}

export function drawCourt(ctx, g) {
  const r = g.boardRect;
  ctx.fillStyle = COLORS.surround;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const floor = g.rectOf(0, 0, COURT.WIDTH, g.length);
  ctx.fillStyle = COLORS.floor;
  ctx.fillRect(floor.x, floor.y, floor.w, floor.h);

  halfMarkings(ctx, g, false);
  if (g.court === 'full') halfMarkings(ctx, g, true);

  const w = Math.max(1.5, g.px(0.06));
  polyline(ctx, g, [pt(0, 14), pt(15, 14)], false, COLORS.lines, w);
  polyline(ctx, g, arc(pt(7.5, 14), 1.8, g.court === 'full' ? 0 : 180, 360), false, COLORS.lines, w);
  polyline(ctx, g, [pt(0, 0), pt(15, 0), pt(15, g.length), pt(0, g.length), pt(0, 0)], false, COLORS.lines, w * 1.4);
}

// ---------- Линии ----------

function smoothPath(ctx, g, pts) {
  const o = pts.map((p) => g.toScreen(p));
  ctx.beginPath();
  ctx.moveTo(o[0].x, o[0].y);
  if (o.length === 2) { ctx.lineTo(o[1].x, o[1].y); return; }
  for (let i = 1; i < o.length - 1; i++) {
    const mx = (o[i].x + o[i + 1].x) / 2, my = (o[i].y + o[i + 1].y) / 2;
    ctx.quadraticCurveTo(o[i].x, o[i].y, mx, my);
  }
  ctx.lineTo(o[o.length - 1].x, o[o.length - 1].y);
}

function arrowHead(ctx, g, tip, dir, color, size = 0.5) {
  const n = pt(-dir.y, dir.x);
  const base = sub(tip, mul(dir, size));
  const a = g.toScreen(tip), b = g.toScreen(add(base, mul(n, size * 0.5))), c = g.toScreen(sub(base, mul(n, size * 0.5)));
  ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** Обрезка концов, чтобы линия не заходила под фишки. */
function trimmed(line, tokens) {
  const pts = line.points;
  const total = Poly.length(pts);
  let start = 0, end = total;
  const first = pts[0], last = pts[pts.length - 1];
  let nearest = null, nd = Infinity;
  for (const t of tokens) { const d = Math.hypot(t.x - first.x, t.y - first.y); if (d < nd) { nd = d; nearest = t; } }
  if (nearest && nd < TOKEN_R) start = TOKEN_R + 0.05 - nd;
  nearest = null; nd = Infinity;
  for (const t of tokens) {
    if (t.id === line.from) continue;
    const d = Math.hypot(t.x - last.x, t.y - last.y);
    if (d < nd) { nd = d; nearest = t; }
  }
  if (nearest && nd < TOKEN_R + 0.1) end = total - (TOKEN_R + 0.12 - nd);
  return end - start > 0.3 ? Poly.slice(pts, start, end) : pts;
}

export function lineColor(line, tokens) {
  const from = tokens.find((t) => t.id === line.from);
  return from?.team === 'away' ? COLORS.away : COLORS.ink;
}

export function drawLine(ctx, g, line, tokens, alpha = 1) {
  if (line.points.length < 2) return;
  const pts = trimmed(line, tokens);
  if (pts.length < 2) return;
  const color = lineColor(line, tokens);
  const width = Math.max(2.5, g.px(0.09));
  const total = Poly.length(pts);
  const dir = Poly.endDir(pts, 0.4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const body = Poly.slice(pts, 0, Math.max(0, total - 0.3));
  const bodyPts = body.length >= 2 ? body : pts;

  if (line.type === 'move') {
    smoothPath(ctx, g, bodyPts); ctx.stroke();
    arrowHead(ctx, g, pts[pts.length - 1], dir, color);
  } else if (line.type === 'pass') {
    ctx.setLineDash([g.px(0.35), g.px(0.22)]);
    ctx.lineCap = 'butt';
    smoothPath(ctx, g, bodyPts); ctx.stroke();
    ctx.setLineDash([]);
    arrowHead(ctx, g, pts[pts.length - 1], dir, color);
  } else if (line.type === 'dribble') {
    const waveEnd = Math.max(0, total - 0.6);
    const wave = [];
    for (let d = 0; d <= waveEnd; d += 0.08) {
      const p = Poly.pointAt(pts, d);
      const ahead = Poly.pointAt(pts, d + 0.05);
      const tv = sub(ahead, p);
      const l = len(tv) || 1;
      const n = pt(-tv.y / l, tv.x / l);
      wave.push(add(p, mul(n, 0.17 * Math.sin((2 * Math.PI * d) / 0.7))));
    }
    wave.push(Poly.pointAt(pts, total - 0.3));
    if (wave.length >= 2) {
      ctx.beginPath();
      wave.forEach((p, i) => { const o = g.toScreen(p); i ? ctx.lineTo(o.x, o.y) : ctx.moveTo(o.x, o.y); });
      ctx.stroke();
    }
    arrowHead(ctx, g, pts[pts.length - 1], dir, color);
  } else if (line.type === 'screen') {
    smoothPath(ctx, g, pts); ctx.stroke();
    const n = pt(-dir.y, dir.x);
    const e = pts[pts.length - 1];
    const a = g.toScreen(add(e, mul(n, 0.5))), b = g.toScreen(sub(e, mul(n, 0.5)));
    ctx.lineWidth = width * 1.4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}

// ---------- Фишки ----------

export function drawToken(ctx, g, t, highlight, minR = 0) {
  const c = g.toScreen(t);
  const r = Math.max(g.px(TOKEN_R), minR);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(c.x + r * 0.08, c.y + r * 0.12, r, 0, Math.PI * 2); ctx.fill();
  if (highlight) {
    ctx.fillStyle = COLORS.highlight;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.32, 0, Math.PI * 2); ctx.fill();
  }
  const home = t.team === 'home';
  ctx.fillStyle = home ? COLORS.home : '#ffffff';
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = home ? '#ffffff' : COLORS.away;
  ctx.lineWidth = r * (home ? 0.12 : 0.16);
  ctx.beginPath(); ctx.arc(c.x, c.y, r * (home ? 0.94 : 0.92), 0, Math.PI * 2); ctx.stroke();

  const label = t.label;
  const size = label.length <= 1 ? r * 1.2 : label.length === 2 ? r * 0.95 : r * 0.72;
  ctx.fillStyle = home ? '#ffffff' : COLORS.away;
  ctx.font = `700 ${size}px system-ui, -apple-system, Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, c.x, c.y + size * 0.05);
}

export function drawBall(ctx, g, p, highlight, minR = 0) {
  const c = g.toScreen(p);
  const r = Math.max(g.px(BALL_R), minR);
  if (highlight) {
    ctx.fillStyle = COLORS.highlight;
    ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = COLORS.ball;
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c.x - r, c.y); ctx.lineTo(c.x + r, c.y);
  ctx.moveTo(c.x, c.y - r); ctx.lineTo(c.x, c.y + r);
  ctx.stroke();
}

export const BALL_ID = '__ball__';

/**
 * Полная отрисовка доски в прямоугольнике rect.
 * opts: { next, progress, draft, highlight, dimLines }
 */
export function drawBoard(ctx, rect, court, frame, opts = {}) {
  const g = new Geometry(rect, court, opts.rotate ?? 'auto');
  drawCourt(ctx, g);
  const animating = opts.next && opts.progress > 0;
  const rs = animating ? interpolate(frame, opts.next, opts.progress) : interpolate(frame, null, 0);
  for (const l of frame.lines) drawLine(ctx, g, l, rs.tokens, animating ? 0.3 : 1);
  if (opts.draft && !animating) drawLine(ctx, g, opts.draft, rs.tokens, 0.75);
  const minR = opts.minTokenPx || 0;
  for (const t of rs.tokens) drawToken(ctx, g, t, !animating && t.id === opts.highlight, minR);
  if (rs.ball) drawBall(ctx, g, rs.ball, !animating && opts.highlight === BALL_ID, minR * 0.55);
  return g;
}

/** Миниатюра схемы в canvas (для списков). */
export function drawThumb(canvas, court, frame) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 96, h = canvas.clientHeight || 96;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = COLORS.surround;
  ctx.fillRect(0, 0, w, h);
  drawBoard(ctx, { x: 0, y: 0, w, h }, court, frame);
}
