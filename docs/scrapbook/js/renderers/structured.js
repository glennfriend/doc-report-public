// 結構化資料(物件 / 陣列)漂亮排版 + 上色。
//
// 重點:不執行任何程式碼。純粹做字元層級的 tokenize → 重新縮排 → 包上色 span,
// 所以連 {a:"123"} 這種非嚴格 JSON(無引號 key、單引號)也能排得漂亮。

import { escapeHtml } from '../util.js';

export function renderStructured(text) {
  const tokens = tokenize(text.trim());
  return `<pre class="code-view">${print(tokens)}</pre>`;
}

// ── 1) tokenize:逐字掃描。字串內的標點不會被誤判成結構符號。 ──
function tokenize(src) {
  const tokens = [];
  const n = src.length;
  let i = 0;

  while (i < n) {
    const ch = src[i];

    // 空白:略過(縮排由 print 階段自己產生)
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }

    // 字串:吃到對應的結束引號(處理 \ 跳脫),支援 " ' `
    if (ch === '"' || ch === "'" || ch === '`') {
      const start = i;
      i++;
      while (i < n && src[i] !== ch) {
        if (src[i] === '\\') i++;
        i++;
      }
      i++; // 收掉結束引號
      tokens.push({ type: 'string', value: src.slice(start, i) });
      continue;
    }

    if (ch === '{' || ch === '[' || ch === '}' || ch === ']') {
      tokens.push({ type: 'bracket', value: ch });
      i++;
      continue;
    }
    if (ch === ',') { tokens.push({ type: 'comma', value: ch }); i++; continue; }
    if (ch === ':') { tokens.push({ type: 'colon', value: ch }); i++; continue; }

    // 其餘:連續的非標點字元視為一個 word(數字、true/false/null、無引號 key…)
    const start = i;
    while (i < n && !' \t\n\r"\'`{}[],:'.includes(src[i])) i++;
    tokens.push({ type: 'word', value: src.slice(start, i) });
  }
  return tokens;
}

// ── 2) print:管理縮排,並判斷 word/string 是不是 key(後面緊接著 `:`)。 ──
function print(tokens) {
  let out = '';
  let depth = 0;
  const indent = () => `\n${'  '.repeat(depth)}`;
  const isOpen = (t) => t && t.type === 'bracket' && (t.value === '{' || t.value === '[');
  const isClose = (t) => t && t.type === 'bracket' && (t.value === '}' || t.value === ']');

  tokens.forEach((tok, idx) => {
    const prev = tokens[idx - 1];
    const next = tokens[idx + 1];

    switch (tok.type) {
      case 'bracket':
        if (tok.value === '{' || tok.value === '[') {
          out += punct(tok.value);
          if (!isClose(next)) { depth += 1; out += indent(); } // 空容器 {} [] 不換行
        } else {
          if (isOpen(prev)) {
            out += punct(tok.value); // 空容器:緊接著上一個開括號
          } else {
            depth = Math.max(0, depth - 1);
            out += indent() + punct(tok.value);
          }
        }
        break;
      case 'comma':
        out += punct(',') + indent();
        break;
      case 'colon':
        out += `${punct(':')} `;
        break;
      case 'string':
        out += next && next.type === 'colon' ? span('tok-key', tok.value) : span('tok-str', tok.value);
        break;
      case 'word':
        out += next && next.type === 'colon' ? span('tok-key', tok.value) : word(tok.value);
        break;
      default:
        break;
    }
  });
  return out;
}

// word 上色:布林 / null → bool;數字 → num;其餘照原樣(無引號 key 已在 print 處理)
function word(value) {
  if (value === 'true' || value === 'false' || value === 'null' || value === 'undefined') {
    return span('tok-bool', value);
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) return span('tok-num', value);
  return escapeHtml(value);
}

function punct(value) { return span('tok-punct', value); }
function span(cls, value) { return `<span class="${cls}">${escapeHtml(value)}</span>`; }
