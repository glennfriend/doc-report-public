// 精簡 Markdown → HTML。支援:標題、粗 / 斜體、行內碼、程式碼區塊、
// 連結、無序 / 有序清單、引言、分隔線、段落。
//
// 安全性:所有使用者文字都先經過 escapeHtml 才插入,markdown 模式不會夾帶原始 HTML
//(原始 HTML 由 html 模式負責),連結也只允許安全協定。

import { escapeHtml } from '../util.js';

export function renderMarkdown(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 程式碼區塊 ```
    if (/^```/.test(line)) {
      const buf = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i += 1; }
      i += 1; // 收掉結尾 ```
      html.push(`<pre class="code-view">${escapeHtml(buf.join('\n'))}</pre>`);
      continue;
    }

    // 標題
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 分隔線
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { html.push('<hr>'); i += 1; continue; }

    // 引言(連續的 > )
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i += 1; }
      html.push(`<blockquote>${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // 無序清單
    if (/^\s*[-*+]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ul>${buf.join('')}</ul>`);
      continue;
    }

    // 有序清單
    if (/^\s*\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        buf.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i += 1;
      }
      html.push(`<ol>${buf.join('')}</ol>`);
      continue;
    }

    // 空行
    if (/^\s*$/.test(line)) { i += 1; continue; }

    // 段落:連續且非區塊起始的行併成一段
    const buf = [line];
    i += 1;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) {
      buf.push(lines[i]);
      i += 1;
    }
    html.push(`<p>${inline(buf.join(' '))}</p>`);
  }

  return html.join('\n');
}

function isBlockStart(line) {
  return /^```/.test(line)
    || /^#{1,6}\s/.test(line)
    || /^>\s?/.test(line)
    || /^\s*[-*+]\s+/.test(line)
    || /^\s*\d+\.\s+/.test(line)
    || /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

// 行內語法:先 escape,再依序套用 行內碼 → 連結 → 粗體 → 斜體。
function inline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label, url) => `<a href="${safeUrl(url)}" target="_blank" rel="noopener">${label}</a>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

// 只允許安全協定的連結;其餘導向 # 避免 javascript: 之類的注入。
function safeUrl(url) {
  return /^(https?:|mailto:|\/|#)/i.test(url) ? url : '#';
}
