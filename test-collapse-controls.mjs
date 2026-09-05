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
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
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
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
console.log(`Collapse test server listening on http://127.0.0.1:${port}`);

const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = 56895;
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

const hardWatchdog = setTimeout(() => {
  console.error('\n[WATCHDOG TIMEOUT]: test-collapse-controls.mjs exceeded 60s limit.');
  cleanup();
  process.exit(1);
}, 60000);

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
assert(ready, 'Workstation failed to initialize');
console.log('Workstation ready for collapse controls testing!\n');

let currentTestName = '';

try {
  // TEST 1: Keys visible -> click once -> hidden, click once -> visible
  currentTestName = 'Test 1: Smart Keys collapse toggle (visible -> hidden -> visible)';
  console.log(`--- ${currentTestName} ---`);
  
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.MB_V34_LOOPER.open();
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V39.setUICollapse('keysControls', false);
      window.MB_V39.applyCollapse?.('keys');
    })()`
  });

  const t1Init = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const ed = document.querySelector('#v39ChordEditor');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      return {
        btnFound: Boolean(btn),
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('keysControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden'),
        editorHidden: ed?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t1Init.result.value.btnFound, true, 'Keys collapse button exists');
  assert.strictEqual(t1Init.result.value.isCollapsed, false, 'Keys initially uncollapsed');
  assert.strictEqual(t1Init.result.value.ariaExpanded, 'true', 'aria-expanded is true when uncollapsed');
  assert(t1Init.result.value.btnText.includes('Hide controls'), 'Button label is Hide controls');
  assert.strictEqual(t1Init.result.value.voiceHidden, false, 'Voice label is visible');

  // Click once to collapse
  const t1Click1 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      btn.click();
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const ed = document.querySelector('#v39ChordEditor');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      const recBtn = grid?.querySelector('button#v34KeysRecord');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('keysControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden'),
        editorHidden: ed?.classList.contains('v39-hidden'),
        recBtnHidden: recBtn?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t1Click1.result.value.isCollapsed, true, 'One click immediately collapses Keys');
  assert.strictEqual(t1Click1.result.value.ariaExpanded, 'false', 'aria-expanded is false when collapsed');
  assert(t1Click1.result.value.btnText.includes('Show controls'), 'Button label switched to Show controls');
  assert.strictEqual(t1Click1.result.value.voiceHidden, true, 'Voice control hidden');
  assert.strictEqual(t1Click1.result.value.transposeHidden, true, 'Transpose control hidden');
  assert.strictEqual(t1Click1.result.value.editorHidden, true, 'Chord Editor hidden');
  assert.strictEqual(t1Click1.result.value.recBtnHidden, true, 'Record button hidden');

  // Click once to expand back
  const t1Click2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      btn.click();
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const ed = document.querySelector('#v39ChordEditor');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      const recBtn = grid?.querySelector('button#v34KeysRecord');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('keysControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden'),
        editorHidden: ed?.classList.contains('v39-hidden'),
        recBtnHidden: recBtn?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t1Click2.result.value.isCollapsed, false, 'One click immediately expands Keys back');
  assert.strictEqual(t1Click2.result.value.ariaExpanded, 'true', 'aria-expanded is true when expanded');
  assert(t1Click2.result.value.btnText.includes('Hide controls'), 'Button label switched to Hide controls');
  assert.strictEqual(t1Click2.result.value.voiceHidden, false, 'Voice control visible');
  assert.strictEqual(t1Click2.result.value.transposeHidden, false, 'Transpose control visible');
  assert.strictEqual(t1Click2.result.value.editorHidden, false, 'Chord Editor visible');
  assert.strictEqual(t1Click2.result.value.recBtnHidden, false, 'Record button visible');
  console.log('PASS: Smart Keys collapses and expands on single clicks cleanly with accurate labels and aria states');

  // TEST 2: Bass visible -> click once -> hidden, click once -> visible
  currentTestName = 'Test 2: Bass collapse toggle (visible -> hidden -> visible)';
  console.log(`\n--- ${currentTestName} ---`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="bass"]')?.click();
      window.MB_V39.setUICollapse('bassControls', false);
      window.MB_V39.applyCollapse?.('bass');
    })()`
  });

  const t2Init = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39BassCollapseBtn');
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      return {
        btnFound: Boolean(btn),
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('bassControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t2Init.result.value.btnFound, true, 'Bass collapse button exists');
  assert.strictEqual(t2Init.result.value.isCollapsed, false, 'Bass initially uncollapsed');
  assert.strictEqual(t2Init.result.value.ariaExpanded, 'true');
  assert(t2Init.result.value.btnText.includes('Hide controls'));

  // Click once to collapse Bass
  const t2Click1 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39BassCollapseBtn');
      btn.click();
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      const recBtn = grid?.querySelector('button#v34BassRecord');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('bassControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden'),
        recBtnHidden: recBtn?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t2Click1.result.value.isCollapsed, true, 'One click immediately collapses Bass');
  assert.strictEqual(t2Click1.result.value.ariaExpanded, 'false');
  assert(t2Click1.result.value.btnText.includes('Show controls'));
  assert.strictEqual(t2Click1.result.value.voiceHidden, true);
  assert.strictEqual(t2Click1.result.value.transposeHidden, true);
  assert.strictEqual(t2Click1.result.value.recBtnHidden, true);

  // Click once to expand Bass back
  const t2Click2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39BassCollapseBtn');
      btn.click();
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const transpose = grid?.querySelector('.v39-transpose');
      const voiceLabel = grid?.querySelector('label:not(.v36-latch-control)');
      const recBtn = grid?.querySelector('button#v34BassRecord');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('bassControls'),
        voiceHidden: voiceLabel?.classList.contains('v39-hidden'),
        transposeHidden: transpose?.classList.contains('v39-hidden'),
        recBtnHidden: recBtn?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t2Click2.result.value.isCollapsed, false, 'One click immediately expands Bass back');
  assert.strictEqual(t2Click2.result.value.ariaExpanded, 'true');
  assert(t2Click2.result.value.btnText.includes('Hide controls'));
  console.log('PASS: Bass collapses and expands on single clicks cleanly');

  // TEST 3: Lead visible -> click once -> hidden, click once -> visible
  currentTestName = 'Test 3: Lead collapse toggle (visible -> hidden -> visible)';
  console.log(`\n--- ${currentTestName} ---`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('#v37LeadTrack .v37-track-select')?.click();
      window.MB_V39.setUICollapse('leadControls', false);
      window.MB_V39.applyCollapse?.('lead');
    })()`
  });

  const t3Init = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39LeadCollapseBtn');
      const toolbar = document.querySelector('#v34Workspace .v38-toolbar');
      const fx = document.querySelector('#v34Workspace .v38-fx');
      const status = document.querySelector('#v34Workspace #v38SampleStatus');
      return {
        btnFound: Boolean(btn),
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('leadControls'),
        toolbarHidden: toolbar?.classList.contains('v39-hidden'),
        fxHidden: fx?.classList.contains('v39-hidden'),
        statusHidden: status?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t3Init.result.value.btnFound, true, 'Lead collapse button exists');
  assert.strictEqual(t3Init.result.value.isCollapsed, false, 'Lead initially uncollapsed');
  assert.strictEqual(t3Init.result.value.ariaExpanded, 'true');
  assert(t3Init.result.value.btnText.includes('Hide controls'));
  assert.strictEqual(t3Init.result.value.toolbarHidden, false);

  // Click once to collapse Lead
  const t3Click1 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39LeadCollapseBtn');
      btn.click();
      const toolbar = document.querySelector('#v34Workspace .v38-toolbar');
      const fx = document.querySelector('#v34Workspace .v38-fx');
      const status = document.querySelector('#v34Workspace #v38SampleStatus');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('leadControls'),
        toolbarHidden: toolbar?.classList.contains('v39-hidden'),
        fxHidden: fx?.classList.contains('v39-hidden'),
        statusHidden: status?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t3Click1.result.value.isCollapsed, true, 'One click immediately collapses Lead');
  assert.strictEqual(t3Click1.result.value.ariaExpanded, 'false');
  assert(t3Click1.result.value.btnText.includes('Show controls'));
  assert.strictEqual(t3Click1.result.value.toolbarHidden, true);
  assert.strictEqual(t3Click1.result.value.fxHidden, true);
  assert.strictEqual(t3Click1.result.value.statusHidden, true);

  // Click once to expand Lead back
  const t3Click2 = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39LeadCollapseBtn');
      btn.click();
      const toolbar = document.querySelector('#v34Workspace .v38-toolbar');
      const fx = document.querySelector('#v34Workspace .v38-fx');
      const status = document.querySelector('#v34Workspace #v38SampleStatus');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('leadControls'),
        toolbarHidden: toolbar?.classList.contains('v39-hidden'),
        fxHidden: fx?.classList.contains('v39-hidden'),
        statusHidden: status?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t3Click2.result.value.isCollapsed, false, 'One click immediately expands Lead back');
  assert.strictEqual(t3Click2.result.value.ariaExpanded, 'true');
  assert(t3Click2.result.value.btnText.includes('Hide controls'));
  console.log('PASS: Lead collapses and expands on single clicks cleanly');

  // TEST 4: 20 rapid alternating clicks end in deterministic expected state
  currentTestName = 'Test 4: 20 rapid alternating clicks end in deterministic state';
  console.log(`\n--- ${currentTestName} ---`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V39.setUICollapse('keysControls', false);
      window.MB_V39.applyCollapse?.('keys');
    })()`
  });

  const t4Rapid = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      const states = [];
      for (let i = 0; i < 20; i++) {
        btn.click();
        states.push(window.MB_V39.getUICollapse('keysControls'));
      }
      const finalCollapsed = window.MB_V39.getUICollapse('keysControls');
      const finalAria = btn.getAttribute('aria-expanded');
      const finalText = btn.textContent.trim();
      const grid = document.querySelector('#v34Workspace .v34-control-grid');
      const voiceHidden = grid?.querySelector('label:not(.v36-latch-control)')?.classList.contains('v39-hidden');
      return { states, finalCollapsed, finalAria, finalText, voiceHidden };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t4Rapid.result.value.finalCollapsed, false, '20 clicks returned state to uncollapsed');
  assert.strictEqual(t4Rapid.result.value.finalAria, 'true', 'Final aria-expanded matches uncollapsed state');
  assert(t4Rapid.result.value.finalText.includes('Hide controls'), 'Button label is Hide controls');
  assert.strictEqual(t4Rapid.result.value.voiceHidden, false, 'Controls are visible');
  for (let i = 0; i < 20; i++) {
    const expected = (i % 2 === 0);
    assert.strictEqual(t4Rapid.result.value.states[i], expected, `Click ${i+1} yielded expected state`);
  }
  console.log('PASS: 20 rapid alternating clicks yielded strictly deterministic state without inversion');

  // TEST 5: Independent collapse states surviving switching: Keys -> Bass -> Lead -> Keys
  currentTestName = 'Test 5: Independent collapse states across surface switches';
  console.log(`\n--- ${currentTestName} ---`);
  await send('Runtime.evaluate', {
    expression: `(() => {
      window.MB_V39.setUICollapse('keysControls', true);
      window.MB_V39.setUICollapse('bassControls', false);
      window.MB_V39.setUICollapse('leadControls', true);
      document.querySelector('button[data-select="keys"]')?.click();
    })()`
  });

  const t5Keys = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('keysControls'),
        edHidden: document.querySelector('#v39ChordEditor')?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t5Keys.result.value.isCollapsed, true, 'Keys is collapsed');
  assert.strictEqual(t5Keys.result.value.ariaExpanded, 'false');
  assert.strictEqual(t5Keys.result.value.edHidden, true, 'Keys chord editor is hidden');

  // Switch to Bass
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[data-select="bass"]')?.click();`
  });
  const t5Bass = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39BassCollapseBtn');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('bassControls'),
        voiceHidden: document.querySelector('#v34Workspace .v34-control-grid label:not(.v36-latch-control)')?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t5Bass.result.value.isCollapsed, false, 'Bass remains uncollapsed');
  assert.strictEqual(t5Bass.result.value.ariaExpanded, 'true');
  assert.strictEqual(t5Bass.result.value.voiceHidden, false);

  // Switch to Lead
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#v37LeadTrack .v37-track-select')?.click();`
  });
  const t5Lead = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39LeadCollapseBtn');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('leadControls'),
        toolbarHidden: document.querySelector('#v34Workspace .v38-toolbar')?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t5Lead.result.value.isCollapsed, true, 'Lead remains collapsed');
  assert.strictEqual(t5Lead.result.value.ariaExpanded, 'false');
  assert.strictEqual(t5Lead.result.value.toolbarHidden, true);

  // Switch back to Keys
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[data-select="keys"]')?.click();`
  });
  const t5ReturnKeys = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      return {
        btnText: btn?.textContent?.trim(),
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        isCollapsed: window.MB_V39.getUICollapse('keysControls'),
        edHidden: document.querySelector('#v39ChordEditor')?.classList.contains('v39-hidden')
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t5ReturnKeys.result.value.isCollapsed, true, 'Keys preserved collapsed state');
  assert.strictEqual(t5ReturnKeys.result.value.ariaExpanded, 'false');
  assert.strictEqual(t5ReturnKeys.result.value.edHidden, true);
  console.log('PASS: Keys, Bass, and Lead retain independent collapse states across multi-surface switching');

  // TEST 6: State survives normal rerenders (sound change, key change, transpose)
  currentTestName = 'Test 6: State survives normal rerenders and setting updates';
  console.log(`\n--- ${currentTestName} ---`);
  const t6Rerender = await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V39.setUICollapse('keysControls', true);
      window.MB_V39.applyCollapse?.('keys');
      
      const keySel = document.querySelector('#v34KeysKey');
      if (keySel) {
        keySel.value = 'G';
        keySel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      const soundSel = document.querySelector('#v34KeysSound');
      if (soundSel) {
        soundSel.value = 'Velvet EP';
        soundSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      window.MB_V39.setTranspose('keys', 2);
      
      for (let i = 0; i < 10; i++) {
        window.MB_V39.decorateCore?.();
      }
      
      const btn = document.querySelector('#v39KeysCollapseBtn');
      const isCollapsed = window.MB_V39.getUICollapse('keysControls');
      const edHidden = document.querySelector('#v39ChordEditor')?.classList.contains('v39-hidden');
      const transposeHidden = document.querySelector('#v34Workspace .v34-control-grid .v39-transpose')?.classList.contains('v39-hidden');
      return {
        isCollapsed,
        ariaExpanded: btn?.getAttribute('aria-expanded'),
        btnText: btn?.textContent?.trim(),
        edHidden,
        transposeHidden
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t6Rerender.result.value.isCollapsed, true, 'Keys remained collapsed through all rerenders');
  assert.strictEqual(t6Rerender.result.value.ariaExpanded, 'false');
  assert(t6Rerender.result.value.btnText.includes('Show controls'));
  assert.strictEqual(t6Rerender.result.value.edHidden, true, 'Editor remains hidden');
  assert.strictEqual(t6Rerender.result.value.transposeHidden, true, 'Transpose remains hidden');
  console.log('PASS: Collapse state survives key signature change, sound preset change, transpose, and 10x decorateCore');

  // TEST 7: Repeated render/decorate 10x does not add duplicate handlers
  currentTestName = 'Test 7: Zero duplicate handlers after 10x render/decorate';
  console.log(`\n--- ${currentTestName} ---`);
  const t7Listeners = await send('Runtime.evaluate', {
    expression: `(() => {
      for (let i = 0; i < 10; i++) {
        window.MB_V39.decorateCore?.();
      }
      
      const before = window.MB_V39.getUICollapse('keysControls');
      const btn = document.querySelector('#v39KeysCollapseBtn');
      btn.click();
      const after = window.MB_V39.getUICollapse('keysControls');
      
      return { before, after, toggledCleanly: before !== after };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t7Listeners.result.value.toggledCleanly, true, 'Single click cleanly toggled state once (not duplicated)');
  console.log('PASS: Repeated decorate/render cycles do not create duplicate toggle handlers');

  // TEST 8: Mouse and touch/pointer input behave identically
  currentTestName = 'Test 8: Mouse and touch/pointer input behave identically';
  console.log(`\n--- ${currentTestName} ---`);
  const t8Input = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('#v39KeysCollapseBtn');
      const startState = window.MB_V39.getUICollapse('keysControls');
      
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const afterMouse = window.MB_V39.getUICollapse('keysControls');
      
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' }));
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch' }));
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      const afterTouch = window.MB_V39.getUICollapse('keysControls');
      
      return { startState, afterMouse, afterTouch };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t8Input.result.value.afterMouse, !t8Input.result.value.startState, 'Mouse click toggled state');
  assert.strictEqual(t8Input.result.value.afterTouch, t8Input.result.value.startState, 'Touch sequence toggled state back');
  console.log('PASS: Mouse click and touch/pointer input behave identically');

  // TEST 9: Opening/closing MIDI does not affect collapse state
  currentTestName = 'Test 9: Opening/closing MIDI modal does not affect collapse state';
  console.log(`\n--- ${currentTestName} ---`);
  const t9Midi = await send('Runtime.evaluate', {
    expression: `(() => {
      const beforeKeys = window.MB_V39.getUICollapse('keysControls');
      
      window.MB_MIDI?.openDialog?.();
      const midiOpened = Boolean(document.querySelector('#v39MidiDialog'));
      
      window.MB_MIDI?.closeDialog?.();
      
      const afterKeys = window.MB_V39.getUICollapse('keysControls');
      return { beforeKeys, afterKeys, midiOpened };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t9Midi.result.value.beforeKeys, t9Midi.result.value.afterKeys, 'MIDI open/close did not mutate collapse state');
  console.log('PASS: Opening and closing MIDI dialog has zero side effects on collapse state');

  // TEST 10: Zero console errors throughout execution
  currentTestName = 'Test 10: Zero console errors';
  console.log(`\n--- ${currentTestName} ---`);
  assert.strictEqual(consoleErrors.length, 0, `Expected 0 console errors, got: ${JSON.stringify(consoleErrors)}`);
  console.log('PASS: Zero console errors recorded during all collapse interactions');

  console.log('\n=============================================================');
  console.log('ALL 10 PERFORMANCE CONTROLS COLLAPSE TESTS PASSED (0 errors)!');
  console.log('=============================================================\n');

} catch (err) {
  console.error(`\n[TEST FAILURE on ${currentTestName}]:`, err);
  cleanup();
  process.exit(1);
} finally {
  clearTimeout(hardWatchdog);
  cleanup();
}
process.exit(0);
