/**
 * Scheduled-article notification script (run hourly by GitHub Actions).
 *
 * Scans src/content/articles/*.md and emails the publisher once per article,
 * roughly 24 hours before a scheduled article's pubDate goes live.
 *
 * Dedup strategy: a committed tracking file (.github/scheduled/notified.json)
 * stores the slugs that have already been notified. This is preferred over a
 * `notified` frontmatter field because Studio saves rewrite the full
 * frontmatter (which would silently drop a `notified` flag and cause duplicate
 * emails), and because committing a field into every article would churn
 * article content on each notification. The tracking file is tiny, only ever
 * appended to, and committed back with "[skip ci]" so it never re-triggers a
 * deploy.
 *
 * Env:
 *   RESEND_API_KEY     (secret) — Resend API key (re_...)
 *   NOTIFICATION_EMAIL (secret) — where to send the notification
 *   RESEND_FROM        (secret) — verified sender, e.g. "Name <no-reply@yourdomain.com>"
 *   GITHUB_TOKEN       — provided automatically (for committing the tracking file)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ARTICLES_DIR = "src/content/articles";
const TRACKING_FILE = ".github/scheduled/notified.json";
const WINDOW_HOURS = 25; // pubDate within the next ~25h → notify now (≈24h ahead)

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
// Testable endpoint override (defaults to Resend's REST API).
const RESEND_API_URL =
  process.env.RESEND_API_URL || "https://api.resend.com/emails";
const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL || "israel.alabi.seo@gmail.com"; // site contact fallback
const RESEND_FROM =
  process.env.RESEND_FROM || "The Technology Joint <onboarding@resend.dev>";

/* ------------------------------------------------------------------ */
/* Minimal frontmatter parsing (no YAML dependency needed)              */
/* ------------------------------------------------------------------ */

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const fm = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (key !== "tags" && key !== "title" && key !== "description") {
      // strip quotes for scalar fields we care about
      val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
    if (fm[key] === undefined) fm[key] = val;
  }
  return fm;
}

function isDraft(fm) {
  return String(fm.draft ?? "false").toLowerCase() === "true";
}

function parsePubDate(fm) {
  const raw = String(fm.pubDate || "").replace(/^"(.*)"$/, "$1").trim();
  if (!raw) return null;
  // Normalize YAML timestamp separators ("2026-07-16 14:30:00" -> "T")
  const normalized = raw.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return { raw, date };
}

/* ------------------------------------------------------------------ */
/* Resend email                                                        */
/* ------------------------------------------------------------------ */

async function sendNotification({ title, pubDateRaw, pubDateDate }) {
  const hoursAway = Math.max(
    0,
    Math.round((pubDateDate.getTime() - Date.now()) / 36e5),
  );
  const when = pubDateDate.toUTCString();

  const subject = `Scheduled to go live: ${title}`;
  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #1e293b;">Your article goes live soon</h2>
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        <strong>${escapeHtml(title)}</strong> is scheduled to be published
        automatically by the next scheduled site rebuild.
      </p>
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        Scheduled date/time: <strong>${escapeHtml(when)}</strong>
        (about ${hoursAway} hour${hoursAway === 1 ? "" : "s"} from now)
      </p>
      <p style="color: #64748b; font-size: 14px;">
        No action is needed — the hourly rebuild will publish it when the time
        arrives.
      </p>
    </div>
  `;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [NOTIFICATION_EMAIL],
      subject,
      html,
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  console.log(`  ✔ email sent to ${NOTIFICATION_EMAIL}: "${subject}"`);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const tracking = existsSync(TRACKING_FILE)
  ? JSON.parse(readFileSync(TRACKING_FILE, "utf8"))
  : [];
const notified = new Set(Array.isArray(tracking) ? tracking : []);

const files = existsSync(ARTICLES_DIR)
  ? readdirSync(ARTICLES_DIR).filter((f) => f.endsWith(".md"))
  : [];
console.log(`Scanning ${files.length} article(s)`);

const now = Date.now();
let changed = false;

if (!RESEND_API_KEY) {
  console.log(
    "SKIPPED: RESEND_API_KEY is not set. Add it as a GitHub Actions secret to enable email notifications.",
  );
} else {
  for (const file of files) {
    const slug = file.replace(/\.md$/, "");
    if (notified.has(slug)) continue;

    const fm = parseFrontmatter(readFileSync(join(ARTICLES_DIR, file), "utf8"));
    if (isDraft(fm)) continue;

    const parsed = parsePubDate(fm);
    if (!parsed) continue;
    if (parsed.date.getTime() <= now) continue; // already published/past

    const msUntil = parsed.date.getTime() - now;
    const hoursUntil = msUntil / 36e5;
    if (hoursUntil > WINDOW_HOURS) continue; // too far out

    const title = String(fm.title || slug).replace(/^"(.*)"$/, "$1");
    console.log(
      `→ notifying "${title}" — pubDate ${parsed.raw} is ${hoursUntil.toFixed(1)}h away`,
    );
    try {
      await sendNotification({
        title,
        pubDateRaw: parsed.raw,
        pubDateDate: parsed.date,
      });
      notified.add(slug);
      changed = true;
    } catch (err) {
      // Do NOT mark as notified on failure — the next run will retry.
      console.error(`  ✖ failed to notify "${slug}": ${err.message}`);
    }
  }
}

if (changed) {
  const sorted = [...notified].sort();
  writeFileSync(TRACKING_FILE, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Updated ${TRACKING_FILE} (${sorted.length} total notified)`);
} else {
  console.log("No tracking changes.");
}
