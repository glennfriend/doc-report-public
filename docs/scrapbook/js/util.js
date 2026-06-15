// 共用小工具

// 把字串中的 HTML 特殊字元跳脫,當成「文字」放進 HTML 而不被解讀成標籤。
// 只處理 & < >:輸出都是元素內文(非屬性值),引號不需要跳脫。
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
