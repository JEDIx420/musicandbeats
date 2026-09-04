import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const ROOT = process.cwd();

// 1. Simple static file server
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

// 2. Launch headless Chrome with CDP
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chromePort = 9222 + Math.floor(Math.random() * 500);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-chrome-'));

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
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

// Wait for Chrome CDP to be available
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

// Create a new tab / page
const newPageRes = await fetch(`http://127.0.0.1:${chromePort}/json/new?http://127.0.0.1:${port}/index.html`, { method: 'PUT' });
const pageData = await newPageRes.json();
const wsUrl = pageData.webSocketDebuggerUrl;

// Connect to WebSocket
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

// Enable Page & Runtime
await send('Page.enable');
await send('Runtime.enable');

// Wait for page to finish loading and workstation to boot
console.log('Waiting for Music & Beats workstation to boot in Chrome...');
let ready = false;
for (let i = 0; i < 60; i++) {
  const evalRes = await send('Runtime.evaluate', {
    expression: 'Boolean(window.MB_V39 && window.MB_V39.auditInstrumentPatches && window.auditInstrumentPatches)',
    returnByValue: true
  });
  if (evalRes?.result?.value) {
    ready = true;
    break;
  }
  await new Promise(r => setTimeout(r, 200));
}
assert(ready, 'Workstation did not expose MB_V39 and auditInstrumentPatches within timeout');
console.log('Workstation initialized successfully!');

console.log('\n--- Diagnostic Single Sample Test ---');
const testSampleRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    try {
      if (typeof ensureAudio === 'function') await ensureAudio();
      const sm = window.MB_V39.sampleManager;
      const ok = await sm.preloadVoice('Acoustic Bass', 24, 60);
      const ready = sm.isVoiceReady('Acoustic Bass', 36);
      return { ok, ready, hasSpec: Boolean(window.MB_V38?.SAMPLE_VOICES?.['Acoustic Bass']), hasVar: Boolean(window._tone_0320_GeneralUserGS_sf2_file) };
    } catch(e) {
      return { error: e.message, stack: e.stack };
    }
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Direct test result:', testSampleRes.result.value);

// Test 1: Run window.auditInstrumentPatches()
console.log('\n--- Test 1: Live Instrument Patch Audit ---');
const auditEval = await send('Runtime.evaluate', {
  expression: 'window.auditInstrumentPatches()',
  awaitPromise: true,
  returnByValue: true
});

const audit = auditEval.result.value;
console.log(`Audit Total Patches Checked: ${audit.totalCount}`);
console.log(`Bass Patches: ${audit.bass.passed.length} passed, ${audit.bass.failed.length} failed`);
console.log(`Keys Patches: ${audit.keys.passed.length} passed, ${audit.keys.failed.length} failed`);
console.log(`Lead Patches: ${audit.lead.passed.length} passed, ${audit.lead.failed.length} failed`);

if (audit.failureCount > 0) {
  console.error('Audit failures:', JSON.stringify(audit, null, 2));
}
assert.strictEqual(audit.failureCount, 0, `Expected 0 audit failures, but found ${audit.failureCount}`);
assert.strictEqual(audit.passed, true, 'Audit passed flag must be true');
console.log('PASS: window.auditInstrumentPatches() passed with 0 failures!');

// Test 2: Check Bass Voice selector contents & groups
console.log('\n--- Test 2: Bass Selector Verification ---');
const bassEval = await send('Runtime.evaluate', {
  expression: `(() => {
    window.MB_V34_LOOPER?.open();
    document.querySelector('button[data-select="bass"]')?.click();
    window.MB_V39?.decorateCore?.();
    const sel = document.querySelector('#v34BassSound');
    if (!sel) return { found: false };
    const groups = Array.from(sel.querySelectorAll('optgroup')).map(g => ({
      label: g.label,
      options: Array.from(g.querySelectorAll('option')).map(o => o.value)
    }));
    return {
      found: true,
      groups,
      allOptions: Array.from(sel.querySelectorAll('option')).map(o => o.value)
    };
  })()`,
  returnByValue: true
});

const bassInfo = bassEval.result.value;
assert(bassInfo.found, '#v34BassSound element must be found in workspace');
console.log('Bass Optgroups found:', bassInfo.groups.map(g => `${g.label} (${g.options.length})`).join(', '));

const realBassGroup = bassInfo.groups.find(g => g.label === 'Real Bass (Sampled)');
assert(realBassGroup, 'Real Bass (Sampled) optgroup must exist in bass selector');
assert.strictEqual(realBassGroup.options.length, 8, 'Real Bass must have 8 sampled instruments');

