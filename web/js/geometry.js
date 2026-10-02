// Геометрия площадки FIBA (метры) и операции с ломаными.
// Ось X — поперёк площадки (0..15), ось Y — от лицевой линии, кольцо сверху.

export const COURT = {
  WIDTH: 15,
  HALF: 14,
  MARGIN: 0.9,
  BASKET: { x: 7.5, y: 1.575 },
};

export const courtLength = (type) => (type === 'full' ? COURT.HALF * 2 : COURT.HALF);
export const courtAspect = (type) => (COURT.WIDTH + 2 * COURT.MARGIN) / (courtLength(type) + 2 * COURT.MARGIN);

export const pt = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const len = (a) => Math.hypot(a.x, a.y);
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Перевод метров в пиксели и обратно для области `rect` = {x, y, w, h}. */
export class Geometry {
  constructor(rect, court) {
    this.court = court;
    this.length = courtLength(court);
    const wM = COURT.WIDTH + 2 * COURT.MARGIN;
    const hM = this.length + 2 * COURT.MARGIN;
    this.scale = Math.min(rect.w / wM, rect.h / hM);
    this.ox = rect.x + (rect.w - wM * this.scale) / 2 + COURT.MARGIN * this.scale;
    this.oy = rect.y + (rect.h - hM * this.scale) / 2 + COURT.MARGIN * this.scale;
  }
  toScreen(p) { return { x: this.ox + p.x * this.scale, y: this.oy + p.y * this.scale }; }
  toCourt(x, y) { return { x: (x - this.ox) / this.scale, y: (y - this.oy) / this.scale }; }
  px(m) { return m * this.scale; }
  clamp(p) {
    const m = COURT.MARGIN - 0.3;
    return {
      x: Math.min(Math.max(p.x, -m), COURT.WIDTH + m),
      y: Math.min(Math.max(p.y, -m), this.length + m),
    };
  }
  get boardRect() {
    const a = this.toScreen(pt(-COURT.MARGIN, -COURT.MARGIN));
    const b = this.toScreen(pt(COURT.WIDTH + COURT.MARGIN, this.length + COURT.MARGIN));
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }
}

export const Poly = {
  length(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]);
    return s;
  },

  pointAt(pts, d) {
    if (!pts.length) return pt(0, 0);
    if (d <= 0) return pts[0];
    let left = d;
    for (let i = 1; i < pts.length; i++) {
      const seg = dist(pts[i - 1], pts[i]);
      if (left <= seg && seg > 0) return lerp(pts[i - 1], pts[i], left / seg);
      left -= seg;
    }
    return pts[pts.length - 1];
  },

  /** Точка на доле t пути со сдвигом, чтобы путь начинался в start и заканчивался в end. */
  along(pts, t, start, end) {
    const p = Poly.pointAt(pts, Poly.length(pts) * t);
    const off = add(mul(sub(start, pts[0]), 1 - t), mul(sub(end, pts[pts.length - 1]), t));
    return add(p, off);
  },

  slice(pts, from, to) {
    if (pts.length < 2 || to <= from) return [];
    const out = [Poly.pointAt(pts, from)];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += dist(pts[i - 1], pts[i]);
      if (acc > from && acc < to) out.push(pts[i]);
    }
    out.push(Poly.pointAt(pts, to));
    return out;
  },

  segDist(p, a, b) {
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    if (l2 === 0) return dist(p, a);
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
    return dist(p, add(a, mul(ab, t)));
  },

  distanceTo(pts, p) {
    if (pts.length === 1) return dist(pts[0], p);
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) best = Math.min(best, Poly.segDist(p, pts[i - 1], pts[i]));
    return best;
  },

  /** Упрощение Рамера — Дугласа — Пекера. */
  simplify(pts, eps = 0.06) {
    if (pts.length < 3) return pts;
    let maxD = 0, idx = 0;
    const first = pts[0], last = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Poly.segDist(pts[i], first, last);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps) {
      const left = Poly.simplify(pts.slice(0, idx + 1), eps);
      const right = Poly.simplify(pts.slice(idx), eps);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  },

  endDir(pts, back) {
    const total = Poly.length(pts);
    const from = Poly.pointAt(pts, Math.max(0, total - back));
    const d = sub(pts[pts.length - 1], from);
    const l = len(d);
    return l === 0 ? pt(0, 1) : mul(d, 1 / l);
  },
};
