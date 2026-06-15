// 富文字複製:同時放入 text/html 與 text/plain。
// 貼到 Teams、Word、Gmail 等支援富文字的地方會保留排版(用 html);
// 貼到純文字環境則退回 plain。瀏覽器不支援 ClipboardItem 時,退回舊式 execCommand。

export async function copyRich(html, plain) {
  if (navigator.clipboard && window.ClipboardItem) {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plain], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    return;
  }
  fallbackCopyHtml(html);
}

// 舊瀏覽器:把 HTML 塞進可編輯區、選取、execCommand('copy')。
// 選取富文字內容時,瀏覽器會自動帶上 text/html。
function fallbackCopyHtml(html) {
  const holder = document.createElement('div');
  holder.contentEditable = 'true';
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.innerHTML = html;
  document.body.appendChild(holder);

  const range = document.createRange();
  range.selectNodeContents(holder);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);

  try {
    document.execCommand('copy');
  } finally {
    selection.removeAllRanges();
    holder.remove();
  }
}
