// 圖片功能(可插拔)。
//
// 流程:貼上圖片 → 檢查大小(>上限不存)→ 顯示在顯示版,並在「複製」左邊出現
//      「儲存圖片 (x.xx MB)」按鈕 → 按下才出現檔名輸入 → 輸入後存成 image item。
//      點擊圖片 chip → 把圖顯示在顯示版。清單 chip 顯示「檔名 x.xx MB」。
// 移除方式:刪掉本檔 + 拿掉 main.js 的 initImageFeature(...),其餘功能完全不受影響。

import { addItem } from '../storage.js';

const MAX_BYTES = 5 * 1024 * 1024; // 圖片大小上限:5MB(要調就改這一行)

export function initImageFeature({ input, display, badge, registerHandler, refreshSaved, showToast, setCopyHandler }) {
  let pendingBlob = null; // 待儲存的圖片(貼上後、尚未存)
  let objectUrl = null;   // 目前顯示中的 object URL(用完要回收)

  // 點擊圖片 chip → 顯示;chip 標籤顯示「檔名 x.xx MB」
  registerHandler({
    type: 'image',
    label: (item) => (item.size != null ? `${item.title} (${formatMB(item.size)})` : item.title),
    // 開啟已存的圖:清空輸入框(圖片沒有對應文字,避免殘留無關文字)、顯示圖、收起儲存鈕
    open: (item) => { input.value = ''; showImage(item.payload, item.title); resetControls(); },
  });

  // 「儲存圖片」按鈕:插在「複製」左邊;只有貼上圖片時才顯示。
  const actions = display.closest('.pane').querySelector('.pane-actions');
  const saveImgBtn = el('button', 'btn');
  saveImgBtn.type = 'button';
  saveImgBtn.hidden = true;
  actions.insertBefore(saveImgBtn, actions.firstChild);

  // 檔名輸入列:按「儲存圖片」後才出現,放在顯示版上方。
  const nameBar = el('div', 'image-bar');
  nameBar.hidden = true;
  const nameInput = el('input', 'image-bar-name');
  nameInput.type = 'text';
  nameInput.placeholder = '輸入檔名';
  const confirmBtn = el('button', 'btn');
  confirmBtn.type = 'button';
  confirmBtn.textContent = '確定';
  const cancelBtn = el('button', 'btn btn-ghost');
  cancelBtn.type = 'button';
  cancelBtn.textContent = '取消';
  nameBar.append(nameInput, confirmBtn, cancelBtn);
  display.parentElement.insertBefore(nameBar, display);

  document.addEventListener('paste', onPaste);
  saveImgBtn.addEventListener('click', () => { nameBar.hidden = false; nameInput.value = ''; nameInput.focus(); });
  confirmBtn.addEventListener('click', saveImage);
  cancelBtn.addEventListener('click', () => { nameBar.hidden = true; });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveImage(); });
  // 顯示版切回文字 → 收掉圖片相關控制(由 main 發出的事件驅動,彼此解耦)
  display.addEventListener('scrapbook:text-shown', resetControls);

  function onPaste(event) {
    const file = findImage(event.clipboardData);
    if (!file) return; // 不是圖片 → 交給預設的文字貼上
    event.preventDefault();
    const mb = file.size / 1024 / 1024;
    if (file.size > MAX_BYTES) {
      showToast(`圖片 ${mb.toFixed(2)} MB,超過 ${MAX_BYTES / 1024 / 1024} MB 上限,無法儲存`);
      return;
    }
    pendingBlob = file;
    showImage(file, '');
    saveImgBtn.textContent = `儲存圖片 (${formatMB(file.size)})`;
    saveImgBtn.hidden = false;
    nameBar.hidden = true;
  }

  async function saveImage() {
    if (!pendingBlob) return;
    const title = nameInput.value.trim() || '未命名圖片';
    await addItem({ type: 'image', title, payload: pendingBlob, size: pendingBlob.size });
    resetControls();
    await refreshSaved();
    showToast('圖片已儲存');
  }

  // 收掉「儲存圖片」按鈕與檔名列,清掉待存圖片
  function resetControls() {
    pendingBlob = null;
    saveImgBtn.hidden = true;
    nameBar.hidden = true;
  }

  function showImage(blob, caption) {
    if (objectUrl) URL.revokeObjectURL(objectUrl); // 回收上一張,避免記憶體累積
    objectUrl = URL.createObjectURL(blob);
    badge.textContent = '圖片';
    display.innerHTML = '';
    const figure = el('figure', 'image-view');
    const img = document.createElement('img');
    img.src = objectUrl;
    img.alt = caption;
    figure.append(img);
    if (caption) {
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      figure.append(cap);
    }
    display.append(figure);
    // 圖片的「複製」改成複製影像本身(寫入剪貼簿的 image/png),這樣貼到 Trello / Teams / Word 才是真的圖。
    setCopyHandler(() => copyImage(blob));
  }

  async function copyImage(blob) {
    if (!navigator.clipboard || !window.ClipboardItem) {
      showToast('此瀏覽器不支援複製圖片');
      return;
    }
    // 多數瀏覽器寫入剪貼簿只接受 image/png,非 png 先轉檔。
    // ClipboardItem 接受 Promise<Blob> 值(Safari 需要這種寫法)。
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPng(blob) })]);
    showToast('已複製圖片');
  }
}

// 把任意圖片 Blob 轉成 PNG Blob(已是 png 就直接回傳)
function toPng(blob) {
  if (blob.type === 'image/png') return Promise.resolve(blob);
  return createImageBitmap(blob).then((bitmap) => {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  });
}

function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// 從剪貼簿資料找出第一張圖片(回傳 File/Blob 或 null)
function findImage(clipboardData) {
  if (!clipboardData) return null;
  for (const item of clipboardData.items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  return null;
}

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
