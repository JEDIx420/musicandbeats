import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import assert from 'assert';

const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// Simulate realistic network delay per file
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  const delay = req.url.endsWith('.html') ? 20 : 70;
  setTimeout(() => {
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(file).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }, delay);
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log(`Boot test server listening on http://127.0.0.1:${port}`);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = 56910;
const chromeProc = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${chromePort}`,
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--autoplay-policy=no-user-gesture-required'
]);

function cleanup() {
  try { chromeProc.kill('SIGKILL'); } catch {}
  try { server.close(); } catch {}
}

const watchdog = setTimeout(() => {
  console.error('\n[WATCHDOG TIMEOUT]: test-boot-fouc.mjs timed out');
  cleanup();
  process.exit(1);
}, 45000);

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

let versionData = null;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
    if (r.ok) { versionData = await r.json(); break; }
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}
assert(versionData, 'Failed to connect to headless Chrome');

const newPageRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?http://127.0.0.1:${port}/index.html`, { method: 'PUT' });
const pageData = await newPageRes.json();
const ws = new WebSocket(pageData.webSocketDebuggerUrl);

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
const consoleErrors = [];

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    const text = msg.params.args.map(a => a.value !== undefined ? a.value : JSON.stringify(a)).join(' ');
    consoleErrors.push(text);
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || msg.error));
    else resolve(msg.result);
  }
};

function send(method, params = {}, timeoutMs = 8000) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout waiting for ${method} (id=${id})`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');

// Emulate mobile 4G network: 120ms roundtrip latency
await send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 120,
  downloadThroughput: (2 * 1024 * 1024) / 8,
  uploadThroughput: (1 * 1024 * 1024) / 8
});

// Navigate cleanly to index.html with throttling enabled
await send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });

console.log('Testing boot visual states for FOUC and old UI exposure...');

let flashedOldUi = false;
let splashDroppedBeforeReady = false;
let bootCompleted = false;

// Check state every 200ms over a 10s span
for (let step = 0; step < 50; step++) {
  await new Promise(r => setTimeout(r, 200));
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const splash = document.querySelector('#mbBootSplash');
      const splashStyle = splash ? window.getComputedStyle(splash) : null;
      const appShell = document.querySelector('.app-shell');
      const appShellStyle = appShell ? window.getComputedStyle(appShell) : null;
      const splashVisible = splashStyle ? (splashStyle.opacity !== '0' && splashStyle.visibility !== 'hidden') : false;
      const appShellVisible = appShellStyle ? (appShellStyle.opacity !== '0' && appShellStyle.visibility !== 'hidden') : false;
      
      const homeScreen = document.querySelector('#homeScreen');
      const text = (homeScreen?.innerText || '').replace(/\\s+/g, ' ');
      
      // Obsolete V1 strings that must NEVER be visible to the user:
      const containsOldV1 = /What do you want to do/i.test(text) || /START A SESSION/i.test(text) || /Open performance mode/i.test(text);
      
      const v39Ready = Boolean(window.MB_V39 && document.documentElement.classList.contains('mb-ready'));
      
      return {
        splashVisible,
        appShellVisible,
        containsOldV1,
        v39Ready,
        text: text.slice(0, 80)
      };
    })()`,
    returnByValue: true
  });

  const state = res.result?.value;
  if (!state) continue;

  if (state.appShellVisible && state.containsOldV1) {
    console.error(`[FAIL] Old V1 UI flashed while app shell was visible! Text: "${state.text}"`);
    flashedOldUi = true;
  }

  if (!state.splashVisible && !state.v39Ready) {
    console.error(`[FAIL] Splash screen dropped before V39 was ready!`);
    splashDroppedBeforeReady = true;
  }

  if (state.v39Ready && state.appShellVisible && !state.splashVisible) {
    bootCompleted = true;
    break;
  }
}

clearTimeout(watchdog);
cleanup();

assert(!flashedOldUi, 'REGRESSION: Old UI flashed on screen during boot!');
assert(!splashDroppedBeforeReady, 'REGRESSION: Splash gate dropped before V39 finished loading and decorating!');
assert(bootCompleted, 'FAIL: Boot failed to complete into ready state!');
assert(consoleErrors.length === 0, `FAIL: Console errors occurred during boot: ${consoleErrors.join(', ')}`);

console.log('--- Boot FOUC & Old UI Flash Regression Tests ---');
console.log('PASS: Old V1 UI never visible during boot');
console.log('PASS: Splash gate remains active until V39 is ready and decorated');
console.log('PASS: Smooth transition directly into modern workstation UI');
console.log('PASS: Zero console errors');
console.log('\n======================================================');
console.log('ALL BOOT FOUC TESTS PASSED (0 errors)!');
console.log('======================================================\n');
process.exit(0);
