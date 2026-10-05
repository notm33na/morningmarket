#!/usr/bin/env node
// MarketMorning local preview (0 Make credits). Node 18+, no dependencies.
//
//   node tools/preview-digest.mjs            live: GDELT + CoinGecko + Gemini, keys from .env
//   node tools/preview-digest.mjs --sample   samples/ only, no network calls
//     add --variant=no-crypto or --variant=one-headline to test the degraded paths
//   node tools/preview-digest.mjs --make-body   print the raw Gemini body to paste into Make module 4
//
// Renders templates/digest-email.html and prompts/gemini-user.make.txt with a small
// evaluator for the Make expressions they use, so the preview sends and shows what Make will.
// Output: tests/previews/<date>[.sample[-variant]].html + .input.json (for the digest-qa agent).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const args = new Set(process.argv.slice(2));
const SAMPLE = args.has('--sample');
const VARIANT = [...args].find((a) => a.startsWith('--variant='))?.split('=')[1] ?? '';
if (VARIANT && !['no-crypto', 'one-headline'].includes(VARIANT)) throw new Error(`Unknown --variant=${VARIANT}`);

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin,dogecoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true';
const GEMINI_RETRY_MS = 20_000; // matches the Make Sleep module before the retry

// ---------- .env ----------
function loadEnv() {
  const env = {};
  const p = join(ROOT, '.env');
  if (!existsSync(p)) return env;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ---------- CSV (quoted fields, "" escapes) ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// ---------- Feed row: same values the Sheet formulas produce (docs/SHEET.md) ----------
// Sheets ENCODEURL leaves only A-Z a-z 0-9 - _ . ~ unencoded.
const encodeUrl = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function buildFeed(env) {
  const sheetMd = read('docs/SHEET.md');
  const fallbackSummary = sheetMd.match(/^\| FALLBACK_SUMMARY \| (.+?) \|$/m)[1];
  const terms = parseCsv(read('samples/news.csv')).map((r) => r.news_term).filter(Boolean);
  const query = '(' + terms.join(' OR ') + ') (stock OR shares OR crypto) sourcelang:english';
  return {
    send_enabled: 'TRUE',
    gdelt_url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeUrl(query) + '&mode=artlist&maxrecords=6&timespan=24h&sort=hybridrel&format=json',
    gemini_model: env.GEMINI_MODEL || '{{GEMINI_MODEL}}',
    fallback_json: JSON.stringify({ source: 'fallback', summary: fallbackSummary.replace(/"/g, "'"), story1_id: 1, story1_why: '', story2_id: 2, story2_why: '', crypto_note: '' }),
    active_count: 3,
    batch_count: 1,
    batch_1: '{{TEST_EMAIL+mm1}},{{TEST_EMAIL+mm2}},{{TEST_EMAIL+mm3}}',
    batch_2: '',
    batch_3: '',
    site_url: env.SITE_URL || 'https://media-and-software-manger.vercel.app',
    owner_email: '{{TEST_EMAIL}}',
    fallback_summary: fallbackSummary,
  };
}

// ---------- Make expression evaluator (subset used by our templates) ----------
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let s = ''; i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === '\\' && i + 1 < src.length) { s += src[i + 1]; i += 2; } else s += src[i++];
      }
      i++; out.push({ t: 'str', v: s }); continue;
    }
    const two = src.slice(i, i + 2);
    if (['>=', '<=', '!='].includes(two)) { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()=<>+-;'.includes(c)) { out.push({ t: c === '(' || c === ')' || c === ';' ? c : 'op', v: c }); i++; continue; }
    const m = src.slice(i).match(/^[A-Za-z0-9_.\[\]]+/);
    if (!m) throw new Error(`Unexpected "${c}" in {{${src}}}`);
    out.push({ t: 'word', v: m[0] }); i += m[0].length;
  }
  return out;
}

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const eat = (t) => { const k = tokens[p++]; if (!k || (t && k.t !== t)) throw new Error(`Expected ${t}`); return k; };
  function expr() {
    let left = additive();
    if (peek()?.t === 'op' && ['=', '!=', '>=', '<=', '>', '<'].includes(peek().v)) {
      const op = eat().v; left = { k: 'cmp', op, a: left, b: additive() };
    }
    return left;
  }
  function additive() {
    let left = primary();
    while (peek()?.t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = eat().v; left = { k: 'arith', op, a: left, b: primary() };
    }
    return left;
  }
  function primary() {
    const k = eat();
    if (k.t === 'str') return { k: 'lit', v: k.v };
    if (k.t === '(') { const e = expr(); eat(')'); return e; }
    if (k.t !== 'word') throw new Error(`Unexpected token ${k.v}`);
    if (peek()?.t === '(') {
      eat('(');
      const argv = [];
      if (peek()?.t !== ')') { argv.push(expr()); while (peek()?.t === ';') { eat(';'); argv.push(expr()); } }
      eat(')');
      return { k: 'call', name: k.v, args: argv };
    }
    if (/^\d+(\.\d+)?$/.test(k.v)) return { k: 'lit', v: Number(k.v) };
    return { k: 'word', v: k.v };
  }
  const e = expr();
  if (p !== tokens.length) throw new Error('Trailing tokens');
  return e;
}

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const truthy = (v) => !(isEmpty(v) || v === false || v === 'false');
const num = (v) => (typeof v === 'number' ? v : v === '' || v == null ? NaN : Number(v));

