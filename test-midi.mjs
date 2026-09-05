import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const ROOT = process.cwd();
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
  const cleanPath = req.url.split('?')[0];
  let filePath = path.join(ROOT, cleanPath === '/' ? 'index.html' : cleanPath.slice(1));
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`MIDI test server listening on http://127.0.0.1:${port}`);

const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-midi-test-'));
const chromePort = 9400 + Math.floor(Math.random() * 500);

const chrome = spawn(chromeBin, [
  '--headless=new',
  '--window-size=1280,800',
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${userDataDir}`,
  '--mute-audio=false',
  '--autoplay-policy=no-user-gesture-required',
  '--no-first-run',
  '--no-default-browser-check',
  `http://127.0.0.1:${port}/`
], { stdio: 'ignore' });

let ws = null;
let currentTestName = 'Initialization';

function cleanup() {
  try { if (ws) ws.close(); } catch {}
  try { chrome.kill('SIGKILL'); } catch {}
  try { server.close(); } catch {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
}

const hardWatchdog = setTimeout(() => {
  console.error(`\n[WATCHDOG TIMEOUT] Test run exceeded 45 seconds! Stuck on: ${currentTestName}`);
  cleanup();
  process.exit(1);
}, 45000);

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('uncaughtException', (err) => {
  console.error(`\n[UNCAUGHT EXCEPTION on ${currentTestName}]:`, err);
  cleanup();
  process.exit(1);
});

// Connect WebSocket CDP
for (let i = 0; i < 40; i++) {
  try {
    const versionRes = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
    const targets = await versionRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
    if (pageTarget?.webSocketDebuggerUrl) {
      ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await new Promise(r => setTimeout(r, 150));
}

if (!ws) {
  cleanup();
  throw new Error('Could not connect to Chrome CDP');
}

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let reqId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || msg.error));
    else resolve(msg.result);
  }
};

