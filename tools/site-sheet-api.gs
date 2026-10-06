/**
 * MarketMorning: Sheet API for the site's /api/mm/* functions (replaces a Google Cloud service account).
 * Paste into the MarketMorning Sheet: Extensions › Apps Script › new file "SiteApi" (next to sheet-setup.gs).
 *
 * Setup (once):
 *   1. Run setupSecret() and copy the secret from the log → Vercel env MM_SCRIPT_SECRET.
 *   2. Deploy › New deployment › type Web app › Execute as: Me › Who has access: Anyone › Deploy.
 *      Copy the Web app URL (…/exec) → Vercel env MM_SCRIPT_URL.
 *   After editing this file: Deploy › Manage deployments › edit › Version: New version (the URL stays the same).
 *
 * Only these operations exist, and only with the secret:
 *   read Config | Subscribers | TxLog (data rows, from row 2)
 *   append Subscribers | TxLog,  update one Subscribers row
 * Everything is written as plain text, so nothing a visitor types can become a formula.
 */
const SHEETS = { Config: 2, Subscribers: 6, TxLog: 3 };
const WRITABLE = { Subscribers: true, TxLog: true };

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
