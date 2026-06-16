// CSV → HTML 表格。第一行當表頭。支援用雙引號包住、內含逗號的欄位。

import { escapeHtml } from '../util.js';

export function renderCsv(text) {
  const rows = text.trim().split(/\r?\n/).map(splitCsvLine);
  const head = rows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = rows.slice(1)
    .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="csv-view"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

// 切一行 CSV:處理雙引號欄位("" 代表一個字面引號)
function splitCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}
