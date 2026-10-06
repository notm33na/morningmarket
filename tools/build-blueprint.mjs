#!/usr/bin/env node
// Build an importable Make blueprint of the whole MarketMorning scenario (ARCHITECTURE §2). Node 18+, no dependencies.
//
//   node tools/build-blueprint.mjs      → blueprints/raw/MarketMorning.import.json (gitignored)
//
// Import it in Make: Create a new scenario › ⋯ › Import Blueprint. Then follow docs/IMPORT.md
// (connections, keychains, BLS key, data structures, schedule). Re-run after any change to
// prompts/gemini-body.make.txt, templates/digest-email.html or prompts/bls-request.make.json.
//
// Module IDs are fixed here as label number + 1 (ID 1 unused), the IDs the template and prompts map.
// Routers and directives get IDs 19+. No connections, keychains or keys are written: the Sheet ID
// and Slack channel ID come from .env (MM_SHEET_ID, SLACK_CHANNEL_ID) or stay as [PLACEHOLDERS].

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

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

const env = loadEnv();
const SHEET_ID = env.MM_SHEET_ID || '[SHEET ID]';
const SLACK_CHANNEL = env.SLACK_CHANNEL_ID || '[SLACK CHANNEL ID]';
const GEMINI_BODY = read('prompts/gemini-body.make.txt').replace(/\r?\n$/, '');
const EMAIL_HTML = read('templates/digest-email.html');
const BLS_BODY = read('prompts/bls-request.make.json').trim();

// ---------- shared expressions (MAIA-PROMPTS Step 4) ----------
const FED = 'ifempty(18.rss.channel[1].item; emptyarray)';
// Batches delivered, counting only batches that exist (6–8 always run, C13b: an empty batch mails the owner only)
const SENT = 'if(7.id; 1; 0) + if(2.`4` < 2; 0; if(8.id; 1; 0)) + if(2.`4` < 3; 0; if(9.id; 1; 0))';
const STATUS = `if(2.\`4\` = 0; "ok"; if((${SENT}) = 0; "failed"; if((${SENT}) < 2.\`4\`; "partial"; if(6.source = "fallback"; "ok_no_ai"; "ok"))))`;
const ERR_SOURCES = `{{if(6.source = "fallback"; "AI fallback. "; "")}}{{if(3.data.Results.series[1].data[1].value; ""; "No BLS data. ")}}{{if(4.data.bitcoin.usd; ""; "No crypto data. ")}}{{if(length(${FED}) = 0; "No Fed feed. "; "")}}`;
const SOURCE_COUNT = `{{length(${FED}) + if(4.data.bitcoin.usd; 1; 0) + if(3.data.Results.series[1].data[1].value; 1; 0)}}`;
const TODAY = '{{formatDate(now; "YYYY-MM-DD"; "America/New_York")}}';
const UA = 'MarketMorning portfolio demo';

// ---------- module builders ----------
const X = 300; // designer grid
const at = (col, row) => ({ x: col * X, y: row * 150 });
const mod = (id, module, version, name, pos, { parameters = {}, mapper = {}, filter, onerror } = {}) => ({
  id, module, version, parameters, ...(filter ? { filter } : {}), mapper,
  metadata: { designer: { ...pos, name } },
  ...(onerror ? { onerror } : {}),
});
let nextId = 19; // routers and directives: IDs no mapping refers to
const directive = (kind, pos, mapper) => ({
  id: nextId++, module: `builtin:${kind}`, version: 1,
  ...(mapper ? { parameters: {}, mapper } : {}),
  metadata: { designer: pos },
});
const resume = (pos, mapper) => [directive('Resume', pos, mapper)];
const ignore = (pos) => [directive('Ignore', pos)];

const http = (id, name, pos, { url, method = 'get', auth = false, headers, body, parse = true, timeout = 20 }, extra = {}) =>
  mod(id, 'http:MakeRequest', 4, name, pos, {
    // auth: API-key keychain chosen after import (docs/IMPORT.md); never written here
    parameters: { authenticationType: auth ? 'apiKey' : 'noAuth' },
    mapper: {
      url, method,
      ...(headers ? { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) } : {}),
      ...(body ? { contentType: 'json', inputMethod: 'jsonString', jsonStringBodyContent: body } : {}),
      timeout, shareCookies: false, parseResponse: parse, allowRedirects: true,
      stopOnHttpError: true, // "Evaluate all states as errors: Yes"
      requestCompressedContent: true,
    },
    ...extra,
  });

