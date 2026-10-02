// Хранение тактик в localStorage + обмен (файл, ссылка).
import { clone, newId } from './model.js';

const KEY = 'tacticboard.v1';

export function loadTactics() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return Array.isArray(data?.tactics) ? data.tactics : [];
  } catch {
    return [];
  }
}

export function saveTactics(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, tactics: list }));
    return true;
  } catch {
    return false;
  }
}

/** Просим браузер не удалять данные при нехватке места (особенно важно на iOS). */
export function requestPersistence() {
  try { navigator.storage?.persist?.(); } catch { /* не поддерживается */ }
}

/** Копия с новыми идентификаторами. */
export function duplicate(t, name = t.name) {
  const c = clone(t);
  c.id = newId();
  c.name = name;
  c.updatedAt = Date.now();
  c.variants.forEach((v) => { v.id = newId(); });
  return c;
}

function isTactic(t) {
  return t && typeof t.name === 'string' && Array.isArray(t.variants) && t.variants.every((v) => Array.isArray(v.frames));
}

/** Разбор импортируемого JSON: одна тактика, массив или полный бэкап. */
export function parseImport(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : Array.isArray(data?.tactics) ? data.tactics : [data];
  const valid = list.filter(isTactic);
  if (!valid.length) throw new Error('В файле нет тактик');
  return valid;
}

// ---------- Ссылка с тактикой внутри (#t=...) ----------

const b64url = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Округляем координаты, чтобы ссылка была короче. */
function compact(t) {
  return JSON.stringify(t, (k, v) => (typeof v === 'number' && (k === 'x' || k === 'y') ? Math.round(v * 100) / 100 : v));
}

export async function encodeTactic(t) {
  const bytes = new TextEncoder().encode(compact(t));
  if ('CompressionStream' in window) {
    return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  }
  return 'j' + b64url(bytes);
}

export async function decodeTactic(code) {
  const kind = code[0];
  let bytes = fromB64url(code.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  const t = JSON.parse(new TextDecoder().decode(bytes));
  if (!isTactic(t)) throw new Error('Некорректная ссылка');
  return t;
}

// ---------- Настройки этого устройства ----------

export function getPref(name, fallback) {
  try {
    const v = localStorage.getItem(`tacticboard.pref.${name}`);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function setPref(name, value) {
  try { localStorage.setItem(`tacticboard.pref.${name}`, JSON.stringify(value)); } catch { /* приватный режим */ }
}

export const SPEEDS = [0.5, 1, 2];
export const speedLabel = (s) => `${s}×`;