function resolvePath(path, ctx) {
  const parts = path.split('.');
  let cur = ctx.bundles[parts.shift()];
  for (const part of parts) {
    const m = part.match(/^([^\[]+)((?:\[\d+\])*)$/);
    if (!m) return undefined;
    cur = cur?.[m[1]];
    for (const ix of m[2].matchAll(/\[(\d+)\]/g)) cur = cur?.[Number(ix[1]) - 1]; // Make arrays are 1-based
  }
  return cur;
}

function formatNumber(n, dec, decSep, thouSep) {
  const x = num(n);
  if (Number.isNaN(x)) return '';
  const [int, frac] = Math.abs(x).toFixed(Number(dec)).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep ?? '');
  return (x < 0 && Number(Math.abs(x).toFixed(Number(dec))) !== 0 ? '-' : '') + grouped + (frac ? decSep + frac : '');
}

function formatDate(d, fmt, tz) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'UTC', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const h24 = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', hour: '2-digit', hourCycle: 'h23' }).format(d));
  const monthNum = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz || 'UTC', month: 'numeric' }).format(d));
  const map = {
    dddd: parts.weekday, ddd: parts.weekday.slice(0, 3), MMMM: parts.month, MMM: parts.month.slice(0, 3),
    MM: String(monthNum).padStart(2, '0'), YYYY: parts.year, DD: parts.day.padStart(2, '0'), D: parts.day,
    HH: String(h24).padStart(2, '0'), hh: parts.hour.padStart(2, '0'), h: parts.hour, mm: parts.minute, A: parts.dayPeriod.toUpperCase(),
  };
  return fmt.replace(/dddd|ddd|MMMM|MMM|MM|YYYY|DD|D|HH|hh|h|mm|A/g, (t) => map[t]);
}

const FUNCS = {
  if: (c, a, b) => (truthy(c) ? a : b),
  ifempty: (a, b) => (isEmpty(a) ? b : a),
  get: (arr, i) => (Array.isArray(arr) ? arr[num(i) - 1] : undefined),
  map: (arr, key) => (Array.isArray(arr) ? arr.map((x) => x?.[key]) : []),
  join: (arr, sep) => (Array.isArray(arr) ? arr.join(sep) : ''),
  split: (s, sep) => (isEmpty(s) ? [] : String(s).split(sep)),
  replace: (s, a, b) => (s == null ? '' : String(s).split(a).join(b)),
  length: (x) => (Array.isArray(x) || typeof x === 'string' ? x.length : 0),
  escapeHTML: (s) => (s == null ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')),
  formatNumber,
  formatDate,
  parseDate: (v, f) => (isEmpty(v) ? undefined : f === 'X' ? new Date(num(v) * 1000) : new Date(v)),
};

function evaluate(node, ctx) {
  switch (node.k) {
    case 'lit': return node.v;
    case 'word':
      if (node.v === 'emptyarray') return [];
      if (node.v === 'now') return ctx.now;
      if (node.v === 'true') return true;
      if (node.v === 'false') return false;
      return resolvePath(node.v, ctx);
    case 'call': {
      const fn = FUNCS[node.name];
      if (!fn) throw new Error(`Unsupported Make function ${node.name}()`);
      return fn(...node.args.map((a) => evaluate(a, ctx)));
    }
    case 'arith': {
      const a = evaluate(node.a, ctx), b = evaluate(node.b, ctx);
      if (node.op === '-') return num(a) - num(b);
      return !Number.isNaN(num(a)) && !Number.isNaN(num(b)) ? num(a) + num(b) : `${a ?? ''}${b ?? ''}`;
    }
    case 'cmp': {
      const a = evaluate(node.a, ctx), b = evaluate(node.b, ctx);
      if (node.op === '=') return String(a ?? '') === String(b ?? '');
      if (node.op === '!=') return String(a ?? '') !== String(b ?? '');
      const x = num(a), y = num(b);
      if (Number.isNaN(x) || Number.isNaN(y)) return false;
      return { '>=': x >= y, '<=': x <= y, '>': x > y, '<': x < y }[node.op];
    }
  }
}

const stringify = (v) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : v instanceof Date ? v.toISOString() : String(v));
const render = (tpl, ctx) => tpl.replace(/\{\{([\s\S]*?)\}\}/g, (_, src) => stringify(evaluate(parse(tokenize(src)), ctx)));

