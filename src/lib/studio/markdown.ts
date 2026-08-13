/**
 * Tiny, dependency-free Markdown renderer for the Studio editor's live
 * preview. Deliberately small and safe: all input is HTML-escaped before any
 * formatting is applied, so raw HTML in the body is shown as text, never
 * executed.
 *
 * Supported: headings, paragraphs, fenced code blocks, blockquotes,
 * unordered/ordered lists, horizontal rules, inline code, bold, italic,
 * strikethrough, links and images.
 */

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Inline formatting                                                    */
/* ------------------------------------------------------------------ */

function inline(value: string): string {
    const escaped = escapeHtml(value);
    const tokens: string[] = [];
    const stash = (html: string) => {
        tokens.push(html);
        return `\u0000${tokens.length - 1}\u0000`;
    };

    // Code spans first — their contents must never be re-formatted.
    let out = escaped.replace(
        /`([^`\n]+)`/g,
        (_match, code: string) => stash(`<code>${code}</code>`),
    );

    // Images ![alt](src "title")
    out = out.replace(
        /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (_match, alt: string, src: string, title?: string) => {
            if (!/^(https?:)?\/\//i.test(src) && !src.startsWith("/")) {
                return _match;
            }
            return stash(
                `<img loading="lazy" src="${src}" alt="${alt}"${title ? ` title="${title}"` : ""} />`,
            );
        },
    );

    // Links [text](url "title") — http(s), mailto, anchors and site paths only.
    out = out.replace(
        /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
        (_match, text: string, href: string, title?: string) => {
            if (!/^(https?:\/\/|mailto:|#|\/)/i.test(href)) return _match;
            const external = /^https?:\/\//i.test(href)
                ? ' target="_blank" rel="noopener"'
                : "";
            return stash(
                `<a href="${href}"${external}${title ? ` title="${title}"` : ""}>${text}</a>`,
            );
        },
    );

    // Bold, italic, strikethrough. The (^|[^*_]) guards keep single markers
    // inside words (e.g. file*names) from accidentally opening emphasis.
    out = out
        .replace(/\*\*([^*\n]+)\*\*/g, (_m, t: string) => stash(`<strong>${t}</strong>`))
        .replace(/__([^_\n]+)__/g, (_m, t: string) => stash(`<strong>${t}</strong>`))
        .replace(/(^|[^*])\*([^*\n]+)\*/g, (_m, pre: string, t: string) => `${pre}${stash(`<em>${t}</em>`)}`)
        .replace(/(^|[^_])_([^_\n]+)_/g, (_m, pre: string, t: string) => `${pre}${stash(`<em>${t}</em>`)}`)
        .replace(/~~([^~\n]+)~~/g, (_m, t: string) => stash(`<del>${t}</del>`));

    return out.replace(/\u0000(\d+)\u0000/g, (_m, index: string) => tokens[Number(index)] ?? "");
}

/* ------------------------------------------------------------------ */
/* Block rendering                                                      */
/* ------------------------------------------------------------------ */

/** Render a Markdown string to safe HTML for the editor preview pane. */
export function renderMarkdown(source: string): string {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const html: string[] = [];

    let list: { ordered: boolean; items: string[] } | null = null;
    let quote: string[] = [];
    let para: string[] = [];

    const flushPara = () => {
        if (para.length > 0) {
            html.push(`<p>${inline(para.join(" "))}</p>`);
            para = [];
        }
    };
    const flushQuote = () => {
        if (quote.length > 0) {
            html.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
            quote = [];
        }
    };
    const flushList = () => {
        if (list) {
            const tag = list.ordered ? "ol" : "ul";
            html.push(
                `<${tag}>${list.items
                    .map((item) => `<li>${inline(item)}</li>`)
                    .join("")}</${tag}>`,
            );
            list = null;
        }
    };
    const flushAll = () => {
        flushPara();
        flushQuote();
        flushList();
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // Fenced code block
        const fence = line.match(/^```([\w-]*)/);
        if (fence) {
            flushAll();
            const lang = fence[1];
            const code: string[] = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                code.push(lines[i]);
                i++;
            }
            i++; // skip the closing fence
            html.push(
                `<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`,
            );
            continue;
        }

        // Heading
        const heading = line.match(/^(#{1,6})\s+(.*)/);
        if (heading) {
            flushAll();
            const level = heading[1].length;
            html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            i++;
            continue;
        }

        // Horizontal rule
        if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
            flushAll();
            html.push("<hr />");
            i++;
            continue;
        }

        // Blank line closes any open block
        if (line.trim() === "") {
            flushAll();
            i++;
            continue;
        }

        // Blockquote
        const quoteMatch = line.match(/^\s*>\s?(.*)/);
        if (quoteMatch) {
            flushPara();
            flushList();
            quote.push(quoteMatch[1]);
            i++;
            continue;
        }

        // List item
        const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+(.*)/);
        if (listMatch) {
            flushPara();
            flushQuote();
            const ordered = /\d/.test(listMatch[1]);
            if (list && list.ordered === ordered) {
                list.items.push(listMatch[2]);
            } else {
                flushList();
                list = { ordered, items: [listMatch[2]] };
            }
            i++;
            continue;
        }

        // Plain paragraph line
        flushQuote();
        flushList();
        para.push(line);
        i++;
    }

    flushAll();
    return html.join("\n");
}
