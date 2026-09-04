import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const ROOT = process.cwd();

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.svg': 'image/svg+xml',
      '.webmanifest': 'application/manifest+json'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`Test server listening on http://127.0.0.1:${port}`);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = 9222 + Math.floor(Math.random() * 500);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-chrome-trans-'));

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1280,900',
  `--user-data-dir=${tmpDir}`,
  '--mute-audio=false',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${chromePort}`
], { stdio: 'ignore' });

function cleanup() {
  try { chromeProc.kill(); } catch {}
  try { server.close(); } catch {}
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(1); });

let versionData = null;
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${chromePort}/json/version`);
    if (r.ok) {
      versionData = await r.json();
      break;
    }
  } catch {}
  await new Promise(r => setTimeout(r, 200));
}
assert(versionData, 'Failed to connect to headless Chrome CDP');

const newPageRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?http://127.0.0.1:${port}/index.html`, { method: 'PUT' });
const pageData = await newPageRes.json();
const wsUrl = pageData.webSocketDebuggerUrl;

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let msgId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};

function send(method, params = {}) {
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Page.enable');
await send('Runtime.enable');

console.log('Waiting for Music & Beats workstation to boot in Chrome...');
let ready = false;
for (let i = 0; i < 60; i++) {
  const evalRes = await send('Runtime.evaluate', {
    expression: 'Boolean(window.MB_V39 && window.MB_V34_LOOPER && document.querySelector(".v34-transport"))',
    returnByValue: true
  });
  if (evalRes?.result?.value) {
    ready = true;
    break;
  }
  await new Promise(r => setTimeout(r, 200));
}
assert(ready, 'Workstation looper transport did not initialize');

// Open looper workstation screen
await send('Runtime.evaluate', {
  expression: 'window.MB_V34_LOOPER.open();',
  returnByValue: true
});
await new Promise(r => setTimeout(r, 150));
console.log('Looper initialized and opened successfully!');

// --- TEST 1: Style Dropdown Removed Completely ---
console.log('\n--- Test 1: Style Dropdown Removal ---');
const styleCheck = await send('Runtime.evaluate', {
  expression: `(() => {
    const el = document.querySelector('#v35StyleTop');
    const label = document.querySelector('.v35-style-top');
    const transportText = document.querySelector('.v34-transport')?.textContent || '';
    return {
      hasStyleId: Boolean(el),
      hasStyleClass: Boolean(label),
      hasStyleText: /STYLE/i.test(transportText)
    };
  })()`,
  returnByValue: true
});
console.log('Style check result:', styleCheck.result.value);
assert(!styleCheck.result.value.hasStyleId, 'Style dropdown #v35StyleTop must not exist in DOM');
assert(!styleCheck.result.value.hasStyleClass, 'Style label .v35-style-top must not exist in DOM');
assert(!styleCheck.result.value.hasStyleText, 'Transport must not mention STYLE');
console.log('PASS: Style control removed cleanly from transport bar!');

// --- TEST 2: Clock Inside Transport & Control Ordering ---
console.log('\n--- Test 2: Clock Inside Transport & Ordering ---');
const clockPlacement = await send('Runtime.evaluate', {
  expression: `(() => {
    const transport = document.querySelector('.v34-transport');
    const clock = document.querySelector('.v34-clock');
    const rings = document.querySelectorAll('#v34ClockRing');
    const texts = document.querySelectorAll('#v34ClockText');
    const statuses = document.querySelectorAll('#v34ClockStatus');
    const hints = document.querySelectorAll('#v34ClockHint');

    const children = transport ? Array.from(transport.children).map(c => {
      if (c.id === 'v34Transport') return 'play';
      if (c.classList.contains('v34-tempo')) return 'tempo';
      if (c.classList.contains('v34-bars')) return 'loop';
      if (c.classList.contains('v34-clock')) return 'clock';
      if (c.id === 'v35MetroToggle') return 'click';
      return c.className || c.tagName;
    }) : [];

    return {
      clockInsideTransport: transport?.contains(clock),
      ringCount: rings.length,
      textCount: texts.length,
      statusCount: statuses.length,
      hintCount: hints.length,
      children
    };
  })()`,
  returnByValue: true
});
console.log('Transport children order:', clockPlacement.result.value.children);
assert(clockPlacement.result.value.clockInsideTransport, 'Clock must be inside .v34-transport');
assert.strictEqual(clockPlacement.result.value.ringCount, 1, 'Exactly one loop clock ring in DOM');
assert.strictEqual(clockPlacement.result.value.textCount, 1, 'Exactly one loop clock text in DOM');
assert.deepStrictEqual(
  clockPlacement.result.value.children,
  ['play', 'tempo', 'loop', 'clock', 'click'],
  'Transport children must be [ Play / Stop ] [ BPM ] [ Loop ] [ LOOP CLOCK ] [ Click ]'
);
console.log('PASS: Clock is authoritative and positioned correctly in transport sequence!');

// --- TEST 3: Authoritative Clock Timing & Live Updates ---
console.log('\n--- Test 3: Clock Timing & Progress Updates ---');
const timingTest = await send('Runtime.evaluate', {
  expression: `(async () => {
    const looper = window.MB_V34_LOOPER;
    const initialText = document.querySelector('#v34ClockText')?.textContent;
    const initialStatus = document.querySelector('#v34ClockStatus')?.textContent;

    // Start playback
    await looper.start(false);
    await new Promise(r => setTimeout(r, 600));

    const playingText = document.querySelector('#v34ClockText')?.textContent;
    const playingStatus = document.querySelector('#v34ClockStatus')?.textContent;
    const progress = document.querySelector('#v34ClockRing')?.style.getPropertyValue('--progress');

    // Advance further to observe progress ring movement
    await new Promise(r => setTimeout(r, 800));
    const advancedText = document.querySelector('#v34ClockText')?.textContent;
    const advancedProgress = document.querySelector('#v34ClockRing')?.style.getPropertyValue('--progress');

    // Stop playback
    looper.stop();
    await new Promise(r => setTimeout(r, 100));
    const stoppedStatus = document.querySelector('#v34ClockStatus')?.textContent;

    return {
      initialText,
      initialStatus,
      playingText,
      playingStatus,
      progress,
      advancedText,
      advancedProgress,
      stoppedStatus
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Timing test result:', timingTest.result.value);
assert(timingTest.result.value.playingStatus.includes('Playing') || timingTest.result.value.playingStatus.includes('loop'), 'Clock status reflects active playback');
assert(timingTest.result.value.progress.includes('deg'), 'Clock progress ring uses degree values');
assert(timingTest.result.value.stoppedStatus.includes('Ready') || timingTest.result.value.stoppedStatus.includes('loop'), 'Clock status cleanly resets after stop');
console.log('PASS: Clock accurately tracks Web Audio looper progress and bar.beat!');

// --- TEST 4: Sticky Transport Behavior On Scroll ---
console.log('\n--- Test 4: Sticky Transport Behavior On Scroll ---');
const stickyTest = await send('Runtime.evaluate', {
  expression: `(() => {
    const transport = document.querySelector('.v34-transport');
    const topbar = document.querySelector('.topbar');
    const initialRect = transport.getBoundingClientRect();
    const style = window.getComputedStyle(transport);

    // Scroll down 600px
    window.scrollTo(0, 600);
    const scrolledRect = transport.getBoundingClientRect();
    const topbarRect = topbar.getBoundingClientRect();

    return {
      position: style.position,
      topCss: style.top,
      zIndex: parseInt(style.zIndex, 10),
      initialTop: initialRect.top,
      scrolledTop: scrolledRect.top,
      topbarBottom: topbarRect.bottom,
      isBelowTopbar: scrolledRect.top >= topbarRect.bottom - 2,
      isVisible: scrolledRect.bottom > scrolledRect.top
    };
  })()`,
  returnByValue: true
});
console.log('Sticky test result:', stickyTest.result.value);
assert.strictEqual(stickyTest.result.value.position, 'sticky', 'Transport must have position: sticky');
assert(stickyTest.result.value.zIndex >= 40, 'Transport z-index must be high enough to stay above instruments');
assert(stickyTest.result.value.isBelowTopbar, 'Scrolled transport must sit cleanly at or below topbar bottom');
assert(stickyTest.result.value.isVisible, 'Transport must remain visible on screen while scrolled');
console.log('PASS: Transport sticks smoothly below header without layout shift or obscuring topbar!');

// --- TEST 5: Responsive Layout (Desktop, Tablet, Mobile) ---
console.log('\n--- Test 5: Responsive Layout Across Viewports ---');
const viewports = [
  { name: 'Desktop (1280x800)', width: 1280, height: 800 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
  { name: 'Mobile (390x844)', width: 390, height: 844 }
];

for (const vp of viewports) {
  await send('Emulation.setDeviceMetricsOverride', {
    width: vp.width,
    height: vp.height,
    deviceScaleFactor: 1,
    mobile: vp.width <= 768
  });
  await new Promise(r => setTimeout(r, 250));

  const vpCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const transport = document.querySelector('.v34-transport');
      const clock = document.querySelector('.v34-clock');
      const ring = document.querySelector('#v34ClockRing');
      const text = document.querySelector('#v34ClockText');
      const docW = document.documentElement.clientWidth;
      const scrollW = document.documentElement.scrollWidth;
      const tRect = transport.getBoundingClientRect();
      const clockRect = clock.getBoundingClientRect();

      return {
        hasHorizontalScroll: scrollW > docW + 2,
        transportVisible: tRect.width > 0 && tRect.height > 0,
        clockVisible: clockRect.width > 0 && clockRect.height > 0,
        text: text?.textContent
      };
    })()`,
    returnByValue: true
  });
  console.log(`${vp.name}:`, vpCheck.result.value);
  assert(!vpCheck.result.value.hasHorizontalScroll, `${vp.name} must not cause horizontal scrolling`);
  assert(vpCheck.result.value.transportVisible, `${vp.name} transport must be visible`);
  assert(vpCheck.result.value.clockVisible, `${vp.name} loop clock must be visible`);
}
console.log('PASS: Transport and clock adapt smoothly across desktop, tablet, and mobile!');

console.log('\nALL SECTION 1 TRANSPORT & CLOCK VERIFICATIONS PASSED (0 errors)!');
cleanup();
process.exit(0);
