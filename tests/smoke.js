// Concrete Calculator BD - headless-Chrome smoke tests via raw CDP.
// Run: node tests/smoke.js   (spawns /opt/meta-chromium/chrome, file:// page)
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const PORT = 9341;
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log('ok - ' + name); }
  else { failed++; console.log('FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('chrome debugger endpoint never came up');
}

async function main() {
  const policyPath = '/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt';
  const policySha = crypto.createHash('sha256').update(fs.readFileSync(policyPath)).digest('hex');
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--no-first-run',
    '--user-data-dir=/tmp/concrete-smoke-profile',
    '--hatch-webgl-allowed-domains-file=' + policyPath,
    '--hatch-webgl-allowed-domains-sha256=' + policySha,
    PAGE,
  ], { stdio: 'ignore' });
  const errors = [];
  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && pending.has(data.id)) {
        const { res, rej } = pending.get(data.id);
        pending.delete(data.id);
        if (data.error) rej(new Error(JSON.stringify(data.error)));
        else res(data.result);
      }
      if (data.method === 'Runtime.consoleAPICalled' && data.params && data.params.type === 'error') {
        errors.push(JSON.stringify(data.params.args));
      }
      if (data.method === 'Runtime.exceptionThrown') errors.push('exception');
    };
    function send(method, params) {
      return new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    }
    async function ev(expression) {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await sleep(800);
    await send('Runtime.evaluate', { expression: 'localStorage.clear(); location.reload();', returnByValue: true });
    await sleep(800);

    check('title renders', await ev("document.getElementById('appTitle').textContent") === 'Concrete Calculator BD');
    check('5 element options', await ev("document.querySelectorAll('#elType option').length") === 5);
    check('circCol hides 3rd dim', await ev("document.getElementById('elType').value='circCol'; document.getElementById('elType').dispatchEvent(new Event('change')); document.getElementById('dim3Wrap').classList.contains('hidden')") === true);
    check('slab shows 3rd dim again', await ev("document.getElementById('elType').value='slab'; document.getElementById('elType').dispatchEvent(new Event('change')); !document.getElementById('dim3Wrap').classList.contains('hidden')") === true);

    // Slab case: 10x12x0.5 ft, M15, wastage 0, prices 550/60/55.
    // Wet 60.00 ft3 / 1.70 m3; dry 2.62; cement 538.25 kg = 10.76 bags (buy 11);
    // sand 26.40 ft3; agg 52.80 ft3; cost 11*550 + 26.40*60 + 52.80*55 = 10,538.00.
    await ev("document.getElementById('d1').value='10'; document.getElementById('d2').value='12'; document.getElementById('d3').value='0.5'; document.getElementById('unitSel').value='ft'; document.getElementById('mixSel').value='M15'; document.getElementById('wastage').value='0'; document.getElementById('priceBag').value='550'; document.getElementById('priceSand').value='60'; document.getElementById('priceAgg').value='55'; document.getElementById('calcBtn').click(); document.getElementById('resultBox').textContent");
    const res = await ev("document.getElementById('resultBox').textContent");
    check('slab volume 60.00 ft3', res.includes('60.00'), res);
    check('slab volume 1.70 m3', res.includes('1.70'), res);
    check('slab cement 10.76 bags, buy 11', res.includes('10.76') && res.includes('11'), res);
    check('slab sand 26.40 ft3', res.includes('26.40'), res);
    check('slab agg 52.80 ft3', res.includes('52.80'), res);
    check('slab cost 10,538.00', res.includes('10,538.00'), res);
    check('add button enabled after calc', await ev("!document.getElementById('addBtn').disabled") === true);

    await ev("document.getElementById('addBtn').click(); document.querySelectorAll('#projectBody tr').length");
    check('project row added', await ev("document.querySelectorAll('#projectBody tr').length") === 1);
    const tot = await ev("document.getElementById('totalsRow').textContent");
    check('project totals show 11 bags + cost', tot.includes('11') && tot.includes('10,538.00'), tot);
    check('project persists after reload', await ev("location.reload(); 'reloading'") === 'reloading');
    await sleep(900);
    check('project row survives reload', await ev("document.querySelectorAll('#projectBody tr').length") === 1);

    check('validation error on empty dim', await ev("document.getElementById('d1').value=''; document.getElementById('calcBtn').click(); !document.getElementById('formError').classList.contains('hidden')") === true);

    check('BN toggle switches lang + Bengali title', await ev("document.getElementById('langBtn').click(); document.documentElement.lang === 'bn' && /[^\\x00-\\x7F]/.test(document.getElementById('appTitle').textContent)") === true);
    check('BN digits render', await ev("document.getElementById('resultBox').textContent") !== null &&
      await ev("/[\\u09e6-\\u09ef]/.test(document.querySelector('#projectBody tr td').textContent)") === true);

    // Mobile 390px: no horizontal overflow.
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    check('390px no horizontal overflow', await ev("document.documentElement.scrollWidth <= 390") === true, await ev("String(document.documentElement.scrollWidth)"));

    check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 300));
  } finally {
    chrome.kill();
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error('SMOKE HARNESS ERROR: ' + e.message); process.exit(2); });
