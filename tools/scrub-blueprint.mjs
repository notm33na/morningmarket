#!/usr/bin/env node
// Scrub Make blueprint exports before publishing. Node 18+, no dependencies.
//
//   node tools/scrub-blueprint.mjs            blueprints/raw/*.json → blueprints/<name>.json
//   node tools/scrub-blueprint.mjs --in=DIR --out=DIR
//
// Replaces connection/keychain IDs, Sheet IDs, Slack channel IDs, email addresses, Gemini model
// names and anything that looks like a key or token with {{UPPER_CASE}} placeholders, then
// re-scans the result. If anything sensitive is left, nothing is written to OUT: the result goes
// to IN/<name>.unsafe.json (gitignored under blueprints/raw/) and the script exits 1.
// After re-importing a scrubbed blueprint into Make, every {{UPPER_CASE}} value must be replaced.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') || def;
const IN = arg('in', join(ROOT, 'blueprints', 'raw'));
const OUT = arg('out', join(ROOT, 'blueprints'));

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const MODEL = /\b(?:gemini|gemma|learnlm)-(?:\d|flash|pro|exp|nano)[\w.-]*/gi;
const SHEET_URL_ID = /(\/spreadsheets\/d\/)[A-Za-z0-9_-]{25,}/g;
const KEY_PARAMS = /([?&](?:key|api_key|apikey|x_cg_demo_api_key|token)=)(?!\{\{)[^&"\s]+/gi;
const SECRET_KEYS = /^(api_?key|key|token|access_?token|refresh_?token|password|secret|client_?secret|authorization)$/i;
const ID_KEYS = /^(__IMT\w*__|\w*keychain\w*|connection)$/i;
const LEAKS = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/CG-[0-9A-Za-z]{15,}/, 'CoinGecko key'],
  [/xox[abprs]-[0-9A-Za-z-]+/, 'Slack token'],
  [/hooks\.slack\.com\/services\//, 'Slack webhook'],
  [/ya29\.|GOCSPX-|"1\/\/0/, 'Google OAuth token/secret'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/, 'email address'],
  [/\b(?:gemini|gemma|learnlm)-(?:\d|flash|pro|exp|nano)[\w.-]*/i, 'Gemini model name'],
  [/\/spreadsheets\/d\/(?!\{\{)|"spreadsheetId":\s*"(?!\{\{)/, 'Sheet ID'],
  [/"(channel|channelId|team\w*)":\s*"[CGDTU][A-Z0-9]{8,}"/, 'Slack channel/team ID'],
  [/"(__IMT\w*__|\w*keychain\w*|connection)":\s*\d/i, 'connection/keychain ID'],
];

function scrubString(s, key) {
  if (ID_KEYS.test(key)) return '{{CONNECTION}}';
  if (/spreadsheet(Id)?$/i.test(key) && !s.includes('{{')) return '{{SHEET_ID}}';
  if (/^(channel(Id)?|team\w*)$/i.test(key) && /^[CGDTU][A-Z0-9]{8,}$/.test(s)) return '{{SLACK_ID}}';
  if (SECRET_KEYS.test(key) && s && !s.includes('{{')) return '{{REDACTED}}';
  return s
    .replace(SHEET_URL_ID, '$1{{SHEET_ID}}')
    .replace(KEY_PARAMS, '$1{{REDACTED}}')
    .replace(EMAIL, key === 'label' ? '{{OWNER_EMAIL}}' : '{{TEST_EMAIL}}')
    .replace(MODEL, '{{GEMINI_MODEL}}');
}

function scrub(node, key = '') {
  if (Array.isArray(node)) return node.map((v) => scrub(v, key));
  if (node && typeof node === 'object') {
    // HTTP headers/query items are {name, value}: redact the value when the name looks like a credential
    const secretPair = typeof node.name === 'string' && /key|token|secret|authorization|password/i.test(node.name) && typeof node.value === 'string' && !node.value.includes('{{');
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, secretPair && k === 'value' ? '{{REDACTED}}' : scrub(v, k)]));
  }
  if (typeof node === 'string') return scrubString(node, key);
  if (typeof node === 'number' && (ID_KEYS.test(key) || SECRET_KEYS.test(key))) return '{{CONNECTION}}';
  return node;
}

if (!existsSync(IN)) { console.error(`No input folder ${IN}. Export the blueprint from Make into blueprints/raw/ first.`); process.exit(1); }
const files = readdirSync(IN).filter((f) => f.endsWith('.json') && !f.endsWith('.unsafe.json'));
if (!files.length) { console.error(`No .json files in ${IN}.`); process.exit(1); }
mkdirSync(OUT, { recursive: true });

let failed = false;
for (const f of files) {
  const clean = JSON.stringify(scrub(JSON.parse(readFileSync(join(IN, f), 'utf8'))), null, 2) + '\n';
  const left = LEAKS.filter(([re]) => re.test(clean)).map(([, what]) => what);
  if (left.length) {
    failed = true;
    const unsafe = join(IN, basename(f, '.json') + '.unsafe.json');
    writeFileSync(unsafe, clean);
    console.error(`${f}: STILL CONTAINS ${left.join(', ')}. Nothing written to ${OUT}; inspect ${unsafe} and extend the scrubber.`);
  } else {
    const target = join(OUT, basename(f));
    writeFileSync(target, clean);
    console.log(`${f}: scrubbed → ${target}`);
  }
}
process.exit(failed ? 1 : 0);
