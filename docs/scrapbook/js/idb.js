// idb.js — 通用的 IndexedDB 封裝(與任何特定資料無關,可重用)。
//
// 原生 IndexedDB 是事件式、又囉嗦;這裡把它包成乾淨的 Promise 介面:
// 給定資料庫 / 物件倉儲名稱,就能用 getAll / get / put / delete / clear。
// 倉儲以 keyPath(預設 'id')當主鍵,可存任何能被結構化複製的值(物件、Blob…)。
//
// 用法:
//   const store = openStore({ dbName: 'myapp', storeName: 'notes' });
//   await store.put({ id: '1', text: 'hi' });
//   const all = await store.getAll();

export function openStore({ dbName, storeName, version = 1, keyPath = 'id' }) {
  const dbPromise = openDatabase(dbName, storeName, version, keyPath);
  const run = (mode, operation) => runOnStore(dbPromise, storeName, mode, operation);

  return {
    getAll: () => run('readonly', (store) => store.getAll()),
    get: (key) => run('readonly', (store) => store.get(key)),
    put: (value) => run('readwrite', (store) => store.put(value)),
    delete: (key) => run('readwrite', (store) => store.delete(key)),
    clear: () => run('readwrite', (store) => store.clear()),
  };
}

// 開啟(或建立)資料庫,需要時建立物件倉儲。回傳 Promise<IDBDatabase>。
function openDatabase(dbName, storeName, version, keyPath) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// 開一個交易、對倉儲執行一個操作,並把結果包成 Promise。
// 用交易的 oncomplete 當成功點(此時資料才真正落地),回傳該操作的結果。
function runOnStore(dbPromise, storeName, mode, operation) {
  return dbPromise.then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = operation(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}
