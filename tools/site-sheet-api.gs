/**
 * MarketMorning: Sheet API for the site's /api/mm/* endpoints (Cloudflare Worker ms-manager-site; replaces a Google Cloud service account).
 * Paste into the MarketMorning Sheet: Extensions › Apps Script › file "SiteApi" (next to sheet-setup.gs).
 *
 * Setup (once):
 *   1. Run setupSecret() and copy the secret from the log → Worker secret MM_SCRIPT_SECRET.
 *   2. Project Settings › Script properties › add MM_HMAC_SECRET = the same value as the Worker's MM_HMAC_SECRET.
 *   3. Deploy › New deployment › type Web app › Execute as: Me › Who has access: Anyone › Deploy.
 *      Copy the Web app URL (…/exec) → Worker secret MM_SCRIPT_URL.
 *   After editing this file: Deploy › Manage deployments › pencil (edit) › Version: New version › Deploy
 *   (the /exec URL stays the same; "New deployment" would make a new URL).
 *
 * Operations (all require the secret):
 *   legacy (kept for older site builds and manual use):
 *     read Config | Subscribers | TxLog,  append Subscribers | TxLog,  update one Subscribers row
 *   v2 (one call per site action, run under the script lock, safe to retry with the same inputs):
 *     subscribe     {email, nonce, at}         → {ok, send}         upsert by email_hash; reserves the TxLog row if in budget
 *     confirm       {h, n, newNonce, at}       → {ok, result}       result: confirmed | waitlisted | invalid
 *     unsubRequest  {email, at}                → {ok, send, nonce}  reserves the TxLog row if subscribed and in budget
 *     unsubConfirm  {h, n, newNonce, at}       → {ok, result}       result: unsubscribed | invalid
 * Everything is written as plain text, so nothing a visitor types can become a formula.
 */
const SHEETS = { Config: 2, Subscribers: 6, TxLog: 3 };
const WRITABLE = { Subscribers: true, TxLog: true };
const V2 = { subscribe: subscribe_, confirm: confirm_, unsubRequest: unsubRequest_, unsubConfirm: unsubConfirm_ };

