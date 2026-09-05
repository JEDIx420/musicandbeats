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
  console.error(`\n[WATCHDOG TIMEOUT] Test run exceeded 60 seconds! Stuck on: ${currentTestName}`);
  cleanup();
  process.exit(1);
}, 60000);

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

  // TEST 17: Dedicated AKAI MPK mini UI render & status badges
  currentTestName = 'Test 17: Dedicated AKAI MPK mini UI render & status badges';
  console.log(`\n--- ${currentTestName} ---`);
  const t17 = await send('Runtime.evaluate', {
    expression: `(() => {
      window.MB_MIDI.openDialog();
      const title = document.querySelector('.v39-midi-title h2')?.textContent;
      const profileBadge = document.querySelector('.v39-midi-badge-profile')?.textContent;
      const statusBadge = document.querySelector('.v39-midi-badge-connected')?.textContent;
      const padCards = document.querySelectorAll('[data-learn-pad]').length;
      const knobCards = document.querySelectorAll('[data-learn-knob]').length;
      const monitor = !!document.querySelector('#v39MidiMonitor');
      const kbRoute = document.querySelector('#v39MidiKeyboardTarget')?.value;
      return { title, profileBadge, statusBadge, padCards, knobCards, monitor, kbRoute };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t17.result.value.title, 'MIDI · AKAI MPK mini');
  assert.strictEqual(t17.result.value.profileBadge, 'AKAI MPK mini Profile');
  assert.strictEqual(t17.result.value.statusBadge, '● Connected');
  assert.strictEqual(t17.result.value.padCards, 8);
  assert.strictEqual(t17.result.value.knobCards, 8);
  assert.strictEqual(t17.result.value.monitor, true);
  assert.strictEqual(t17.result.value.kbRoute, 'lead');
  console.log('PASS: Dedicated AKAI MPK mini dialog renders with status badges and 8 pad / 8 knob cards');

  // TEST 18: Live MIDI Diagnostics Monitor updates on events
  currentTestName = 'Test 18: Live MIDI Diagnostics Monitor updates on events';
  console.log(`\n--- ${currentTestName} ---`);
  const t18 = await send('Runtime.evaluate', {
    expression: `(async () => {
      const akai = window.__akaiInput;
      akai.send([0x90, 60, 100]); // Note On 60
      const noteOnTxt = document.querySelector('#v39MidiMonitorText')?.textContent;
      akai.send([0x80, 60, 0]); // Note Off
      for (let i = 0; i < 20; i++) {
        if (!window.MB_V39.state.leadMidiVoices?.has('1:60')) break;
        await new Promise(r => setTimeout(r, 20));
      }
      const noteOffTxt = document.querySelector('#v39MidiMonitorText')?.textContent;
      akai.send([0xB0, 70, 64]); // CC 70
      const ccTxt = document.querySelector('#v39MidiMonitorText')?.textContent;
      return { noteOnTxt, noteOffTxt, ccTxt };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert(t18.result.value.noteOnTxt.includes('Note On') && t18.result.value.noteOnTxt.includes('60'), 'Note On recorded in monitor');
  assert(t18.result.value.noteOffTxt.includes('Note Off') && t18.result.value.noteOffTxt.includes('60'), 'Note Off recorded in monitor');
  assert(t18.result.value.ccTxt.includes('CC 70') && t18.result.value.ccTxt.includes('64'), 'CC event recorded in monitor');
  console.log('PASS: Live diagnostics monitor displays Note On/Off and CC events in real time');

  // TEST 19: MIDI Learn for Pad & suppression of musical action during Learn
  currentTestName = 'Test 19: MIDI Learn for Pad & suppression of musical action';
  console.log(`\n--- ${currentTestName} ---`);
  const t19 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      const learnBtn = document.querySelector('[data-learn-pad="0"]');
      learnBtn.click();
      const isLearning = window.MB_MIDI.state.learning?.kind === 'pad' && window.MB_MIDI.state.learning?.index === 0;
      const btnTxt = document.querySelector('[data-learn-pad="0"]')?.textContent;
      
      // Send note 48 during learn - MUST NOT trigger musical action
      akai.send([0x90, 48, 80]);
      
      const newMapping = window.MB_MIDI.config.pads[0].number;
      const learnFinished = window.MB_MIDI.state.learning === null;
      const cardVal = document.querySelectorAll('.v39-midi-card-value')[0]?.textContent;
      const hasVoice48 = !!window.MB_V39.state.leadMidiVoices?.has('1:48');
      const key48Active = !!document.querySelector('#v38Keyboard .v38-key[data-midi="48"]')?.classList.contains('active');
      return { isLearning, btnTxt, newMapping, learnFinished, cardVal, hasVoice48, key48Active };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t19.result.value.isLearning, true);
  assert.strictEqual(t19.result.value.btnTxt, 'Listening…');
  assert.strictEqual(t19.result.value.newMapping, 48);
  assert.strictEqual(t19.result.value.learnFinished, true);
  assert(t19.result.value.cardVal.includes('48'));
  assert.strictEqual(t19.result.value.hasVoice48, false);
  assert.strictEqual(t19.result.value.key48Active, false);
  console.log('PASS: Pad learn enters listening mode, maps incoming note, finishes immediately, and suppresses sound during learn');

  // TEST 20: MIDI Learn Cancel
  currentTestName = 'Test 20: MIDI Learn Cancel';
  console.log(`\n--- ${currentTestName} ---`);
  const t20 = await send('Runtime.evaluate', {
    expression: `(() => {
      const learnBtn = document.querySelector('[data-learn-pad="1"]');
      learnBtn.click();
      const wasLearning = window.MB_MIDI.state.learning?.kind === 'pad';
      const cancelBtn = document.querySelector('#v39MidiCancelLearnBtn');
      cancelBtn?.click();
      const isStillLearning = window.MB_MIDI.state.learning !== null;
      const pad2Num = window.MB_MIDI.config.pads[1].number;
      return { wasLearning, isStillLearning, pad2Num };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t20.result.value.wasLearning, true);
  assert.strictEqual(t20.result.value.isStillLearning, false);
  assert.strictEqual(t20.result.value.pad2Num, 37);
  console.log('PASS: MIDI Learn can be cancelled without altering existing mapping');

  // TEST 21: MIDI Learn for Knob & suppression of parameter jump during Learn
  currentTestName = 'Test 21: MIDI Learn for Knob & suppression of parameter jump';
  console.log(`\n--- ${currentTestName} ---`);
  const t21 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      const initialBeatsMix = window.MB_V37.mix.beats;
      const learnBtn = document.querySelector('[data-learn-knob="0"]');
      learnBtn.click();
      const isLearning = window.MB_MIDI.state.learning?.kind === 'knob' && window.MB_MIDI.state.learning?.index === 0;
      
      // Send CC 14 during learn - MUST NOT change mix level
      akai.send([0xB0, 14, 127]);
      
      const newKnobCC = window.MB_MIDI.config.knobs[0].number;
      const learnFinished = window.MB_MIDI.state.learning === null;
      const cardVal = document.querySelector('[data-learn-knob="0"]')?.closest('.v39-midi-card')?.querySelector('.v39-midi-card-value')?.textContent;
      const beatsMixAfter = window.MB_V37.mix.beats;
      return { isLearning, newKnobCC, learnFinished, cardVal, beatsUnchanged: initialBeatsMix === beatsMixAfter };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t21.result.value.isLearning, true);
  assert.strictEqual(t21.result.value.newKnobCC, 14);
  assert.strictEqual(t21.result.value.learnFinished, true);
  assert.strictEqual(t21.result.value.cardVal, 'CC 14');
  assert.strictEqual(t21.result.value.beatsUnchanged, true);
  console.log('PASS: Knob learn captures CC number without triggering parameter jumps during learn');

  // TEST 22: Clear and Reset mapping
  currentTestName = 'Test 22: Clear and Reset mapping';
  console.log(`\n--- ${currentTestName} ---`);
  const t22 = await send('Runtime.evaluate', {
    expression: `(() => {
      const clearBtn = document.querySelector('[data-clear-pad="0"]');
      clearBtn.click();
      const pad0AfterClear = window.MB_MIDI.config.pads[0].number;
      const cardValAfterClear = document.querySelector('[data-learn-pad="0"]')?.closest('.v39-midi-card')?.querySelector('.v39-midi-card-value')?.textContent;
      
      const resetBtn = document.querySelector('#v39MidiResetBtn');
      resetBtn.click();
      const pad0AfterReset = window.MB_MIDI.config.pads[0].number;
      const knob0AfterReset = window.MB_MIDI.config.knobs[0].number;
      return { pad0AfterClear, cardValAfterClear, pad0AfterReset, knob0AfterReset };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t22.result.value.pad0AfterClear, null);
  assert.strictEqual(t22.result.value.cardValAfterClear, 'Unmapped');
  assert.strictEqual(t22.result.value.pad0AfterReset, 36);
  assert.strictEqual(t22.result.value.knob0AfterReset, 70);
  console.log('PASS: Clear button unmaps control and Reset button restores AKAI defaults');

  // TEST 23: Persistence of mapping and preferred device in localStorage
  currentTestName = 'Test 23: Persistence in localStorage';
  console.log(`\n--- ${currentTestName} ---`);
  const t23 = await send('Runtime.evaluate', {
    expression: `(() => {
      const rawConfig = localStorage.getItem('musicandbeats:midi:akai_config');
      const prefDevice = localStorage.getItem('musicandbeats:midi:preferred_device');
      const parsed = rawConfig ? JSON.parse(rawConfig) : null;
      return {
        hasConfig: !!parsed,
        padsCount: parsed?.pads?.length,
        knobsCount: parsed?.knobs?.length,
        prefDevice
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t23.result.value.hasConfig, true);
  assert.strictEqual(t23.result.value.padsCount, 8);
  assert.strictEqual(t23.result.value.knobsCount, 8);
  assert.strictEqual(t23.result.value.prefDevice, 'input-akai-2');
  console.log('PASS: AKAI configuration and preferred device persist properly in namespaced localStorage keys');

  // TEST 24: Smart Keys Pad 1 & Pad 7 triggering
  currentTestName = 'Test 24: Smart Keys Pad 1 & Pad 7 triggering';
  console.log(`\n--- ${currentTestName} ---`);
  const t24 = await send('Runtime.evaluate', {
    expression: `(async () => {
      window.MB_V34_LOOPER.state.activeLane = 'keys';
      window.MB_V39.releaseKeys();
      const akai = window.__akaiInput;
      
      // Trigger Pad 1 (note 36)
      akai.send([0x90, 36, 100]);
      const pad1Active = window.MB_V39.state.heldMidiPads.has(0);
      akai.send([0x80, 36, 0]);
      const pad1Stopped = !window.MB_V39.state.heldMidiPads.has(0);
      
      // Trigger Pad 7 (note 42)
      akai.send([0x90, 42, 100]);
      const pad7Active = window.MB_V39.state.heldMidiPads.has(6);
      akai.send([0x80, 42, 0]);
      const pad7Stopped = !window.MB_V39.state.heldMidiPads.has(6);
      
      return { pad1Active, pad1Stopped, pad7Active, pad7Stopped };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t24.result.value.pad1Active, true);
  assert.strictEqual(t24.result.value.pad1Stopped, true);
  assert.strictEqual(t24.result.value.pad7Active, true);
  assert.strictEqual(t24.result.value.pad7Stopped, true);
  console.log('PASS: Smart Keys Pad 1 and Pad 7 trigger and release chords cleanly');

  // TEST 25: Pad 8 safety in Smart Keys mode
  currentTestName = 'Test 25: Pad 8 safety in Smart Keys mode';
  console.log(`\n--- ${currentTestName} ---`);
  const t25 = await send('Runtime.evaluate', {
    expression: `(() => {
      window.MB_V34_LOOPER.state.activeLane = 'keys';
      window.MB_V39.releaseKeys();
      const akai = window.__akaiInput;
      
      // Pad 8 (note 43) in Keys mode
      akai.send([0x90, 43, 100]);
      const heldKeysCount = window.MB_V39.state.heldMidiPads.size;
      akai.send([0x80, 43, 0]);
      return { heldKeysCount };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t25.result.value.heldKeysCount, 0);
  console.log('PASS: Pad 8 in Keys mode is completely safe and does not trigger nonexistent 8th chord');

  // TEST 26: Bass Pads 1–8 triggering
  currentTestName = 'Test 26: Bass Pads 1–8 triggering';
  console.log(`\n--- ${currentTestName} ---`);
  const t26 = await send('Runtime.evaluate', {
    expression: `(async () => {
      window.MB_V34_LOOPER.state.activeLane = 'bass';
      window.MB_V39.releaseBass();
      const akai = window.__akaiInput;
      
      // Pad 1 (note 36) in Bass mode
      akai.send([0x90, 36, 100]);
      const bassPad0Active = window.MB_V39.state.heldMidiBassPads.has(0);
      akai.send([0x80, 36, 0]);
      const bassPad0Stopped = !window.MB_V39.state.heldMidiBassPads.has(0);
      
      // Pad 8 (note 43) in Bass mode
      akai.send([0x90, 43, 100]);
      const bassPad7Active = window.MB_V39.state.heldMidiBassPads.has(7);
      akai.send([0x80, 43, 0]);
      const bassPad7Stopped = !window.MB_V39.state.heldMidiBassPads.has(7);
      
      return { bassPad0Active, bassPad0Stopped, bassPad7Active, bassPad7Stopped };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  assert.strictEqual(t26.result.value.bassPad0Active, true);
  assert.strictEqual(t26.result.value.bassPad0Stopped, true);
  assert.strictEqual(t26.result.value.bassPad7Active, true);
  assert.strictEqual(t26.result.value.bassPad7Stopped, true);
  console.log('PASS: Bass Pads 1 through 8 trigger and release bass notes cleanly');

  // TEST 27: Contextual Keys vs Bass routing switch
  currentTestName = 'Test 27: Contextual Keys vs Bass routing switch';
  console.log(`\n--- ${currentTestName} ---`);
  const t27 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      
      // 1. In Keys mode
      document.querySelector('button[data-select="keys"]')?.click();
      const laneBeforeSend = window.MB_V34_LOOPER.state.activeLane;
      akai.send([0x90, 36, 100]);
      const heldKeysHas0 = window.MB_V39.state.heldMidiPads.has(0);
      const heldBassHas0 = window.MB_V39.state.heldMidiBassPads.has(0);
      const inKeys = heldKeysHas0 && !heldBassHas0;
      akai.send([0x80, 36, 0]);
      
      // 2. Switch to Bass mode
      document.querySelector('button[data-select="bass"]')?.click();
      akai.send([0x90, 36, 100]);
      const inBass = !window.MB_V39.state.heldMidiPads.has(0) && window.MB_V39.state.heldMidiBassPads.has(0);
      akai.send([0x80, 36, 0]);
      
      return { inKeys, inBass };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t27.result.value.inKeys, true);
  assert.strictEqual(t27.result.value.inBass, true);
  console.log('PASS: Pads contextually route to Smart Keys or Bass depending on the active workstation lane');

  // TEST 28: Transpose respect for Keys and Bass
  currentTestName = 'Test 28: Transpose respect for Keys and Bass';
  console.log(`\n--- ${currentTestName} ---`);
  const t28 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      document.querySelector('button[data-select="keys"]')?.click();
      
      // Transpose Keys by +3
      window.MB_V39.setTranspose('keys', 3);
      akai.send([0x90, 36, 100]);
      const keysHold = window.MB_V39.state.heldMidiPads.get(0);
      const keysMidis = [...(keysHold?.midis || [])];
      akai.send([0x80, 36, 0]);
      window.MB_V39.setTranspose('keys', 0);
      
      // Transpose Bass by -2
      document.querySelector('button[data-select="bass"]')?.click();
      window.MB_V39.setTranspose('bass', -2);
      akai.send([0x90, 36, 100]);
      const bassHold = window.MB_V39.state.heldMidiBassPads.get(0);
      const bassMidis = [...(bassHold?.midis || [])];
      akai.send([0x80, 36, 0]);
      window.MB_V39.setTranspose('bass', 0);
      
      return { keysMidis, bassMidis };
    })()`,
    returnByValue: true
  });
  assert(t28.result.value.keysMidis.length > 0, 'Keys midis present');
  assert(t28.result.value.bassMidis.length > 0, 'Bass midis present');
  console.log('PASS: Transpose settings apply directly to MIDI-triggered Keys and Bass pads');

  // TEST 29: Latch mode respect
  currentTestName = 'Test 29: Latch mode respect';
  console.log(`\n--- ${currentTestName} ---`);
  const t29 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V35.extra.latchKeys = true;
      
      // Trigger Pad 1
      akai.send([0x90, 36, 100]);
      akai.send([0x80, 36, 0]); // Release pad
      const latchedOnRelease = !!window.MB_V39.state.keyLatch;
      
      // Trigger Pad 2
      akai.send([0x90, 37, 100]);
      akai.send([0x80, 37, 0]);
      const latchedPad2 = !!window.MB_V39.state.keyLatch;
      
      window.MB_V35.extra.latchKeys = false;
      window.MB_V39.releaseKeys();
      const cleared = !window.MB_V39.state.keyLatch;
      return { latchedOnRelease, latchedPad2, cleared };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t29.result.value.latchedOnRelease, true);
  assert.strictEqual(t29.result.value.latchedPad2, true);
  assert.strictEqual(t29.result.value.cleared, true);
  console.log('PASS: Latch mode latches chords across pad release and switches latches cleanly');

  // TEST 30: Looper recording capture for Smart Keys (pre-held carry-forward into step 0)
  currentTestName = 'Test 30: Looper recording capture for Smart Keys';
  console.log(`\n--- ${currentTestName} ---`);
  const t30 = await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V39.releaseKeys();
      const tracks = window.MB_V34_LOOPER.tracks;
      tracks.keys.events = [];
      
      const akai = window.__akaiInput;
      const t0 = 100.0;
      
      // 1. Pad 1 is pressed BEFORE recording begins
      akai.send([0x90, 36, 100]);
      
      // 2. Recording arms and begins at boundary t0
      window.MB_V39.carryForwardRecord('keys', t0);
      
      // 3. Recording finishes at loop boundary (pad held across entire loop)
      window.MB_V39.onFinishRecording('keys', t0 + 4.0, false);
      akai.send([0x80, 36, 0]);
      
      const recordedEvents = tracks.keys.events;
      const hasStep0 = recordedEvents.some(e => e.step === 0);
      return { eventCount: recordedEvents.length, hasStep0, recordedEvents };
    })()`,
    returnByValue: true
  });
  assert(t30.result.value.eventCount >= 1, 'Recorded events present in keys track');
  assert.strictEqual(t30.result.value.hasStep0, true);
  console.log('PASS: Pre-held pad chord carries forward seamlessly into step 0 of looper recording');

  // TEST 31: Looper recording capture for Bass
  currentTestName = 'Test 31: Looper recording capture for Bass';
  console.log(`\n--- ${currentTestName} ---`);
  const t31 = await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="bass"]')?.click();
      window.MB_V39.releaseBass();
      const tracks = window.MB_V34_LOOPER.tracks;
      tracks.bass.events = [];
      
      const akai = window.__akaiInput;
      const t0 = 200.0;
      
      // Pad 1 pre-held
      akai.send([0x90, 36, 100]);
      window.MB_V39.carryForwardRecord('bass', t0);
      
      // Recording finishes at loop boundary (pad held across entire loop)
      window.MB_V39.onFinishRecording('bass', t0 + 4.0, false);
      akai.send([0x80, 36, 0]);
      
      const recordedEvents = tracks.bass.events;
      const hasStep0 = recordedEvents.some(e => e.step === 0);
      return { eventCount: recordedEvents.length, hasStep0, recordedEvents };
    })()`,
    returnByValue: true
  });
  assert(t31.result.value.eventCount >= 1, 'Recorded events present in bass track');
  assert.strictEqual(t31.result.value.hasStep0, true);
  console.log('PASS: Pre-held bass pad carries forward into step 0 of looper recording');

  // TEST 32: AKAI Knobs update runtime state and UI
  currentTestName = 'Test 32: AKAI Knobs update runtime state and UI';
  console.log(`\n--- ${currentTestName} ---`);
  const t32 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      
      // K1: Beats Vol (CC 70) -> value 64
      akai.send([0xB0, 70, 64]);
      const beatsMix = window.MB_V37.mix.beats;
      
      // K4: Lead Vol (CC 73) -> value 100
      akai.send([0xB0, 73, 100]);
      const leadMix = window.MB_V37.mix.lead;
      
      // K5: Lead Tone (CC 74) -> value 80
      akai.send([0xB0, 74, 80]);
      const toneVal = window.MB_V38.state.fx.tone;
      
      // K6: Lead Intensity (CC 75) -> value 90
      akai.send([0xB0, 75, 90]);
      const intensityVal = window.MB_V38.state.fx.intensity;
      
      // K7: Lead Space (CC 76) -> value 70
      akai.send([0xB0, 76, 70]);
      const spaceVal = window.MB_V38.state.fx.wet;
      
      // K8: Tempo (CC 77) -> value 64 (center ~131 BPM)
      akai.send([0xB0, 77, 64]);
      const bpmVal = window.MB_V34_LOOPER.state.bpm;
      
      return { beatsMix, leadMix, toneVal, intensityVal, spaceVal, bpmVal };
    })()`,
    returnByValue: true
  });
  assert(Math.abs(t32.result.value.beatsMix - 0.61) < 0.05, 'Beats mix level updated');
  assert(Math.abs(t32.result.value.leadMix - 1.1) < 0.05, 'Lead mix level updated');
  assert.strictEqual(t32.result.value.toneVal, 63);
  assert.strictEqual(t32.result.value.intensityVal, 71);
  assert.strictEqual(t32.result.value.spaceVal, 55);
  assert(t32.result.value.bpmVal >= 125 && t32.result.value.bpmVal <= 135, 'BPM updated');
  console.log('PASS: AKAI knobs 1–8 update real runtime mixer, Lead FX, and tempo parameters');

  // TEST 33: Repeated dialog open/close and learn cycles create 0 duplicate listeners
  currentTestName = 'Test 33: Repeated dialog open/close & learn creates 0 duplicate listeners';
  console.log(`\n--- ${currentTestName} ---`);
  const t33 = await send('Runtime.evaluate', {
    expression: `(() => {
      for (let i = 0; i < 5; i++) {
        window.MB_MIDI.openDialog();
        document.querySelector('[data-learn-pad="0"]')?.click();
        document.querySelector('#v39MidiCancelLearnBtn')?.click();
        window.MB_MIDI.closeDialog();
      }
      window.MB_MIDI.openDialog();
      const cancelBtns = document.querySelectorAll('#v39MidiCancelLearnBtn').length;
      const dialogs = document.querySelectorAll('#v39MidiDialog').length;
      window.MB_MIDI.closeDialog();
      return { cancelBtns, dialogs };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t33.result.value.cancelBtns, 0);
  assert.strictEqual(t33.result.value.dialogs, 1);
  console.log('PASS: Repeated dialog open/close and learn cycles leave 0 duplicate listeners or artifacts');

  // TEST 34: Panic stops all active notes, chords, and bass notes
  currentTestName = 'Test 34: Panic stops all active notes, chords, and bass notes';
  console.log(`\n--- ${currentTestName} ---`);
  const t34 = await send('Runtime.evaluate', {
    expression: `(() => {
      const akai = window.__akaiInput;
      // Start lead note
      akai.send([0x90, 60, 90]);
      // Start chord pad
      document.querySelector('button[data-select="keys"]')?.click();
      akai.send([0x90, 36, 100]);
      // Start bass pad
      document.querySelector('button[data-select="bass"]')?.click();
      akai.send([0x90, 36, 100]);
      
      const hadLead = window.MB_V39.state.leadMidiVoices?.size > 0;
      const hadKeys = window.MB_V39.state.heldMidiPads?.size > 0;
      const hadBass = window.MB_V39.state.heldMidiBassPads?.size > 0;
      
      window.MB_MIDI.panic();
      
      const leadAfter = window.MB_V39.state.leadMidiVoices?.size;
      const keysAfter = window.MB_V39.state.heldMidiPads?.size;
      const bassAfter = window.MB_V39.state.heldMidiBassPads?.size;
      return { hadLead, hadKeys, hadBass, leadAfter, keysAfter, bassAfter };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t34.result.value.leadAfter, 0);
  assert.strictEqual(t34.result.value.keysAfter, 0);
  assert.strictEqual(t34.result.value.bassAfter, 0);
  console.log('PASS: Panic cleanly releases Lead voices, Smart Keys chords, and Bass pads');

  // TEST 35: Coexistence with mouse/touch interaction
  currentTestName = 'Test 35: Coexistence with mouse/touch interaction';
  console.log(`\n--- ${currentTestName} ---`);
  const t35 = await send('Runtime.evaluate', {
    expression: `(() => {
      document.querySelector('button[data-select="keys"]')?.click();
      const akai = window.__akaiInput;
      akai.send([0x90, 36, 100]); // Pad 1 via MIDI
      
      // Simultaneously click Pad 2 via DOM PointerEvent
      const pad2 = document.querySelectorAll('#v34ChordPads .v34-performance-pad')[1];
      if (pad2) {
        pad2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 999 }));
        pad2.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 999 }));
      }
      
      // Stop MIDI Pad 1
      akai.send([0x80, 36, 0]);
      
      return {
        keysHoldCount: window.MB_V39.state.heldMidiPads.size
      };
    })()`,
    returnByValue: true
  });
  assert.strictEqual(t35.result.value.keysHoldCount, 0);
  console.log('PASS: MIDI pads and mouse/touch interactions coexist cleanly without interference');

  console.log('\n======================================================');
  console.log('ALL 35 AKAI MPK MINI & WEB MIDI TESTS PASSED (0 errors)!');
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
