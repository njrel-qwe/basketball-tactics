// Модель данных: тактика → варианты → шаги (игроки, линии, мяч, комментарий).
import { COURT, Poly, add, dist, len, lerp, mul, pt, sub } from './geometry.js';

export const newId = () => Math.random().toString(36).slice(2, 12);
export const clone = (o) => JSON.parse(JSON.stringify(o));

export const LINE_TYPES = ['move', 'dribble', 'pass', 'screen'];
export const MOVEMENT = new Set(['move', 'dribble', 'screen']);
export const BALL_OFFSET = pt(0.5, -0.5);
export const TOKEN_R = 0.55;
export const BALL_R = 0.3;
export const CATEGORIES = ['Нападение', 'Против зоны', 'Защита', 'Розыгрыш аута', 'Быстрый прорыв', 'Другое'];

/** Стандартные позиции нападения на половине площадки. */
export const HOME_SPOTS = [
  pt(7.5, 9.0), pt(12.6, 6.4), pt(2.4, 6.4), pt(1.2, 1.3), pt(9.7, 2.6), pt(13.8, 1.3), pt(5.3, 2.6),
];

export function guardSpot(p, d = 1.1) {
  const v = sub(COURT.BASKET, p);
  const l = len(v);
  if (l < 0.01) return p;
  return add(p, mul(v, Math.min(d, l * 0.6) / l));
}

export const token = (id, team, label, p) => ({ id, team, label, x: p.x, y: p.y });

export function startingFrame(home, away) {
  const tokens = [];
  for (let i = 0; i < home; i++) tokens.push(token(`o${i + 1}`, 'home', `${i + 1}`, HOME_SPOTS[i]));
  for (let i = 0; i < away; i++) tokens.push(token(`x${i + 1}`, 'away', `X${i + 1}`, guardSpot(HOME_SPOTS[i])));
  const ball = home > 0 ? { owner: 'o1' } : null;
  return { tokens, lines: [], ball, note: '' };
}

export function newTactic({ name, category = '', description = '', court = 'half', home = 5, away = 5 }) {
  return {
    id: newId(), name, category, description, court,
    variants: [{ id: newId(), name: 'Вариант A', frames: [startingFrame(home, away)] }],
    updatedAt: Date.now(),
  };
}

export const findToken = (frame, id) => (id ? frame.tokens.find((t) => t.id === id) : undefined);

export function movementLine(frame, tokenId) {
  for (let i = frame.lines.length - 1; i >= 0; i--) {
    const l = frame.lines[i];
    if (l.from === tokenId && MOVEMENT.has(l.type) && l.points.length >= 2) return l;
  }
  return null;
}

export function passLine(frame) {
  const owner = frame.ball?.owner;
  if (!owner) return null;
  for (let i = frame.lines.length - 1; i >= 0; i--) {
    const l = frame.lines[i];
    if (l.type === 'pass' && l.from === owner && l.points.length >= 2) return l;
  }
  return null;
}

/** off — смещение мяча от центра игрока-владельца (зависит от поворота и размера фишек). */
export function ballPosition(ball, tokens, off = BALL_OFFSET) {
  if (!ball) return null;
  const owner = ball.owner && tokens.find((t) => t.id === ball.owner);
  return owner ? add(owner, off) : pt(ball.x, ball.y);
}

/** Следующий шаг: игроки уходят в концы своих линий, мяч — к адресату передачи. */
export function advance(frame) {
  const tokens = frame.tokens.map((t) => {
    const l = movementLine(frame, t.id);
    if (!l) return { ...t };
    const e = l.points[l.points.length - 1];
    return { ...t, x: e.x, y: e.y };
  });
  const pass = passLine(frame);
  let ball = frame.ball ? { ...frame.ball } : null;
  if (ball && pass) {
    if (pass.to && tokens.some((t) => t.id === pass.to)) ball = { owner: pass.to };
    else {
      const e = pass.points[pass.points.length - 1];
      ball = { owner: null, x: e.x, y: e.y };
    }
  }
  return { tokens, lines: [], ball, note: '' };
}

const smoothstep = (v) => {
  const t = Math.min(1, Math.max(0, v));
  return t * t * (3 - 2 * t);
};

/** Позиции игроков и мяча в момент t анимации перехода a → b. */
export function interpolate(a, b, t, off = BALL_OFFSET) {
  if (!b || t <= 0) return { tokens: a.tokens, ball: ballPosition(a.ball, a.tokens, off) };
  const tokens = [];
  for (const ta of a.tokens) {
    const tb = findToken(b, ta.id);
    const end = tb || ta;
    const l = movementLine(a, ta.id);
    const p = l ? Poly.along(l.points, t, ta, end) : lerp(ta, end, t);
    if (tb || t < 0.5) tokens.push({ ...ta, x: p.x, y: p.y });
  }
  if (t >= 0.5) for (const tb of b.tokens) if (!findToken(a, tb.id)) tokens.push(tb);

  let ball = null;
  if (a.ball && b.ball) {
    const start = ballPosition(a.ball, tokens, off);
    const end = ballPosition(b.ball, tokens, off) || start;
    if (a.ball.owner && a.ball.owner === b.ball.owner) ball = start;
    else if (passLine(a)) ball = lerp(start, end, smoothstep((t - 0.25) / 0.5));
    else ball = lerp(start, end, t);
  } else if (a.ball && t < 0.5) ball = ballPosition(a.ball, tokens, off);
  else if (b.ball && t >= 0.5) ball = ballPosition(b.ball, tokens, off);
  return { tokens, ball };
}

export function hitToken(frame, p, radius = TOKEN_R + 0.4, exclude = null) {
  let best = null, bd = Infinity;
  for (const t of frame.tokens) {
    if (t.id === exclude) continue;
    const d = dist(t, p);
    if (d <= radius && d < bd) { best = t; bd = d; }
  }
  return best;
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
