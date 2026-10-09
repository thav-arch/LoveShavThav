import { Marked, type Tokens } from "marked";

/**
 * Markdown → HTML for posts and case-study sections.
 * Raw HTML in the source is escaped (not rendered) and links/images are
 * limited to safe schemes, so an author account can't inject scripts into
 * pages admins view.
 */
const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SAFE = /^(https?:|mailto:|\/|#)/i;

/**
 * Highlights for project themes: ==text== → accent colour, ^^text^^ → second
 * accent (e.g. clay and gold in Songs of Saaja). Inline, nestable.
 */
const highlight = (name: string, marker: string, cls: string) => {
  const m = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rule = new RegExp(`^${m}(?=\\S)([\\s\\S]*?\\S)${m}`);
  return {
    name,
    level: "inline" as const,
    start: (src: string) => src.indexOf(marker),
    tokenizer(this: { lexer: { inlineTokens: (s: string) => Tokens.Generic[] } }, src: string) {
      const match = rule.exec(src);
      if (match) return { type: name, raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
    },
    renderer(this: { parser: { parseInline: (t: Tokens.Generic[]) => string } }, token: Tokens.Generic) {
      return `<mark class="${cls}">${this.parser.parseInline(token.tokens ?? [])}</mark>`;
    },
  };
};

const md = new Marked({
  gfm: true,
  breaks: false,
  extensions: [highlight("hl", "==", "hl"), highlight("hl2", "^^", "hl2")],
  renderer: {
    html(token: Tokens.HTML | Tokens.Tag) {
      return escape(token.text);
    },
    link(token: Tokens.Link) {
      const href = SAFE.test(token.href) ? token.href : "#";
      const external = /^https?:/i.test(href);
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${escape(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    },
    image(token: Tokens.Image) {
      const src = SAFE.test(token.href) ? token.href : "";
      return src ? `<img src="${escape(src)}" alt="${escape(token.text)}" loading="lazy" decoding="async" />` : "";
    },
  },
});

export function renderMarkdown(src: string) {
  return md.parse(src ?? "", { async: false }) as string;
}

export function readingMinutes(src: string) {
  return Math.max(1, Math.round((src.trim().split(/\s+/).length || 0) / 220));
}
