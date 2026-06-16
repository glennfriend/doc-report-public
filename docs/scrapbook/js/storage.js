// 已儲存內容的持久層 — IndexedDB(透過通用的 idb.js)。
//
// item 結構:{ id, type, title, payload, createdAt }
//   type='text'  → payload 是字串
//   type='image' → payload 是 Blob(IndexedDB 原生存,不轉 base64)
// 因 IndexedDB 為非同步,以下函式皆回傳 Promise。

import { openStore } from './idb.js';

const store = openStore({ dbName: 'scrapbook', storeName: 'items' });
const LEGACY_KEY = 'scrapbook:items'; // 舊版 localStorage 用的 key

// 取全部,依建立時間新 → 舊排序
export async function loadItems() {
  await migrateFromLocalStorage();
  const items = await store.getAll();
  return items.map(normalize).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// 寬鬆讀取:沒有 type 的舊資料當成文字(payload 取舊欄位 content)。
// 只在記憶體裡補,不寫回 → 不做正式遷移,舊資料也不會壞掉。
function normalize(item) {
  if (item.type) return item;
  return { ...item, type: 'text', payload: item.content };
}

// fields 至少含 { type, title, payload };可帶額外欄位(如圖片的 size)。
export async function addItem(fields) {
  const item = { id: newId(), createdAt: new Date().toISOString(), ...fields };
  await store.put(item);
  return item;
}

export async function removeItem(id) {
  await store.delete(id);
}

// 目前的儲存用量估計;瀏覽器不支援時回傳 null。
export async function storageEstimate() {
  if (!navigator.storage || !navigator.storage.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  return { usage, quota, percent: quota ? (usage / quota) * 100 : 0 };
}

// 一次性:把舊 localStorage 的內容搬進 IndexedDB,搬完移除舊 key(冪等、自我終結)。
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

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
