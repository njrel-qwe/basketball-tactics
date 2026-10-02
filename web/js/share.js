// Обмен тактиками между телефонами: ссылка или JSON-файл.
import { encodeTactic } from './storage.js';
import { toast } from './ui.js';

export async function shareTacticLink(tactic) {
  const code = await encodeTactic(tactic);
  const url = `${location.origin}${location.pathname}#t=${code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: tactic.name, text: `Тактика «${tactic.name}»`, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Ссылка скопирована — отправьте её в мессенджер');
  } catch {
    prompt('Скопируйте ссылку:', url);
  }
}

export async function shareJsonFile(data, name) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const safeFileName = (s) => s.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'tactic';