const slack = (id, name, pos, text, onerror) =>
  mod(id, 'slack:CreateMessage', 4, name, pos, {
    mapper: { text, channelWType: 'list', channelType: 'public', channel: SLACK_CHANNEL, parse: false, mrkdwn: true, unfurl_links: false, unfurl_media: false },
    onerror,
  });

const addRow = (id, name, pos, values, onerror) =>
  mod(id, 'google-sheets:addRow', 2, name, pos, {
    mapper: {
      mode: 'map', spreadsheetId: SHEET_ID, sheetId: 'SendLog', tableFirstRow: 'A1:Z1', insertDataOption: 'INSERT_ROWS',
      // "Enter manually" mode keys columns by position (A = "0" …), not by header name
      valueInputOption: 'USER_ENTERED', insertUnformatted: false,
      values: Object.fromEntries(['date', 'subscribers', 'batches', 'status', 'error'].map((k, i) => [String(i), values[k]])),
    },
    onerror,
  });

const gmail = (id, batch, pos) =>
  mod(id, 'google-email:sendAnEmail', 4, `${id - 1} Send batch ${batch}`, pos, {
    mapper: {
      to: ['{{2.`9`}}'],
      bcc: `{{split(2.\`${4 + batch}\`; ",")}}`,
      subject: 'MarketMorning · {{formatDate(now; "ddd, MMM D"; "America/New_York")}}: the Fed, US data and crypto',
      bodyType: 'rawHtml',
      content: EMAIL_HTML,
      emailHeaders: [{ key: 'List-Unsubscribe', value: '<{{2.`8`}}/unsubscribe>' }],
    },
    onerror: resume({ ...pos, y: pos.y + 150 }),
  });

const geminiCall = (id, name, pos, modelCol, timeout, onerror) =>
  http(id, name, pos, {
    url: `https://generativelanguage.googleapis.com/v1beta/models/{{2.\`${modelCol}\`}}:generateContent`,
    method: 'post', auth: true, body: GEMINI_BODY, timeout,
  }, { onerror });

// ---------- flow (Make ID = label + 1) ----------
const r1 = {
  id: nextId++, module: 'builtin:BasicRouter', version: 1, mapper: null,
  metadata: { designer: { ...at(5, 0), name: 'R1 Content check' } },
};
// No R2 (C13b): a module on one router route can't map modules on a sibling route, so 6 → 7 → 8 → 9 → 10 is a plain chain.
const sendAndLog = () => [
    gmail(7, 1, at(8, -1)),
    gmail(8, 2, at(9, -1)),
    gmail(9, 3, at(10, -1)),
    addRow(10, '9 Log run', at(11, -1), {
      date: TODAY,
      subscribers: '{{2.`3`}}',
      batches: `{{${SENT}}}`,
      status: `{{${STATUS}}}`,
      error: `${ERR_SOURCES}{{if((${SENT}) < 2.\`4\`; "Batch failures. "; "")}}`,
    }, resume(at(11, 0))),
    slack(11, '10 Report run', at(12, -1),
      `MarketMorning {{${STATUS}}}: attempted {{2.\`3\`}} subscribers, {{${SENT}}}/{{2.\`4\`}} batches delivered. ${ERR_SOURCES}`,
      ignore(at(12, 0))),
];

const gemini = geminiCall(5, '4 Gemini digest', at(6, -1), 1, 60, [
  mod(15, 'util:FunctionSleep', 1, '14 Wait before retry', at(6, -3), { mapper: { duration: 10 } }),
  geminiCall(16, '15 Gemini fallback model', at(7, -3), 11, 40, resume(at(7, -4))),
  directive('Resume', at(8, -3), { data: '{{16.data}}' }),
]);
gemini.filter = {
  name: 'Content OK',
  conditions: [[
    { a: '{{2.`0`}}', o: 'text:equal', b: 'TRUE' },
    { a: SOURCE_COUNT, o: 'number:greater', b: '0' },
  ]],
};

const parseDigest = mod(6, 'json:ParseJSON', 1, '5 Parse digest', at(7, -1), {
  mapper: { json: '{{ifempty(5.data.candidates[1].content.parts[1].text; 2.`2`)}}' },
  onerror: resume(at(7, 0), { source: 'fallback', summary: '{{2.`10`}}', crypto_note: '' }),
});

const logSkip = addRow(12, '11 Log skip', at(6, 2), {
  date: TODAY, subscribers: '{{2.`3`}}', batches: '0', status: 'skipped', error: 'send disabled or no content',
}, resume(at(6, 3)));
// Inverse of "Content OK" (works like Make's fallback route, but explicit)
logSkip.filter = {
  name: 'Skip',
  conditions: [
    [{ a: '{{2.`0`}}', o: 'text:notequal', b: 'TRUE' }],
    [{ a: SOURCE_COUNT, o: 'number:equal', b: '0' }],
  ],
};

