#!/usr/bin/env node
/**
 * seed-owner.mjs — One-time script to create the owner account.
 *
 * Usage:
 *   KV_REST_API_URL=... KV_REST_API_TOKEN=... node scripts/seed-owner.mjs
 *
 * This script creates the owner account ("israel_alabi") in the Upstash Redis
 * store. It can only be run once — if an owner already exists, it exits.
 *
 * Environment variables required:
 *   KV_REST_API_URL     — from Vercel KV (Upstash)
 *   KV_REST_API_TOKEN   — from Vercel KV (Upstash)
 *
 * Credentials are hardcoded in this script. Change the password after
 * first login.
 */

import { randomBytes, scryptSync } from "node:crypto";

const OWNER_USERNAME = "israel_alabi";
const OWNER_PASSWORD = "Israel does SEO.";
const OWNER_DISPLAY = "Israel Alabi";

// --- KV client (minimal, no dependencies beyond node:crypto) ---

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

if (!KV_URL || !KV_TOKEN) {
  console.error("Error: KV_REST_API_URL and KV_REST_API_TOKEN must be set.");
  console.error("Get them from your Vercel KV (Upstash) dashboard.");
  process.exit(1);
}

async function kvRequest(method, path, body) {
  const url = `${KV_URL}${path}`;
  const headers = {
    Authorization: `Bearer ${KV_TOKEN}`,
    "Content-Type": "application/json",
  };
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

async function main() {
  // Check if owner already exists
  const existing = await kvRequest("GET", `/get/ttj:owner`);
  if (existing && existing.result) {
    console.error(`Owner account already exists (${existing.result}).`);
    console.error("Aborting — you can only seed the owner once.");
    process.exit(1);
  }

  const password = OWNER_PASSWORD;
  const { salt, hash } = hashPassword(password);

  // Create user record
  const userRecord = {
    username: OWNER_USERNAME,
    salt,
    hash,
    role: "owner",
    displayName: OWNER_DISPLAY,
    createdAt: Date.now(),
  };

  await kvRequest("SET", `/set/ttj:user:${OWNER_USERNAME}`, {
    value: JSON.stringify(userRecord),
    ex: 60 * 60 * 24 * 365 * 10, // 10 years
  });

  // Set owner pointer
  await kvRequest("SET", "/set/ttj:owner", {
    value: OWNER_USERNAME,
    ex: 60 * 60 * 24 * 365 * 10,
  });

  console.log("\n✅ Owner account created successfully!\n");
  console.log("┌──────────────────────────────────────────┐");
  console.log("│  Owner Credentials                       │");
  console.log("├──────────────────────────────────────────┤");
  console.log(`│  Username:  ${OWNER_USERNAME.padEnd(26)}│`);
  console.log(`│  Password:  ${OWNER_PASSWORD.padEnd(26)}│`);
  console.log("│  Display:   Israel Alabi                 │");
  console.log("│                                          │");
  console.log("│  ⚠️  Change this password after login.   │");
  console.log("└──────────────────────────────────────────┘\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message || err);
  process.exit(1);
});
