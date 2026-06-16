// 控制器:即時 render 文字 + 已儲存清單 + 以「type handler」派發各類型的開啟行為。
//
// 可插拔:額外的內容類型(如圖片)寫在獨立模組(features/),透過 registerHandler 掛進來。
// 移除某功能 = 刪掉該 feature 模組 + 拿掉下方一行 initXxxFeature(...),核心不受影響。

import { detectType, TYPES } from './detect.js';
import { render } from './renderers/index.js';
import { loadItems, addItem, removeItem, storageEstimate } from './storage.js';
import { copyRich } from './clipboard.js';
import { initImageFeature } from './features/image.js';

const input = document.querySelector('#input');
const display = document.querySelector('#display');
const badge = document.querySelector('#badge');
const saveBtn = document.querySelector('#save');
const copyBtn = document.querySelector('#copy');
const savedList = document.querySelector('#saved');
const storageStatus = document.querySelector('#storage-status');
const toast = document.querySelector('#toast');

// ── type handler 登記表:每種 item 類型的「點擊開啟」行為 ──
const handlers = {};
function registerHandler(handler) { handlers[handler.type] = handler; }

// 內建:文字 → 填回輸入框並即時 render(輸入與顯示一起切到這筆)
registerHandler({ type: 'text', open: (item) => { input.value = item.payload; updateDisplay(); } });

const RENDER_DELAY = 120; // 輸入後稍微 debounce 再 render
let renderTimer;

// 複製行為:預設複製顯示版的富文字;功能模組可暫時改寫(如圖片改成複製影像本身)。
async function defaultCopy() {
  if (!display.textContent.trim()) { showToast('沒有可複製的內容'); return; }
  await copyRich(display.innerHTML, display.textContent);
  showToast('已複製(保留格式)');
}
let copyHandler = defaultCopy;
function setCopyHandler(fn) { copyHandler = fn; }

// ── 即時 render(文字) ──
input.addEventListener('input', () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(updateDisplay, RENDER_DELAY);
});

function updateDisplay() {
  const text = input.value;
  if (!text.trim()) {
    display.innerHTML = '<p class="hint">在左側貼上內容,這裡會即時顯示結果。</p>';
    badge.textContent = '';
  } else {
    const type = detectType(text);
    badge.textContent = TYPES[type];
    display.innerHTML = render(text, type);
  }
  copyHandler = defaultCopy; // 回到文字 → 複製還原成富文字
  // 通知:顯示版目前是「文字」內容。功能模組(如圖片)可據此收掉自己的控制項。
  // 核心永遠發送此事件,沒人監聽也無妨 → 移除某功能不影響這裡。
  display.dispatchEvent(new CustomEvent('scrapbook:text-shown'));
}

// ── 儲存目前輸入(文字) ──
saveBtn.addEventListener('click', async () => {
  if (!input.value.trim()) { showToast('沒有內容可儲存'); return; }
  await addItem({ type: 'text', title: deriveTitle(input.value), payload: input.value });
  await refreshSaved();
  showToast('已儲存');
});

// ── 複製(實際行為交給目前的 copyHandler) ──
copyBtn.addEventListener('click', async () => {
  try {
    await copyHandler();
  } catch {
    showToast('複製失敗,請手動選取');
  }
});

// ── 儲存庫:清單 + 空間狀態一起更新 ──
async function refreshSaved() {
  await renderSavedList();
  await renderStorageStatus();
}

async function renderSavedList() {
  const items = await loadItems();
  savedList.innerHTML = '';
  if (!items.length) {
    savedList.innerHTML = '<span class="hint">尚無儲存的內容。</span>';
    return;
  }
  items.forEach((item) => savedList.appendChild(buildChip(item)));
}

async function renderStorageStatus() {
  const est = await storageEstimate();
  if (!est) { storageStatus.textContent = ''; return; }
  const usedMB = (est.usage / 1024 / 1024).toFixed(1);
  const quotaMB = (est.quota / 1024 / 1024).toFixed(0);
  storageStatus.textContent = `已用 ${est.percent.toFixed(1)}%(${usedMB} MB / ${quotaMB} MB)`;
}

function buildChip(item) {
  const chip = document.createElement('div');
  chip.className = `chip ${chipCategory(item)}`;

  const handler = handlers[item.type];
  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'chip-label';
  label.textContent = handler && handler.label ? handler.label(item) : item.title;
  label.title = '點擊開啟';
  label.addEventListener('click', () => openItem(item));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'chip-del';
  del.textContent = '✕';
  del.title = '刪除';
  del.addEventListener('click', async () => {
    if (!confirm(`確定要刪除「${item.title}」嗎?`)) return;
    await removeItem(item.id);
    await refreshSaved();
  });

  chip.append(label, del);
  return chip;
}

// 開啟一筆已儲存的 item:把「輸入 + 顯示」一起切到這筆。
// 防呆:輸入框已有內容時,先 confirm 再替換,避免不小心蓋掉正在編輯的東西。
function openItem(item) {
  if (input.value.trim() && !confirm('要用這筆內容替換目前輸入框/顯示的內容嗎?')) return;
  const handler = handlers[item.type];
  if (handler) handler.open(item);
}

// 決定 chip 的色塊分類:圖片 / 純文字 / 特殊文字格式(json、markdown、csv…)
function chipCategory(item) {
  if (item.type === 'image') return 'cat-image';
  return detectType(item.payload) === 'text' ? 'cat-plain' : 'cat-rich';
}

function deriveTitle(content) {
  const firstLine = content.split('\n').map((s) => s.trim()).find(Boolean) || '(空白)';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

// ── 提示 toast ──
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ── 掛載額外功能(可插拔) ──
initImageFeature({ input, display, badge, registerHandler, refreshSaved, showToast, setCopyHandler });

// ── 初始化 ──
refreshSaved();
updateDisplay();
