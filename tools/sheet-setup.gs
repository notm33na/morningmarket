/**
 * MarketMorning – Google Sheet setup (docs/SHEET.md; keep both in sync). Paste into
 * Extensions › Apps Script of the Sheet, choose setupMarketMorning, click Run, allow access,
 * then read the Execution log.
 *
 * Safe to re-run: Config keeps every existing value (only missing keys are added); Feed and
 * Dashboard are rebuilt; data rows in Subscribers, TxLog and SendLog are never touched.
 * resetConfigDefaults() exists separately if you ever want the default Config back.
 */
const CONFIG_DEFAULTS = [
  ['SEND_ENABLED', true],
  ['SUBSCRIBER_CAP', 300],
  ['BATCH_SIZE', 100],
  ['TX_CONFIRM_CAP', 70],
  ['TX_UNSUB_CAP', 30],
  ['GEMINI_MODEL', '[GEMINI_MODEL]'],
  ['GEMINI_FALLBACK_MODEL', '[GEMINI_FALLBACK_MODEL]'],
  ['SITE_URL', 'https://media-and-software-manger.vercel.app'],
  ['OWNER_EMAIL', '[YOUR EMAIL]'],
  ['FALLBACK_SUMMARY', "Today's AI summary is unavailable. The sections below come straight from official and licensed sources."],
];

