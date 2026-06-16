// render 派發:依偵測到的類型,交給對應的 renderer 產生顯示用 HTML。

import { escapeHtml } from '../util.js';
import { renderStructured } from './structured.js';
import { renderMarkdown } from './markdown.js';
import { renderHtml } from './html.js';
import { renderCode } from './code.js';
import { renderCsv } from './csv.js';

export function render(text, type) {
  switch (type) {
    case 'json': return renderStructured(text);
    case 'html': return renderHtml(text);
    case 'markdown': return renderMarkdown(text);
    case 'csv': return renderCsv(text);
    case 'code': return renderCode(text);
    default: return `<pre class="code-view">${escapeHtml(text)}</pre>`;
  }
}