function setupSecret() {
  const secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('MM_SCRIPT_SECRET', secret);
  Logger.log('MM_SCRIPT_SECRET = ' + secret);
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad_request' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('MM_SCRIPT_SECRET');
  if (!secret || req.secret !== secret) return json({ ok: false, error: 'forbidden' });

  if (V2[req.op]) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json({ ok: false, error: 'busy' }); // nothing applied; the Worker retries
    try { return json(Object.assign({ ok: true }, V2[req.op](req))); }
    catch (err) { return json({ ok: false, error: 'v2_failed' }); }   // a v2 op throws before any write or after all of them
    finally { lock.releaseLock(); }
  }

  const width = SHEETS[req.sheet];
  const sheet = width && SpreadsheetApp.getActiveSpreadsheet().getSheetByName(req.sheet);
  if (!sheet) return json({ ok: false, error: 'bad_sheet' });

  if (req.op === 'read') {
    const last = sheet.getLastRow();
    const values = last < 2 ? [] : sheet.getRange(2, 1, last - 1, width).getDisplayValues();
    return json({ ok: true, values }); // unfiltered: values[i] is sheet row i + 2
  }

  if (!WRITABLE[req.sheet] || !Array.isArray(req.row) || req.row.length !== width) return json({ ok: false, error: 'bad_write' });
  const row = req.row.map((v) => (v == null ? '' : String(v)));
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let n;
    if (req.op === 'append') n = sheet.getLastRow() + 1;
    else if (req.op === 'update' && req.sheet === 'Subscribers' && Number.isInteger(req.rowNumber) && req.rowNumber >= 2) n = req.rowNumber;
    else return json({ ok: false, error: 'bad_op' });
    sheet.getRange(n, 1, 1, width).setNumberFormat('@').setValues([row]);
    return json({ ok: true, rowNumber: n });
  } finally {
    lock.releaseLock();
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- v2 helpers (called only under the script lock) ----------
const sheet_ = (name) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
function rows_(name) {
  const s = sheet_(name), last = s.getLastRow();
  return last < 2 ? [] : s.getRange(2, 1, last - 1, SHEETS[name]).getDisplayValues();
}
function config_() {
  const c = {};
  rows_('Config').forEach((r) => { c[r[0]] = r[1]; });
  const num = (k, d) => (c[k] !== '' && c[k] != null && isFinite(Number(c[k])) ? Number(c[k]) : d);
  return { cap: num('SUBSCRIBER_CAP', 300), txConfirmCap: num('TX_CONFIRM_CAP', 70), txUnsubCap: num('TX_UNSUB_CAP', 30) };
}
// Subscribers: email | status | created_at | confirmed_at | unsubscribed_at | token_nonce (A–F)
function subscribers_() {
  return rows_('Subscribers').map((r, i) => ({
    row: i + 2, email: String(r[0] || '').toLowerCase(), status: r[1] || '', created_at: r[2] || '',
    confirmed_at: r[3] || '', unsubscribed_at: r[4] || '', token_nonce: r[5] || '',
  })).filter((s) => s.email);
}
function writeRow_(name, rowNumber, values) {
  const n = rowNumber || sheet_(name).getLastRow() + 1;
  sheet_(name).getRange(n, 1, 1, values.length).setNumberFormat('@').setValues([values.map((v) => (v == null ? '' : String(v)))]);
}
const writeSub_ = (s) => writeRow_('Subscribers', s.row, [s.email, s.status, s.created_at, s.confirmed_at, s.unsubscribed_at, s.token_nonce]);

/** Same as the Worker's emailHash: first 32 hex chars of HMAC-SHA256(MM_HMAC_SECRET, lowercased email). */
function emailHash_(email) {
  const key = PropertiesService.getScriptProperties().getProperty('MM_HMAC_SECRET');
  if (!key) throw new Error('MM_HMAC_SECRET script property missing');
  const sig = Utilities.computeHmacSha256Signature(String(email).toLowerCase(), key, Utilities.Charset.UTF_8);
  return sig.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('').slice(0, 32);
}

/** Budget check (rolling 24 h); an exact [at, type, hash] row means this call already reserved it (a retry). */
function reserveTx_(type, hash, at, cfg) {
  const log = rows_('TxLog');
  if (log.some((r) => r[0] === at && r[1] === type && r[2] === hash)) return true;
  const now = Date.parse(at);
  const recent = log.filter((r) => now - Date.parse(r[0]) < 24 * 3600000);
  const cap = type === 'confirm' ? cfg.txConfirmCap : cfg.txUnsubCap;
  if (recent.filter((r) => r[1] === type).length >= cap) return false;
  const mine = recent.filter((r) => r[2] === hash);
  if (mine.length >= 3 || mine.some((r) => now - Date.parse(r[0]) < 15 * 60000)) return false;
  writeRow_('TxLog', 0, [at, type, hash]);
  return true;
}

/** Find the row a token points at. A row already carrying newNonce means this call already ran (a retry). */
function tokenRow_(req) {
  const subs = subscribers_();
  const done = subs.find((s) => s.token_nonce && s.token_nonce === req.newNonce);
  if (done) return { sub: done, subs, done: true };
  const sub = subs.find((s) => s.token_nonce && s.token_nonce === req.n);
  return sub && emailHash_(sub.email) === req.h ? { sub, subs, done: false } : null;
}

// ---------- v2 operations ----------
function subscribe_(req) {
  const email = String(req.email || '').toLowerCase();
  if (!email || !req.nonce || !req.at) throw new Error('bad input');
  const cfg = config_(), existing = subscribers_().find((s) => s.email === email);
  if (existing && (existing.status === 'active' || existing.status === 'waitlist')) return { send: false };
  // Upsert: the same inputs always produce the same row, so a retry rewrites identical values.
  writeSub_({ row: existing ? existing.row : 0, email, status: 'pending', created_at: req.at, confirmed_at: '', unsubscribed_at: '', token_nonce: req.nonce });
  return { send: reserveTx_('confirm', emailHash_(email), req.at, cfg) };
}

function confirm_(req) {
  const t = tokenRow_(req);
  if (!t) return { result: 'invalid' };
  const sub = t.sub;
  if (!t.done) {
    if (sub.status === 'pending') {
      const active = t.subs.filter((s) => s.status === 'active').length;
      sub.status = active < config_().cap ? 'active' : 'waitlist';
      sub.confirmed_at = req.at;
    }
    sub.token_nonce = req.newNonce; // single use
    writeSub_(sub);
  }
  return { result: sub.status === 'waitlist' ? 'waitlisted' : sub.status === 'active' ? 'confirmed' : 'invalid' };
}

function unsubRequest_(req) {
  const email = String(req.email || '').toLowerCase();
  const sub = subscribers_().find((s) => s.email === email);
  if (!sub || ['pending', 'active', 'waitlist'].indexOf(sub.status) < 0 || !sub.token_nonce) return { send: false };
  return reserveTx_('unsub_confirm', emailHash_(email), req.at, config_()) ? { send: true, nonce: sub.token_nonce } : { send: false };
}

function unsubConfirm_(req) {
  const t = tokenRow_(req);
  if (!t) return { result: 'invalid' };
  if (t.done) return { result: 'unsubscribed' }; // promotion already happened in the first run
  const sub = t.sub;
  sub.status = 'unsubscribed'; sub.unsubscribed_at = req.at; sub.token_nonce = req.newNonce;
  writeSub_(sub);
  const others = t.subs.filter((s) => s.row !== sub.row);
  const active = others.filter((s) => s.status === 'active').length;
  const next = others.filter((s) => s.status === 'waitlist').sort((a, b) => a.confirmed_at.localeCompare(b.confirmed_at))[0];
  if (next && active < config_().cap) { next.status = 'active'; writeSub_(next); }
  return { result: 'unsubscribed' };
}