const synthBassGroup = bassInfo.groups.find(g => g.label === 'Synth Bass');
assert(synthBassGroup, 'Synth Bass optgroup must exist in bass selector');
assert.strictEqual(synthBassGroup.options.length, 8, 'Synth Bass must have 8 synth instruments');
console.log('PASS: Bass selector contains exactly 8 Real Bass + 8 Synth Bass!');
// Test 2b: Bass Keyboard Number Mapping & Keycaps
console.log('\n--- Test 2b: Bass Keyboard Number Mapping & Keycaps ---');
const bassKeycapEval = await send('Runtime.evaluate', {
  expression: `(() => {
    document.querySelector('button[data-select="bass"]')?.click();
    window.MB_V39?.decorateCore?.();
    const pads = Array.from(document.querySelectorAll('#v34BassPads .v34-bass-pad'));
    const caps = pads.map(p => p.querySelector('.v39-keycap')?.textContent?.trim());
    
    // Simulate pressing Digit1 on keyboard
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', bubbles: true, cancelable: true }));
    const pad1Active = pads[0]?.classList.contains('active');
    
    // Simulate pressing Digit5 on keyboard
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit5', bubbles: true, cancelable: true }));
    const pad5Active = pads[4]?.classList.contains('active');

    // Simulate releasing Digit1 and Digit5
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1', bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit5', bubbles: true, cancelable: true }));
    const pad1Released = !pads[0]?.classList.contains('active');
    const pad5Released = !pads[4]?.classList.contains('active');

    // Simulate pressing Digit8 on keyboard (8th bass pad)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit8', bubbles: true, cancelable: true }));
    const pad8Active = pads[7]?.classList.contains('active');
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit8', bubbles: true, cancelable: true }));
    const pad8Released = !pads[7]?.classList.contains('active');

    return {
      padCount: pads.length,
      caps,
      pad1Active,
      pad5Active,
      pad1Released,
      pad5Released,
      pad8Active,
      pad8Released
    };
  })()`,
  returnByValue: true
});

const bassKeycapInfo = bassKeycapEval.result.value;
assert.strictEqual(bassKeycapInfo.padCount, 8, 'Must have 8 bass pads');
assert.deepStrictEqual(bassKeycapInfo.caps, ['1', '2', '3', '4', '5', '6', '7', '8'], 'Bass pads must have keycaps 1 through 8');
assert(bassKeycapInfo.pad1Active, 'Digit1 keydown must activate pad 1');
assert(bassKeycapInfo.pad5Active, 'Digit5 keydown must activate pad 5');
assert(bassKeycapInfo.pad1Released, 'Digit1 keyup must release pad 1');
assert(bassKeycapInfo.pad5Released, 'Digit5 keyup must release pad 5');
assert(bassKeycapInfo.pad8Active, 'Digit8 keydown must activate pad 8');
assert(bassKeycapInfo.pad8Released, 'Digit8 keyup must release pad 8');
console.log('PASS: Bass pads have keycaps 1..8 and respond cleanly to keyboard number digits 1..8!');


console.log('\n--- Test 3: Keys Selector & Legacy Synths Demotion ---');
const keysEval = await send('Runtime.evaluate', {
  expression: `(() => {
    document.querySelector('button[data-select="keys"]')?.click();
    window.MB_V39?.decorateCore?.();
    const sel = document.querySelector('#v34KeysSound');
    if (!sel) return { found: false };
    const groups = Array.from(sel.querySelectorAll('optgroup')).map(g => ({
      label: g.label,
      options: Array.from(g.querySelectorAll('option')).map(o => o.value)
    }));
    return {
      found: true,
      groups,
      lastGroup: groups[groups.length - 1]
    };
  })()`,
  returnByValue: true
});

const keysInfo = keysEval.result.value;
assert(keysInfo.found, '#v34KeysSound element must be found in workspace');
assert.strictEqual(keysInfo.lastGroup.label, 'Legacy Synths', 'Last optgroup in Keys selector must be "Legacy Synths"');
const legacyIndian = ['Harmonium', 'Tanpura Drone', 'Bansuri Air', 'Sitar Pluck'];
legacyIndian.forEach(name => {
  assert(keysInfo.lastGroup.options.includes(name), `Legacy Synths must contain ${name}`);
});
console.log('PASS: Legacy Indian synths demoted to bottom "Legacy Synths" optgroup!');

// Test 4: Audio Rendering Verification (Non-zero RMS across presets)
console.log('\n--- Test 4: Audio Rendering Verification (Non-zero RMS) ---');
const audioEval = await send('Runtime.evaluate', {
  expression: `(async () => {
    // Render 0.3s of audio using startVoice and OfflineAudioContext
    const sampleRate = 44100;
    const duration = 0.3;
    const testPresets = [
      'Grand Piano',     // Sampled Keys
      'Acoustic Bass',   // Sampled Real Bass
      'Finger Bass',     // Sampled Real Bass
      'Sub Bass',        // Synth Bass
      'Reese Bass',      // Detuned EDM Synth Bass
      'Acid Bass',       // Dynamic FilterEnv Synth Bass
      'Glass Lead'       // Lead Synth
    ];
    
    const results = [];
    for (const preset of testPresets) {
      const oCtx = new OfflineAudioContext(1, Math.floor(sampleRate * duration), sampleRate);
      const prevCtx = window.ctx;
      window.ctx = oCtx;
      
      try {
        const v = window.startVoice(60, preset, 0.8, oCtx.destination);
        const rendered = await oCtx.startRendering();
        const data = rendered.getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          sum += data[i] * data[i];
        }
        const rms = Math.sqrt(sum / data.length);
        results.push({ preset, rms, nonZero: rms > 0.0001 });
      } catch (err) {
        results.push({ preset, rms: 0, nonZero: false, err: err.message });
      } finally {
        window.ctx = prevCtx;
      }
    }
    return results;
  })()`,
  awaitPromise: true,
  returnByValue: true
});

const audioResults = audioEval.result.value;
for (const res of audioResults) {
  console.log(`Preset: ${res.preset.padEnd(16)} RMS: ${res.rms.toFixed(5)} -> ${res.nonZero ? 'NON-ZERO AUDIO ✓' : 'SILENT ✗'}`);
  assert(res.nonZero, `Preset ${res.preset} produced silence (RMS: ${res.rms})`);
}
console.log('PASS: All tested presets genuinely produce non-zero audible sound waves!');

console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY (0 errors)!');
ws.close();
cleanup();
process.exit(0);
