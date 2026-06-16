// 已儲存內容的持久層 — 改用 IndexedDB(透過通用的 idb.js)。
// 每筆:{ id, title, content, createdAt }。title 取首行非空字串(供 chip 顯示)。
//
// 因為 IndexedDB 是非同步的,以下函式都回傳 Promise(呼叫端需 await)。
// 首次載入會把舊版 localStorage 的資料一次性搬進 IndexedDB,搬完即清除舊 key,不掉資料。

import { openStore } from './idb.js';

const store = openStore({ dbName: 'scrapbook', storeName: 'items' });
const LEGACY_KEY = 'scrapbook:items'; // 舊版 localStorage 用的 key

// 取全部,依建立時間新 → 舊排序(IndexedDB 預設依主鍵排序,這裡改成時間序)
export async function loadItems() {
  await migrateFromLocalStorage();
  const items = await store.getAll();
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addItem(content) {
  const item = {
    id: newId(),
    title: deriveTitle(content),
    content,
    createdAt: new Date().toISOString(),
  };
  await store.put(item);
  return item;
}

export async function removeItem(id) {
  await store.delete(id);
}

// 一次性遷移:把舊 localStorage 的內容搬進 IndexedDB。
// 搬完移除舊 key → 之後再呼叫就什麼都不做(自我終結,且冪等)。
async function migrateFromLocalStorage() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const legacyItems = JSON.parse(raw);
    if (Array.isArray(legacyItems)) {
      await Promise.all(legacyItems.map((item) => store.put(item)));
    }
  } catch {
    // 舊資料壞掉就略過,不阻擋後續流程
  }
  localStorage.removeItem(LEGACY_KEY);
}

function deriveTitle(content) {
  const firstLine = content.split('\n').map((s) => s.trim()).find(Boolean) || '(空白)';
  return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