r1.routes = [
  { flow: [gemini, parseDigest, ...sendAndLog()] },
  { flow: [logSkip, slack(13, '12 Alert skip', at(7, 2),
    'MarketMorning SKIPPED: SEND_ENABLED off, or the Fed feed, BLS and CoinGecko all empty.', ignore(at(7, 3)))] },
];

const flow = [
  mod(2, 'google-sheets:getSheetContent', 2, '1 Read Feed', at(0, 0), {
    mapper: { select: 'map', spreadsheetId: SHEET_ID, sheetId: 'Feed', range: 'A2:L2', includesHeaders: false }, // A1:L2 with headers also returns the header row as a bundle (2026-10-06)
    onerror: [
      slack(14, '13 Alert sheet fail', at(0, 2), 'MarketMorning FAILED: Sheet read: {{error.message}}', ignore(at(0, 3))),
      directive('Ignore', at(1, 2)),
    ],
  }),
  http(3, '2 BLS latest numbers', at(1, 0), {
    url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/', method: 'post',
    headers: { 'User-Agent': UA }, body: BLS_BODY,
  }, { onerror: resume(at(1, 1)) }),
  http(4, '3 CoinGecko prices', at(2, 0), {
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,ripple,binancecoin,dogecoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',
    auth: true,
  }, { onerror: resume(at(2, 1)) }),
  http(17, '16 Fed speeches', at(3, 0), {
    url: 'https://www.federalreserve.gov/feeds/speeches.xml',
    headers: { 'User-Agent': `${UA} ({{2.\`8\`}})` }, parse: false,
  }, { onerror: resume(at(3, 1)) }),
  mod(18, 'xml:ParseXML', 1, '17 Parse Fed RSS', at(4, 0), { mapper: { xml: '{{17.data}}' }, onerror: resume(at(4, 1)) }),
  r1,
];

const blueprint = {
  name: 'MarketMorning',
  flow,
  metadata: {
    instant: false,
    version: 1,
    scenario: {
      roundtrips: 1, maxErrors: 3, autoCommit: true, autoCommitTriggerLast: true, sequential: false,
      slots: null, confidential: false, // on before go-live (BUILD-ORDER §7)
      dataloss: false, dlq: false, freshVariables: false,
    },
    designer: { orphans: [] },
    notes: [],
  },
};

// ---------- sanity: every label 1–17 is Make ID label + 1, directives/routers ≥ 19 ----------
const all = [];
const walk = (fl) => fl.forEach((m) => { all.push(m); (m.routes || []).forEach((r) => walk(r.flow)); if (m.onerror) walk(m.onerror); });
walk(flow);
const ids = all.map((m) => m.id);
if (new Set(ids).size !== ids.length) throw new Error(`Duplicate module IDs: ${ids}`);
for (const m of all) {
  const label = Number(m.metadata.designer.name?.match(/^(\d+) /)?.[1]);
  if (label && m.id !== label + 1) throw new Error(`Module "${m.metadata.designer.name}" has ID ${m.id}, expected ${label + 1}`);
  if (!label && m.id < 19) throw new Error(`Router/directive with ID ${m.id} < 19`);
}

// ---------- sanity: no text Make's editor rewrites (seen in the 2026-10-06 export) ----------
// " " (a lone space) is saved as an empty argument (use the space keyword); \" inside a string breaks the parser.
const strings = [];
const collect = (v) => (typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' && Object.values(v).forEach(collect));
collect(flow);
const exprs = strings.flatMap((s) => s.match(/\{\{[\s\S]*?\}\}/g) || []);
const bad = exprs.filter((e) => e.includes('\\"') || /[(;]\s*" "\s*[;)]/.test(e));
if (bad.length) throw new Error(`Make would rewrite these expressions:\n${bad.slice(0, 3).join('\n')}`);

const out = join(ROOT, 'blueprints', 'raw', 'MarketMorning.import.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(blueprint, null, 2) + '\n');
const left = [SHEET_ID, SLACK_CHANNEL].filter((v) => v.startsWith('['));
console.log(`Wrote ${out}: ${all.length} modules (IDs ${Math.min(...ids)}–${Math.max(...ids)}).`);
if (left.length) console.log(`Not in .env, fill in after import: ${left.join(', ')} (set MM_SHEET_ID / SLACK_CHANNEL_ID to skip this).`);
