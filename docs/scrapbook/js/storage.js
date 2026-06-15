// 已儲存內容的持久層 — 用 localStorage。
// 每筆:{ id, title, content, createdAt }。title 取首行非空字串(供 chip 顯示)。

const KEY = 'scrapbook:items';

export function loadItems() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function addItem(content) {
  const items = loadItems();
  const item = {
    id: newId(),
    title: deriveTitle(content),
    content,
    createdAt: new Date().toISOString(),
  };
  items.unshift(item); // 新的排前面
  persist(items);
  return item;
}

export function removeItem(id) {
  persist(loadItems().filter((item) => item.id !== id));
}

function persist(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

function deriveTitle(content) {
  const firstLine = content.split('\n').map((s) => s.trim()).find(Boolean) || '(空白)';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
