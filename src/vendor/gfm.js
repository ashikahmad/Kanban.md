// GitHub-flavoured Markdown for the share preview, so it reads as it will in any modern viewer rather than
// through this app's own parser. Task text is untrusted once it is shared: raw HTML is shown as text, links
// are limited to http(s)/mailto, and images are not fetched (they show their alt text).
import { Marked } from 'marked';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    html: ({ text }) => esc(text),
    image: ({ text }) => esc(text),
    link({ href, tokens }) {
      const inner = this.parser.parseInline(tokens);
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : inner;
    },
  },
});

export function renderGfm(markdown) {
  return marked.parse(String(markdown ?? ''), { async: false });
}
