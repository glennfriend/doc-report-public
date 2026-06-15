// 通用程式碼語法上色(啟發式,偏 JS / 類 C 語法)。
// 逐段比對:註解 → 字串 → 數字 → 識別字 / 關鍵字 → 其他單一字元。不執行程式碼。

import { escapeHtml } from '../util.js';

const KEYWORDS = new Set((
  'function return const let var if else for while do switch case break continue '
  + 'class new this typeof instanceof import export default from async await try catch '
  + 'finally throw extends super yield void delete in of null true false undefined '
  + 'def public private protected static int float double string bool'
).split(' '));

export function renderCode(src) {
  return `<pre class="code-view">${highlight(src)}</pre>`;
}

function highlight(src) {
  let out = '';
  const n = src.length;
  let i = 0;

  while (i < n) {
    const rest = src.slice(i);
    let m;

    // 行註解 // … 或 # …
    if ((m = rest.match(/^\/\/[^\n]*/)) || (m = rest.match(/^#[^\n]*/))) {
      out += span('tok-comment', m[0]); i += m[0].length; continue;
    }
    // 區塊註解 /* … */
    if ((m = rest.match(/^\/\*[\s\S]*?\*\//))) {
      out += span('tok-comment', m[0]); i += m[0].length; continue;
    }
    // 字串 " ' `
    if ((m = rest.match(/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'|^`(?:[^`\\]|\\.)*`/))) {
      out += span('tok-str', m[0]); i += m[0].length; continue;
    }
    // 數字
    if ((m = rest.match(/^\d+(?:\.\d+)?/))) {
      out += span('tok-num', m[0]); i += m[0].length; continue;
    }
    // 識別字 / 關鍵字
    if ((m = rest.match(/^[A-Za-z_$][\w$]*/))) {
      out += KEYWORDS.has(m[0]) ? span('tok-kw', m[0]) : escapeHtml(m[0]);
      i += m[0].length;
      continue;
    }
    // 其他:單一字元照原樣輸出
    out += escapeHtml(src[i]);
    i += 1;
  }
  return out;
}

function span(cls, value) { return `<span class="${cls}">${escapeHtml(value)}</span>`; }
