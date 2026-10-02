// Обмен тактиками между телефонами: ссылка или JSON-файл.
import { encodeTactic } from './storage.js';
import { h, openOverlay, toast } from './ui.js';

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

/**
 * Окно «Файл готов» с превью и кнопкой сохранения. Кнопка нужна, потому что iOS
 * разрешает меню «Поделиться» только сразу после нажатия пользователя.
 */
export function offerFile(blob, fileName, { title = 'Готово', kind = 'image' } = {}) {
  const url = URL.createObjectURL(blob);
  const file = new File([blob], fileName, { type: blob.type });
  const canShare = !!navigator.canShare?.({ files: [file] });
  const preview = kind === 'video'
    ? `<video class="preview" src="${url}" controls playsinline muted autoplay loop></video>`
    : `<img class="preview" src="${url}" alt="">`;
  const box = h(`<div class="dialog-box">
    <div class="dialog-title">${title}</div>
    ${preview}
    <p class="muted small">${canShare
      ? `В меню выберите «${kind === 'video' ? 'Сохранить видео' : 'Сохранить изображение'}» или мессенджер.`
      : 'Файл сохранится в «Загрузки».'}</p>
    <div class="dialog-actions">
      <button class="btn text" data-cancel>Закрыть</button>
      <button class="btn filled" data-ok>${canShare ? 'Сохранить / отправить' : 'Скачать'}</button>
    </div></div>`);
  const close = openOverlay(box, { kind: 'dialog', onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
  box.querySelector('[data-cancel]').addEventListener('click', close);
  box.querySelector('[data-ok]').addEventListener('click', async () => {
    if (canShare) {
      try {
        await navigator.share({ files: [file], title: fileName });
        close();
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    toast('Файл сохранён в загрузки');
    close();
  });
}
