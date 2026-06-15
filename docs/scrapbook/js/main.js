// 控制器:把 DOM 事件接到偵測 / render / 儲存 / 複製 / 回填。

import { detectType, TYPES } from './detect.js';
import { render } from './renderers/index.js';
import { loadItems, addItem, removeItem } from './storage.js';
import { copyRich } from './clipboard.js';

const input = document.querySelector('#input');
const display = document.querySelector('#display');
const badge = document.querySelector('#badge');
const saveBtn = document.querySelector('#save');
const copyBtn = document.querySelector('#copy');
const savedList = document.querySelector('#saved');
const toast = document.querySelector('#toast');

const RENDER_DELAY = 120; // 輸入後稍微 debounce 再 render
let renderTimer;

// ── 即時 render ──
input.addEventListener('input', () => {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(updateDisplay, RENDER_DELAY);
});

function updateDisplay() {
  const text = input.value;
  if (!text.trim()) {
    display.innerHTML = '<p class="hint">在左側貼上內容,這裡會即時顯示結果。</p>';
    badge.textContent = '';
    return;
  }
  const type = detectType(text);
  badge.textContent = TYPES[type];
  display.innerHTML = render(text, type);
}

// ── 儲存目前輸入 ──
saveBtn.addEventListener('click', () => {
  if (!input.value.trim()) { showToast('沒有內容可儲存'); return; }
  addItem(input.value);
  renderSavedList();
  showToast('已儲存');
});

// ── 複製顯示版內容(保留格式) ──
copyBtn.addEventListener('click', async () => {
  if (!display.textContent.trim()) { showToast('沒有可複製的內容'); return; }
  try {
    await copyRich(display.innerHTML, display.textContent);
    showToast('已複製(保留格式)');
  } catch {
    showToast('複製失敗,請手動選取');
  }
});

// ── 已儲存清單 ──
function renderSavedList() {
  const items = loadItems();
  savedList.innerHTML = '';
  if (!items.length) {
    savedList.innerHTML = '<span class="hint">尚無儲存的內容。</span>';
    return;
  }
  items.forEach((item) => savedList.appendChild(buildChip(item)));
}

function buildChip(item) {
  const chip = document.createElement('div');
  chip.className = 'chip';

  const label = document.createElement('button');
  label.type = 'button';
  label.className = 'chip-label';
  label.textContent = item.title;
  label.title = '點擊回填到輸入框';
  label.addEventListener('click', () => fillInput(item));

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'chip-del';
  del.textContent = '✕';
  del.title = '刪除';
  del.addEventListener('click', () => {
    removeItem(item.id);
    renderSavedList();
  });

  chip.append(label, del);
  return chip;
}

// 防呆:只有輸入框是空的才回填,避免蓋掉正在編輯的內容。
function fillInput(item) {
  if (input.value.trim()) { showToast('請先清空輸入框再回填'); return; }
  input.value = item.content;
  updateDisplay();
}

// ── 提示 toast ──
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

// ── 初始化 ──
renderSavedList();
updateDisplay();
