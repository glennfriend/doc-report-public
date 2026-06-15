// 安全渲染使用者貼上的 HTML。
//
// 用瀏覽器內建的 DOMParser 解析,再以白名單走訪整棵 DOM:
//   • 危險標籤(script/style/iframe…)連內容一起移除
//   • 不在白名單但無害的標籤 → 拆掉外殼、保留內文(unwrap)
//   • 清掉所有事件屬性(on*)與非白名單屬性
//   • href / src 只允許安全協定
// 不依賴任何第三方函式庫(等同自寫的迷你 sanitizer)。

const ALLOWED_TAGS = new Set([
  'a', 'b', 'strong', 'i', 'em', 'u', 's', 'code', 'pre', 'kbd', 'samp',
  'p', 'br', 'hr', 'span', 'div', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'img', 'figure', 'figcaption', 'small', 'sub', 'sup', 'mark', 'del', 'ins',
]);

// 這些標籤即使內容看似無害也整個丟掉(可執行 / 可載入外部資源)
const DANGEROUS_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta',
  'base', 'form', 'input', 'button', 'noscript', 'template', 'svg',
]);

const ALLOWED_ATTRS = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);

export function renderHtml(src) {
  const doc = new DOMParser().parseFromString(src, 'text/html');
  clean(doc.body);
  return `<div class="html-view">${doc.body.innerHTML}</div>`;
}

function clean(node) {
  // 先快照子節點:過程中會增刪(unwrap / remove),不能邊走邊改 live 集合
  [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
    if (child.nodeType !== Node.ELEMENT_NODE) return; // 文字節點保留

    const tag = child.tagName.toLowerCase();
    if (DANGEROUS_TAGS.has(tag)) { child.remove(); return; }

    clean(child); // 先處理後代,確保 unwrap 上來的子節點已是乾淨的

    if (!ALLOWED_TAGS.has(tag)) { unwrap(child); return; }

    sanitizeAttributes(child);
    if (tag === 'a') { child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener'); }
  });
}

function sanitizeAttributes(el) {
  [...el.attributes].forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) { el.removeAttribute(attr.name); return; }
    if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value)) {
      el.removeAttribute(attr.name);
    }
  });
}

// 拆掉外殼標籤,把子節點接到原位置,保留可見內容
function unwrap(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function isSafeUrl(url) {
  return /^(https?:|mailto:|\/|#|data:image\/)/i.test(url.trim());
}
