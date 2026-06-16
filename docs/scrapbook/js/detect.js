// 內容類型偵測 — 純啟發式(heuristic)。
// 偵測順序刻意由「最明確」到「最模糊」:結構化資料 → HTML → Markdown → 程式碼 → 純文字,
// 先命中先決定。判斷本質上是猜測,目標是覆蓋日常貼上的常見情況,而非 100% 精準。

// 類型 → 顯示在徽章上的中文標籤
export const TYPES = {
  json: 'JSON / 物件',
  html: 'HTML',
  markdown: 'Markdown',
  csv: 'CSV',
  code: '程式碼',
  text: '純文字',
};

export function detectType(raw) {
  const text = raw.trim();
  if (!text) return 'text';
  if (looksStructured(text)) return 'json';
  if (looksHtml(text)) return 'html';
  if (looksMarkdown(text)) return 'markdown';
  if (looksCode(text)) return 'code';
  if (looksCsv(text)) return 'csv';
  return 'text';
}

// CSV:至少兩行、每行用逗號切出的欄數一致且 ≥2 欄。
// 放在最後判斷,避免把含逗號的散文誤判(已先讓 markdown / code 等先命中)。
function looksCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return false;
  const cols = lines.map((l) => l.split(',').length);
  return cols[0] >= 2 && cols.every((c) => c === cols[0]);
}

// 物件 / 陣列字面值:開頭就是 `{`(涵蓋 {a:"123"} 這種非嚴格 JSON),
// 或能被 JSON.parse 成物件 / 陣列。單純的數字、字串、布林不算「結構化」。
function looksStructured(text) {
  if (text[0] === '{') return true;
  try {
    const value = JSON.parse(text);
    return typeof value === 'object' && value !== null;
  } catch {
    return false;
  }
}

// HTML:至少出現一個成對標籤、自閉合標籤,或常見的 void 元素。
// 要求結構完整,避免內文裡偶然帶個 `<` 就被誤判成 HTML。
function looksHtml(text) {
  return /<([a-z][a-z0-9]*)\b[^>]*>[\s\S]*<\/\1>/i.test(text)
    || /<[a-z][a-z0-9]*\b[^>]*\/>/i.test(text)
    || /<(br|hr|img|input|meta|link)\b[^>]*>/i.test(text);
}

// Markdown:出現任一常見標記就算。
function looksMarkdown(text) {
  return [
    /^#{1,6}\s/m,            // 標題
    /^\s*[-*+]\s/m,          // 無序清單
    /^\s*\d+\.\s/m,          // 有序清單
    /^>\s?/m,                // 引言
    /```/,                   // 程式碼區塊圍欄
    /\[[^\]]+\]\([^)]+\)/,   // 連結
    /\*\*[^*]+\*\*/,         // 粗體
    /^(-{3,}|\*{3,}|_{3,})\s*$/m, // 分隔線
    /^\|.*\|/m,              // 表格列
  ].some((re) => re.test(text));
}

// 程式碼:出現常見語法關鍵字或符號。
function looksCode(text) {
  return [
    /\b(function|return|const|let|var|class|import|export|def|public|private|static)\b/,
    /=>/,
    /;\s*$/m,
    /^\s*(#include|package|using)\b/m,
    /\b(if|for|while|switch)\s*\(/,
  ].some((re) => re.test(text));
}