function setupMarketMorning() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetLocale('en_US');
  ss.setSpreadsheetTimeZone('America/New_York');

  const order = ['Config', 'Subscribers', 'TxLog', 'SendLog', 'Feed', 'Dashboard'];
  order.forEach((name, i) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(i + 1);
  });
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) ss.deleteSheet(sheet1);

  const cfg = (key) => `VLOOKUP("${key}",Config!$A:$B,2,FALSE)`;
  const header = (name, cols) => {
    const sh = ss.getSheetByName(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    return sh;
  };

  // Config: add missing keys only, never overwrite existing values
  const config = header('Config', ['key', 'value']);
  const existing = config.getLastRow() > 1 ? config.getRange(2, 1, config.getLastRow() - 1, 1).getValues().map((r) => r[0]) : [];
  const added = CONFIG_DEFAULTS.filter(([k]) => !existing.includes(k));
  if (added.length) config.getRange(config.getLastRow() + 1, 1, added.length, 2).setValues(added);

  // Data tabs: headers + plain-text timestamp columns (ISO strings must stay text)
  header('Subscribers', ['email', 'status', 'created_at', 'confirmed_at', 'unsubscribed_at', 'token_nonce']).getRange('C:E').setNumberFormat('@');
  header('TxLog', ['sent_at', 'type', 'email_hash']).getRange('A:A').setNumberFormat('@');
  header('SendLog', ['date', 'subscribers', 'batches', 'status', 'error']).getRange('A:A').setNumberFormat('@');

  // Feed (row 1 keys A–L, row 2 formulas)
  const batch = (n) => `=IFERROR(TEXTJOIN(",",TRUE,QUERY(FILTER(Subscribers!A2:A,Subscribers!B2:B="active"),"select Col1 limit "&MIN(${cfg('BATCH_SIZE')},${cfg('SUBSCRIBER_CAP')}-${n}*${cfg('BATCH_SIZE')})&" offset "&${n}*${cfg('BATCH_SIZE')},0)),"")`;
  const feed = [
    ['send_enabled', `=IF(${cfg('SEND_ENABLED')}=TRUE,"TRUE","FALSE")`],
    ['gemini_model', `=${cfg('GEMINI_MODEL')}`],
    ['fallback_json', `="{""source"":""fallback"",""summary"":"""&SUBSTITUTE(${cfg('FALLBACK_SUMMARY')},"""","'")&""",""crypto_note"":""""}"`],
    ['active_count', `=MIN(COUNTIF(Subscribers!B2:B,"active"),${cfg('SUBSCRIBER_CAP')})`],
    ['batch_count', `=ROUNDUP(D2/${cfg('BATCH_SIZE')},0)`],
    ['batch_1', batch(0)],
    ['batch_2', batch(1)],
    ['batch_3', batch(2)],
    ['site_url', `=${cfg('SITE_URL')}`],
    ['owner_email', `=${cfg('OWNER_EMAIL')}`],
    ['fallback_summary', `=${cfg('FALLBACK_SUMMARY')}`],
    ['gemini_fallback_model', `=${cfg('GEMINI_FALLBACK_MODEL')}`],
  ];
  const feedSh = ss.getSheetByName('Feed');
  feedSh.clear();
  header('Feed', feed.map((f) => f[0]));
  feed.forEach((f, i) => feedSh.getRange(2, i + 1).setFormula(f[1]));

  // Dashboard (labels in column A)
  const dash = ss.getSheetByName('Dashboard');
  dash.getCharts().forEach((c) => dash.removeChart(c));
  dash.clear();
  const metrics = [
    ['Active', '=COUNTIF(Subscribers!B:B,"active")'],
    ['Pending', '=COUNTIF(Subscribers!B:B,"pending")'],
    ['Waitlist', '=COUNTIF(Subscribers!B:B,"waitlist")'],
    ['Unsubscribed', '=COUNTIF(Subscribers!B:B,"unsubscribed")'],
    ['Cap used', `=B2/${cfg('SUBSCRIBER_CAP')}`],
    ['Transactional emails today (New York date)', '=COUNTIF(TxLog!A:A,TEXT(TODAY(),"yyyy-mm-dd")&"*")'],
    ['Last run status', '=IFERROR(INDEX(SendLog!D:D,COUNTA(SendLog!D:D)),"")'],
    ['Rows due for purge', '=COUNTIF(Subscribers!B:B,"unsubscribed")+SUMPRODUCT((Subscribers!B2:B="pending")*(IFERROR(DATEVALUE(LEFT(Subscribers!C2:C,10)),TODAY())<TODAY()-7))'],
  ];
  dash.getRange('A1:B1').setValues([['Metric', 'Value']]).setFontWeight('bold');
  metrics.forEach((m, i) => {
    dash.getRange(i + 2, 1).setValue(m[0]);
    dash.getRange(i + 2, 2).setFormula(m[1]);
  });
  dash.getRange('B6').setNumberFormat('0%');
  dash.getRange('D1').setValue('Signups per day').setFontWeight('bold');
  dash.getRange('D2').setFormula(`=IFERROR(QUERY({ARRAYFORMULA(IFERROR(TO_DATE(DATEVALUE(LEFT(Subscribers!C2:C,10))))),Subscribers!A2:A},"select Col1, count(Col2) where Col1 is not null group by Col1 label Col1 'day', count(Col2) 'signups'",0),"no signups yet")`);
  dash.getRange('D3:D400').setNumberFormat('yyyy-mm-dd');
  dash.getRange('J1').setValue('Runs not ok').setFontWeight('bold');
  dash.getRange('J2').setFormula('=IFERROR(FILTER(SendLog!A2:E,SendLog!D2:D<>"ok",SendLog!D2:D<>""),"none")');

  const sendLog = ss.getSheetByName('SendLog');
  dash.insertChart(dash.newChart().setChartType(Charts.ChartType.COLUMN).addRange(dash.getRange('D2:E200')).setNumHeaders(1)
    .setOption('title', 'Signups per day').setOption('width', 450).setPosition(12, 1, 0, 0).build());
  dash.insertChart(dash.newChart().setChartType(Charts.ChartType.LINE).addRange(sendLog.getRange('A1:B400')).setNumHeaders(1)
    .setOption('title', 'Subscribers sent per run').setOption('width', 450).setPosition(12, 7, 0, 0).build());
  dash.insertChart(dash.newChart().setChartType(Charts.ChartType.PIE).addRange(dash.getRange('A2:B5'))
    .setOption('title', 'Status mix').setOption('width', 450).setPosition(32, 1, 0, 0).build());

  // Self-check
  SpreadsheetApp.flush();
  const ERR = /^#(N\/A|ERROR!|NAME\?|REF!|VALUE!|DIV\/0!|NUM!)/;
  const problems = [];
  ss.getRange('Feed!A2:L2').getDisplayValues()[0].forEach((v, i) => {
    const cell = `Feed!${String.fromCharCode(65 + i)}2`;
    if (ERR.test(v)) problems.push(`${cell}: ${v}`);
    if (/^\[.*\]$/.test(v)) problems.push(`${cell}: placeholder ${v} not replaced in Config`);
  });
  ss.getRange('Dashboard!B2:B9').getDisplayValues().forEach((r, i) => { if (ERR.test(r[0])) problems.push(`Dashboard!B${i + 2}: ${r[0]}`); });
  Logger.log(`Tabs: ${order.join(', ')}`);
  Logger.log(added.length ? `Config keys added: ${added.map((a) => a[0]).join(', ')}` : 'Config: all keys already present, values kept.');
  Logger.log(`Feed formulas: ${feed.length}; Dashboard formulas: ${metrics.length + 2}; charts: 3`);
  Logger.log(problems.length ? `Check these:\n${problems.join('\n')}` : 'No formula errors or placeholders left (batch_1..3 may be empty until Subscribers has active rows).');
  Logger.log('Next: add site-sheet-api.gs as a second file, run setupSecret() and deploy it as a Web app (see its header).');
}

/** Only if you want the default Config back: overwrites every Config value. */
function resetConfigDefaults() {
  const config = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  config.getRange(2, 1, Math.max(config.getMaxRows() - 1, 1), 2).clearContent();
  config.getRange(2, 1, CONFIG_DEFAULTS.length, 2).setValues(CONFIG_DEFAULTS);
}