// ---------- Gemini body (identical text is pasted into Make module 4) ----------
function makeBody() {
  const system = read('prompts/digest.system.md').trim();
  const schema = JSON.parse(read('prompts/digest.schema.json'));
  const user = read('prompts/gemini-user.make.txt').replace(/\s+$/, '');
  // JSON-escape only the literal text; {{expressions}} stay as Make sees them.
  const userEscaped = user.split(/(\{\{[\s\S]*?\}\})/).map((seg) => (seg.startsWith('{{') ? seg : JSON.stringify(seg).slice(1, -1))).join('');
  return `{"systemInstruction":{"parts":[{"text":${JSON.stringify(system)}}]},"contents":[{"role":"user","parts":[{"text":"${userEscaped}"}]}],"generationConfig":{"responseMimeType":"application/json","responseJsonSchema":${JSON.stringify(schema)}}}`;
}

// ---------- network ----------
async function getJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) { console.warn(`  ${new URL(url).host}: HTTP ${res.status} -> treated as empty (Make Resume)`); return undefined; }
    const text = await res.text();
    try { return JSON.parse(text); } catch { console.warn(`  ${new URL(url).host}: non-JSON body -> treated as empty`); return undefined; }
  } catch (e) { console.warn(`  ${new URL(url).host}: ${e.message} -> treated as empty`); return undefined; }
}

async function callGemini(env, body) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY }, body, signal: AbortSignal.timeout(60_000) });
      if (res.ok) return await res.json();
      console.warn(`  Gemini attempt ${attempt}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    } catch (e) { console.warn(`  Gemini attempt ${attempt}: ${e.message}`); }
    if (attempt === 1) await new Promise((r) => setTimeout(r, GEMINI_RETRY_MS));
  }
  return undefined; // Make: retry route Resumes with empty data
}

// ---------- main ----------
async function main() {
  if (args.has('--make-body')) { process.stdout.write(makeBody() + '\n'); return; }

  const env = loadEnv();
  const feed = buildFeed(env);
  const now = new Date();
  let gdelt, coingecko, geminiResponse;

  if (SAMPLE) {
    gdelt = JSON.parse(read('samples/gdelt.sample.json'));
    coingecko = JSON.parse(read('samples/coingecko.sample.json'));
    if (VARIANT === 'no-crypto') coingecko = undefined; // Make module 3 Resumes with empty data
    if (VARIANT === 'one-headline') gdelt = { articles: gdelt.articles.slice(0, 1) };
    const out = JSON.parse(read(`samples/gemini-output${VARIANT ? '.' + VARIANT : ''}.sample.json`));
    geminiResponse = { candidates: [{ content: { parts: [{ text: JSON.stringify(out) }] }, finishReason: 'STOP' }] };
  } else {
    for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'COINGECKO_API_KEY']) if (!env[k]) throw new Error(`Missing ${k} in .env (or use --sample)`);
    console.log('GDELT:', feed.gdelt_url);
    gdelt = await getJson(feed.gdelt_url);
    coingecko = await getJson(COINGECKO_URL, { 'x-cg-demo-api-key': env.COINGECKO_API_KEY });
  }

  const ctx = { now, bundles: { 1: feed, 2: { data: gdelt }, 3: { data: coingecko } } };

  // Router R1
  const articles = gdelt?.articles ?? [];
  if (feed.send_enabled !== 'TRUE' || (articles.length === 0 && isEmpty(coingecko?.bitcoin?.usd))) {
    console.log('SKIPPED (route B): no headlines and no crypto data.');
    return;
  }

  // Module 4 body: render exactly as Make would, then check it is valid JSON (check C6)
  const bodyText = render(makeBody(), ctx);
  let bodyJson;
  try { bodyJson = JSON.parse(bodyText); } catch (e) { throw new Error(`Rendered Gemini body is not valid JSON (check C6): ${e.message}`); }
  if (!SAMPLE) geminiResponse = await callGemini(env, bodyText);
  ctx.bundles[4] = { data: geminiResponse };

  // Module 5: Parse JSON with fallback
  const text = evaluate(parse(tokenize('ifempty(4.data.candidates[1].content.parts[1].text; 1.fallback_json)')), ctx);
  let digest;
  try { digest = JSON.parse(text); } catch { digest = { source: 'fallback', summary: feed.fallback_summary, story1_id: 1, story1_why: '', story2_id: 2, story2_why: '', crypto_note: '' }; }
  ctx.bundles[5] = digest;

  const html = render(read('templates/digest-email.html'), ctx);
  const date = formatDate(now, 'YYYY-MM-DD', 'America/New_York');
  const base = join(ROOT, 'tests', 'previews', SAMPLE ? `${date}.sample${VARIANT ? '-' + VARIANT : ''}` : date);
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(base + '.html', html);
  writeFileSync(base + '.input.json', JSON.stringify({
    mode: SAMPLE ? `sample${VARIANT ? ':' + VARIANT : ''}` : 'live',
    generated_at: now.toISOString(),
    feed: { ...feed, batch_1: '(redacted)' },
    gdelt,
    coingecko,
    gemini_user_text: bodyJson.contents[0].parts[0].text,
    gemini_output: digest,
    ai_source: digest.source === 'fallback' ? 'fallback' : 'gemini',
  }, null, 2));
  console.log(`Wrote ${base}.html and .input.json (AI: ${digest.source === 'fallback' ? 'fallback' : 'gemini'})`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
