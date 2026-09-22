/**
 * Formatting inside a question, and how it is made safe.
 *
 * A teacher setting a tajwiid paper needs one letter of a word highlighted, a
 * word in bold, a verse a size larger. Without it the question has to be
 * written in Word and photographed, which is what several schools were doing.
 *
 * The content is HTML, because that is what a contenteditable box produces —
 * but none of it is trusted. A question is written by a teacher at one school
 * and rendered in the browsers of every student who sits the paper, so a
 * script that survived into storage would run in their sessions. Filtering
 * HTML is famously easy to get subtly wrong, so nothing here filters: the
 * input is parsed into a tree of the handful of things a question may
 * contain, and fresh HTML is built from that tree. Anything unrecognised —
 * a tag, an attribute, a style, a comment, a stray `<` — never reaches the
 * output because there is no path by which it could.
 *
 * Shared, and applied again on the server on every write, because a sanitiser
 * that only runs in the browser is decoration: the request can be made
 * without one.
 */

/** The only elements a question may contain. */
const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "mark",
  "sup",
  "sub",
  "span",
  "br",
]);

/** Elements that carry nothing and close themselves. */
const VOID_TAGS = new Set(["br"]);

/**
 * Elements whose contents are code, not words.
 *
 * Dropping the tag but keeping what was inside it is safe — it comes out as
 * escaped text — but it is not what anyone wants: a teacher who pasted a
 * block from a web page would find the page's JavaScript printed in the
 * middle of their question. So these are discarded whole.
 */
const OPAQUE_TAGS = new Set([
  "script",
  "style",
  "title",
  "textarea",
  "noscript",
  "iframe",
  "object",
  "template",
  "head",
]);

/**
 * The only CSS properties a question may set.
 *
 * Size, face and colour — what the toolbar offers, and nothing that can move
 * an element, cover the page or load anything from elsewhere.
 */
const ALLOWED_STYLES = new Set([
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
  "color",
  "background-color",
]);

/** The largest and smallest a question may be set, in points of a percent. */
const MIN_FONT_PERCENT = 60;
const MAX_FONT_PERCENT = 300;

/**
 * A style value that is a plain, self-contained value.
 *
 * `url(...)`, `expression(...)`, an escape sequence or a comment in a CSS
 * value are all ways of reaching outside it, and none of them is anything a
 * teacher formatting a question needs.
 */