function send(method, params = {}, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP ${method} timed out after ${timeoutMs}ms [${currentTestName}]`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');

try {
  console.log('Waiting for Music & Beats workstation to boot with MB_MIDI...');
  let ready = false;
  for (let i = 0; i < 40; i++) {
    const evalRes = await send('Runtime.evaluate', {
      expression: 'Boolean(window.MB_V39 && window.MB_MIDI)'
    });
    if (evalRes.result.value) {
      ready = true;
      break;
    }
    await new Promise(r => setTimeout(r, 150));
  }
  assert(ready, 'Workstation booted with MB_MIDI installed');
  console.log('Workstation and Web MIDI engine ready!');

  // Install Mock MIDI in Browser
  await send('Runtime.evaluate', {
    expression: `
      class MockMIDIInput {
        constructor(id, name) {
          this.id = id;
          this.name = name;
          this.type = 'input';
          this.state = 'connected';
          this.connection = 'open';
          this.onmidimessage = null;
          this.onstatechange = null;
        }
        send(data) {
          if (this.onmidimessage) {
            this.onmidimessage({ data: new Uint8Array(data), target: this });
          }
        }
      }

      class MockMIDIAccess {
        constructor() {
          this.inputs = new Map();
          this.onstatechange = null;
        }
        addInput(id, name) {
          const input = new MockMIDIInput(id, name);
          this.inputs.set(id, input);
          if (this.onstatechange) {
            this.onstatechange({ port: input });
          }
          return input;
        }
        removeInput(id) {
          const input = this.inputs.get(id);
          if (input) {
            input.state = 'disconnected';
            this.inputs.delete(id);
            if (this.onstatechange) {
              this.onstatechange({ port: input });
            }
          }
        }
      }

      window.MockMIDIAccess = MockMIDIAccess;
      window.MockMIDIInput = MockMIDIInput;
      window.__mockAccess = new MockMIDIAccess();
      navigator.requestMIDIAccess = async () => window.__mockAccess;
    `
  });

  // TEST 1: Web MIDI unsupported -> graceful
  currentTestName = 'Test 1: Web MIDI unsupported -> graceful';
  console.log(`\n--- ${currentTestName} ---`);
  const t1 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const orig = window.MB_MIDI.state.supported;
      window.MB_MIDI.state.supported = false;
      await window.MB_MIDI.requestAccess();
      const status = window.MB_MIDI.state.status;
      window.MB_MIDI.state.supported = orig;
      return status;
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t1.result.value, 'unsupported');
  console.log('PASS: Web MIDI unsupported handled gracefully with status "unsupported"');

  // TEST 2: Permission/connect succeeds
  currentTestName = 'Test 2: Permission/connect succeeds';
  console.log(`\n--- ${currentTestName} ---`);
  const t2 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      access.addInput('input-generic', 'Generic USB MIDI');
      await window.MB_MIDI.requestAccess();
      return {
        status: window.MB_MIDI.state.status,
        inputCount: window.MB_MIDI.state.inputs.length,
        selectedId: window.MB_MIDI.state.selectedId
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t2.result.value.status, 'connected');
  assert(t2.result.value.inputCount >= 1);
  assert.strictEqual(t2.result.value.selectedId, 'input-generic');
  console.log('PASS: Permission/connect succeeds and selects connected MIDI device');

  // TEST 3: AKAI/MPK mini device name detected
  currentTestName = 'Test 3: AKAI/MPK mini device name detected';
  console.log(`\n--- ${currentTestName} ---`);
  const t3 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      const akai = access.addInput('input-akai', 'MPK mini 3');
      window.__akaiInput = akai;
      window.MB_MIDI.connectInput(akai);
      return {
        isAkai: window.MB_MIDI.state.isAkai,
        deviceName: window.MB_MIDI.state.deviceName
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t3.result.value.isAkai, true);
  assert.strictEqual(t3.result.value.deviceName, 'MPK mini 3');
  console.log('PASS: AKAI MPK mini auto-detected from device name');

  // TEST 4: Device disconnect handled
  currentTestName = 'Test 4: Device disconnect handled';
  console.log(`\n--- ${currentTestName} ---`);
  const t4 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      access.removeInput('input-akai');
      access.removeInput('input-generic');
      return {
        status: window.MB_MIDI.state.status,
        deviceName: window.MB_MIDI.state.deviceName,
        selectedId: window.MB_MIDI.state.selectedId
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t4.result.value.status, 'disconnected');
  assert.strictEqual(t4.result.value.selectedId, null);
  console.log('PASS: Device disconnect cleans up connection state cleanly');

  // TEST 5: Reconnect handled
  currentTestName = 'Test 5: Reconnect handled';
  console.log(`\n--- ${currentTestName} ---`);
  const t5 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      const akai = access.addInput('input-akai-reconnect', 'Akai MPK Mini MK3');
      window.__akaiInput = akai;
      return {
        status: window.MB_MIDI.state.status,
        selectedId: window.MB_MIDI.state.selectedId,
        isAkai: window.MB_MIDI.state.isAkai
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t5.result.value.status, 'connected');
  assert.strictEqual(t5.result.value.isAkai, true);
  console.log('PASS: Hotplug reconnect handled automatically');

  // Open Lead in workspace
  await send('Runtime.evaluate', {
    expression: `(async () => {
      if (typeof ensureAudio === 'function') await ensureAudio();
      window.MB_V34_LOOPER.open();
      window.MB_V38.renderLead();
      window.MB_V39.decorateLead?.();
    })()`,
    awaitPromise: true
  });

  // TEST 6: Note On starts Lead voice
  currentTestName = 'Test 6: Note On starts Lead voice';
  console.log(`\n--- ${currentTestName} ---`);
  const t6 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x90, 60, 95]); // Note 60 on ch 1, vel 95
      for (let i = 0; i < 50; i++) {
        if (M.state.leadMidiVoices?.has('1:60')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const entry = M.state.leadMidiVoices?.get('1:60');
      const keyEl = document.querySelector('#v38Keyboard .v38-key[data-midi="60"]');
      return {
        hasVoice: !!entry?.voice,
        keyActive: keyEl?.classList.contains('active'),
        midi: entry?.midi,
        ch: entry?.ch
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t6.result.value.hasVoice, true);
  assert.strictEqual(t6.result.value.keyActive, true);
  assert.strictEqual(t6.result.value.midi, 60);
  assert.strictEqual(t6.result.value.ch, 1);
  console.log('PASS: Note On triggers active Lead voice and highlights keyboard key');

  // TEST 7: Note Off stops the correct Lead voice
  currentTestName = 'Test 7: Note Off stops the correct Lead voice';
  console.log(`\n--- ${currentTestName} ---`);
  const t7 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x80, 60, 0]); // Note Off note 60 ch 1
      for (let i = 0; i < 20; i++) {
        if (!M.state.leadMidiVoices?.has('1:60')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const hasVoice = M.state.leadMidiVoices?.has('1:60');
      const keyEl = document.querySelector('#v38Keyboard .v38-key[data-midi="60"]');
      return {
        hasVoice,
        keyActive: keyEl?.classList.contains('active')
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t7.result.value.hasVoice, false);
  assert.strictEqual(t7.result.value.keyActive, false);
  console.log('PASS: Note Off stops the correct Lead voice and deactivates keyboard key');

  // TEST 8: velocity-zero Note On stops voice
  currentTestName = 'Test 8: velocity-zero Note On stops voice';
  console.log(`\n--- ${currentTestName} ---`);
  const t8 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x90, 62, 100]); // Note On
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.has('1:62')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const on = M.state.leadMidiVoices?.has('1:62');
      akai.send([0x90, 62, 0]); // Note On with velocity 0
      for (let i = 0; i < 20; i++) {
        if (!M.state.leadMidiVoices?.has('1:62')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const off = !M.state.leadMidiVoices?.has('1:62');
      return { on, off };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t8.result.value.on, true);
  assert.strictEqual(t8.result.value.off, true);
  console.log('PASS: Note On with velocity 0 correctly acts as Note Off');

  // TEST 9: two simultaneous notes remain independent
  currentTestName = 'Test 9: two simultaneous notes remain independent';
  console.log(`\n--- ${currentTestName} ---`);
  const t9 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x90, 64, 90]);
      akai.send([0x90, 67, 85]);
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.has('1:64') && M.state.leadMidiVoices?.has('1:67')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const countBoth = M.state.leadMidiVoices?.size;
      akai.send([0x80, 64, 0]); // Stop note 64 only
      for (let i = 0; i < 20; i++) {
        if (!M.state.leadMidiVoices?.has('1:64')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const note64Gone = !M.state.leadMidiVoices?.has('1:64');
      const note67StillActive = M.state.leadMidiVoices?.has('1:67');
      akai.send([0x80, 67, 0]); // Stop note 67
      for (let i = 0; i < 20; i++) {
        if (!M.state.leadMidiVoices?.has('1:67')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      return { countBoth, note64Gone, note67StillActive, empty: M.state.leadMidiVoices?.size === 0 };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t9.result.value.countBoth, 2);
  assert.strictEqual(t9.result.value.note64Gone, true);
  assert.strictEqual(t9.result.value.note67StillActive, true);
  assert.strictEqual(t9.result.value.empty, true);
  console.log('PASS: Polyphonic notes sound and release completely independently');

  // TEST 10: velocity reaches Lead voice path
  currentTestName = 'Test 10: velocity reaches Lead voice path';
  console.log(`\n--- ${currentTestName} ---`);
  const t10 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x90, 65, 127]); // Max velocity
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.has('1:65')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const entry = M.state.leadMidiVoices?.get('1:65');
      const vel = entry?.vel;
      const voiceVel = entry?.voice?.velocity;
      akai.send([0x80, 65, 0]);
      return { vel, voiceVel };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert(Math.abs(t10.result.value.vel - 1.0) < 0.01, 'Velocity normalized to 1.0');
  assert(Math.abs(t10.result.value.voiceVel - 1.0) < 0.01, 'Voice velocity captured on voice object');
  console.log('PASS: Velocity propagates through to Lead voice path');

  // TEST 11: pitch bend reaches existing Lead pitch state
  currentTestName = 'Test 11: pitch bend reaches existing Lead pitch state';
  console.log(`\n--- ${currentTestName} ---`);
  const t11 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0xE0, 127, 127]); // Max up bend
      const maxBend = M.state.pitchBend;
      akai.send([0xE0, 0, 64]); // Center
      const centerBend = M.state.pitchBend;
      return { maxBend, centerBend };
    })()`,
    returnByValue: true
  });
  assert(t11.result.value.maxBend > 1.8, 'Pitch bend reached upper range');
  assert(Math.abs(t11.result.value.centerBend) < 0.05, 'Pitch bend centered cleanly');
  console.log('PASS: Pitch bend CC modifies existing Lead pitchBend state');

  // TEST 12: modulation reaches existing Lead modulation state
  currentTestName = 'Test 12: modulation reaches existing Lead modulation state';
  console.log(`\n--- ${currentTestName} ---`);
  const t12 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0xB0, 1, 127]); // Mod wheel 100%
      const maxMod = M.state.mod;
      akai.send([0xB0, 1, 0]); // Mod wheel 0%
      const minMod = M.state.mod;
      return { maxMod, minMod };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t12.result.value.maxMod, 1);
  assert.strictEqual(t12.result.value.minMod, 0);
  console.log('PASS: Modulation CC reaches existing Lead mod state');

  // TEST 13: disconnect while notes are held performs panic
  currentTestName = 'Test 13: disconnect while notes are held performs panic';
  console.log(`\n--- ${currentTestName} ---`);
  const t13 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      const M = window.MB_V39;
      akai.send([0x90, 60, 90]);
      akai.send([0x90, 64, 90]);
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.size === 2) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const beforeDisconnectCount = M.state.leadMidiVoices?.size;
      // Disconnect device
      window.__mockAccess.removeInput('input-akai-reconnect');
      const afterDisconnectCount = M.state.leadMidiVoices?.size;
      const activeDomKeys = document.querySelectorAll('#v38Keyboard .v38-key.active').length;
      return { beforeDisconnectCount, afterDisconnectCount, activeDomKeys };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t13.result.value.beforeDisconnectCount, 2);
  assert.strictEqual(t13.result.value.afterDisconnectCount, 0);
  assert.strictEqual(t13.result.value.activeDomKeys, 0);
  console.log('PASS: Disconnect while notes are sounding triggers panic without stuck voices');

  // TEST 14: switching Lead sound leaves no stuck notes
  currentTestName = 'Test 14: switching Lead sound leaves no stuck notes';
  console.log(`\n--- ${currentTestName} ---`);
  const t14 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      const akai = access.addInput('input-akai-2', 'Akai MPK Mini MK3');
      window.__akaiInput = akai;
      window.MB_MIDI.connectInput(akai);

      const M = window.MB_V39;
      akai.send([0x90, 60, 90]);
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.has('1:60')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const noteOn = M.state.leadMidiVoices?.has('1:60');

      // Change voice to Grand Piano
      const voiceSelect = document.querySelector('#v38Voice');
      if (voiceSelect) {
        voiceSelect.value = 'Grand Piano';
        voiceSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const countAfterSwitch = M.state.leadMidiVoices?.size;
      const activeDomKeys = document.querySelectorAll('#v38Keyboard .v38-key.active').length;
      return { noteOn, countAfterSwitch, activeDomKeys };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t14.result.value.noteOn, true);
  assert.strictEqual(t14.result.value.countAfterSwitch, 0);
  assert.strictEqual(t14.result.value.activeDomKeys, 0);
  console.log('PASS: Switching Lead voice clears active MIDI notes with zero stuck voices');

  // TEST 15: repeatedly connecting/disconnecting does not duplicate handlers
  currentTestName = 'Test 15: repeatedly connecting/disconnecting does not duplicate handlers';
  console.log(`\n--- ${currentTestName} ---`);
  const t15 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const access = window.__mockAccess;
      const akai = window.__akaiInput;
      for (let i = 0; i < 5; i++) {
        window.MB_MIDI.connectInput(akai);
        window.MB_MIDI.disconnectCurrent();
      }
      window.MB_MIDI.connectInput(akai);

      const M = window.MB_V39;
      akai.send([0x90, 72, 80]); // Send 1 Note On
      for (let i = 0; i < 20; i++) {
        if (M.state.leadMidiVoices?.has('1:72')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const voiceCount = M.state.leadMidiVoices?.size;
      akai.send([0x80, 72, 0]);
      return { voiceCount };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t15.result.value.voiceCount, 1);
  console.log('PASS: Repeatedly connecting/disconnecting maintains exactly one handler without duplication');

  // TEST 16: reopening minimal MIDI UI repeatedly does not duplicate handlers
  currentTestName = 'Test 16: reopening minimal MIDI UI repeatedly does not duplicate handlers';
  console.log(`\n--- ${currentTestName} ---`);
  const t16 = await send('Runtime.evaluate', {
    expression: `(() => {
      for (let i = 0; i < 5; i++) {
        window.MB_MIDI.openDialog();
        window.MB_MIDI.closeDialog();
      }
      window.MB_MIDI.openDialog();
      const dialogs = document.querySelectorAll('#v39MidiDialog').length;
      const buttons = document.querySelectorAll('#v39MidiBtn').length;
      const isOpen = window.MB_MIDI.state.dialogOpen;
      window.MB_MIDI.closeDialog();
      return { dialogs, buttons, isOpen };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t16.result.value.dialogs, 1);
  assert.strictEqual(t16.result.value.buttons, 1);
  assert.strictEqual(t16.result.value.isOpen, true);
  console.log('PASS: Reopening minimal MIDI UI does not duplicate dialogs or button elements');

  console.log('\n======================================================');
  console.log('ALL 16 WEB MIDI & LEAD PERFORMANCE TESTS PASSED (0 errors)!');
  console.log('======================================================\n');
} catch (err) {
  console.error(`\n[TEST FAILURE on ${currentTestName}]:`, err);
  cleanup();
  process.exit(1);
} finally {
  clearTimeout(hardWatchdog);
  cleanup();
}
process.exit(0);