function safeStyleValue(value: string): boolean {
  if (value.length > 80) return false;
  if (/[\\{}();<>@]/.test(value)) return false;
  if (/url|expression|import|javascript|data:/i.test(value)) return false;
  return /^[-#%.,'"\w\s]+$/.test(value);
}

/** A font size, held inside what a page can actually show. */
function safeFontSize(value: string): string | null {
  const pct = /^(\d{1,3})%$/.exec(value.trim());
  if (pct) {
    const n = Number(pct[1]);
    if (n < MIN_FONT_PERCENT || n > MAX_FONT_PERCENT) return null;
    return `${n}%`;
  }
  // The toolbar writes percentages; an em value pasted from elsewhere is
  // converted rather than thrown away, so pasted work is not silently lost.
  const em = /^(\d(?:\.\d{1,2})?)(?:em|rem)$/.exec(value.trim());
  if (em) {
    const n = Math.round(Number(em[1]) * 100);
    if (n < MIN_FONT_PERCENT || n > MAX_FONT_PERCENT) return null;
    return `${n}%`;
  }
  const px = /^(\d{1,3})px$/.exec(value.trim());
  if (px) {
    const n = Math.round((Number(px[1]) / 16) * 100);
    if (n < MIN_FONT_PERCENT || n > MAX_FONT_PERCENT) return null;
    return `${n}%`;
  }
  return null;
}

/** Escape text so that it is text, wherever it ends up. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Turn the handful of entities we emit back into their characters. */
function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** The style attribute, rebuilt from only what is allowed. */
function cleanStyle(raw: string): string {
  const out: string[] = [];
  for (const part of raw.split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const prop = part.slice(0, at).trim().toLowerCase();
    let value = part.slice(at + 1).trim();
    if (!ALLOWED_STYLES.has(prop)) continue;
    if (!safeStyleValue(value)) continue;
    if (prop === "font-size") {
      const size = safeFontSize(value);
      if (!size) continue;
      value = size;
    }
    out.push(`${prop}:${value}`);
  }
  return out.join(";");
}

interface Tag {
  name: string;
  style: string;
}

/**
 * Sanitise a question's formatting.
 *
 * Returns HTML built from scratch out of the allowed parts of the input, with
 * every tag balanced — so it cannot escape the element it is rendered into
 * even if the input was truncated mid-tag.
 */
export function sanitizeRichText(
  input: string | null | undefined,
  maxLength = 20000,
): string {
  if (!input) return "";
  const src = input.slice(0, maxLength);
  const out: string[] = [];
  const open: Tag[] = [];
  let i = 0;

  const text = (s: string) => {
    if (s) out.push(escapeHtml(decodeEntities(s)));
  };

  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) {
      text(src.slice(i));
      break;
    }
    text(src.slice(i, lt));

    const gt = src.indexOf(">", lt);
    if (gt < 0) {
      // A tag that never closes is not a tag. Treat the rest as text so a
      // truncated paste shows up as written rather than vanishing.
      text(src.slice(lt));
      break;
    }
    const raw = src.slice(lt + 1, gt);
    i = gt + 1;

    // Comments, doctypes and processing instructions carry nothing a question
    // needs and are a well-worn way of smuggling markup past a filter.
    if (raw.startsWith("!") || raw.startsWith("?")) continue;

    // Skip an opaque element and everything inside it. If it never closes,
    // the rest of the input goes with it: an unterminated <script> is not
    // something to salvage words from.
    const opaque = /^([a-zA-Z0-9]+)/.exec(raw);
    if (opaque && OPAQUE_TAGS.has(opaque[1].toLowerCase())) {
      const closing = `</${opaque[1].toLowerCase()}`;
      const at = src.toLowerCase().indexOf(closing, i);
      if (at < 0) {
        i = src.length;
      } else {
        const shut = src.indexOf(">", at);
        i = shut < 0 ? src.length : shut + 1;
      }
      continue;
    }

    if (raw.startsWith("/")) {
      const name = raw.slice(1).trim().toLowerCase();
      if (!ALLOWED_TAGS.has(name) || VOID_TAGS.has(name)) continue;
      // Close back to the matching tag, so unbalanced input cannot leave a
      // tag hanging open past the end of the question.
      const at = open.map((t) => t.name).lastIndexOf(name);
      if (at < 0) continue;
      while (open.length > at) {
        const t = open.pop();
        if (t) out.push(`</${t.name}>`);
      }
      continue;
    }

    const nameMatch = /^([a-zA-Z0-9]+)/.exec(raw);
    if (!nameMatch) continue;
    const name = nameMatch[1].toLowerCase();

    // A paragraph or a line break in the source becomes a line break: a
    // question is one block of text, and a <div> from a paste should not be
    // able to carry its own layout into the paper.
    if (name === "p" || name === "div") {
      if (out.length) out.push("<br>");
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue;

    if (VOID_TAGS.has(name)) {
      out.push(`<${name}>`);
      continue;
    }

    // Attributes: only style, and only the properties above. Everything else,
    // including every `on*` handler, simply has no path into the output.
    let style = "";
    const attrs = raw.slice(nameMatch[1].length);
    const styleMatch = /\bstyle\s*=\s*("([^"]*)"|'([^']*)')/i.exec(attrs);
    if (styleMatch) style = cleanStyle(styleMatch[2] ?? styleMatch[3] ?? "");

    // A question nested twenty spans deep is a paste accident, and unbounded
    // nesting is a way to make rendering expensive.
    if (open.length >= 24) continue;

    open.push({ name, style });
    out.push(style ? `<${name} style="${style}">` : `<${name}>`);
  }

  while (open.length) {
    const t = open.pop();
    if (t) out.push(`</${t.name}>`);
  }

  return out.join("");
}

/**
 * The words of a formatted question, without the formatting.
 *
 * This is what the paper is really asking, and it is what everything other
 * than the screen uses: grading, the change history, an exported result, a
 * message to a parent. Keeping it beside the formatted version is what stops
 * a teacher making a word bold from counting as rewriting the question.
 */
export function richTextToPlain(html: string | null | undefined): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?\s*>/gi, "\n")
      .replace(/<\s*\/\s*(p|div)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, ""),
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether this content carries any formatting worth storing. */
export function hasFormatting(html: string | null | undefined): boolean {
  if (!html) return false;
  return /<(b|strong|i|em|u|mark|sup|sub|span|br)\b/i.test(html);
}

/**
 * The sizes the toolbar offers.
 *
 * Relative rather than absolute, so a question set larger stays larger on a
 * phone, on a projector and on the printed sheet instead of being pinned to
 * whatever the teacher's screen happened to be.
 */
export const RICH_TEXT_SIZES = [
  { id: "80%", label: "Small" },
  { id: "100%", label: "Normal" },
  { id: "125%", label: "Large" },
  { id: "150%", label: "Larger" },
  { id: "200%", label: "Huge" },
] as const;

/**
 * The colours a teacher may highlight with.
 *
 * Kept to a few that stay readable behind black text in both light and dark
 * mode, and that survive a black-and-white printer as distinguishable greys —
 * the result sheet is often photocopied.
 */
export const HIGHLIGHT_COLORS = [
  { id: "#fef08a", label: "Yellow" },
  { id: "#bbf7d0", label: "Green" },
  { id: "#bfdbfe", label: "Blue" },
  { id: "#fecaca", label: "Red" },
  { id: "#e9d5ff", label: "Purple" },
] as const;
