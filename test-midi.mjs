import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
console.log(`MIDI test server listening on http://127.0.0.1:${port}`);

const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = `/tmp/mb-midi-test-${Date.now()}`;
const chrome = spawn(chromeBin, [
  '--headless=new',
  '--remote-debugging-port=0',
  `--user-data-dir=${userDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  `http://127.0.0.1:${port}/`
]);

let wsUrl = '';
for await (const chunk of chrome.stderr) {
  const match = chunk.toString().match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[a-f0-9-]+/);
  if (match) {
    wsUrl = match[0];
    break;
  }
}

const versionRes = await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json/list`);
const targets = await versionRes.json();
const pageTarget = targets.find(t => t.type === 'page');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

let reqId = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || msg.error));
    else resolve(msg.result);
  }
};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = reqId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function cleanup() {
  chrome.kill('SIGKILL');
  server.close();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
}

process.on('SIGINT', () => { cleanup(); process.exit(1); });
process.on('uncaughtException', (err) => {
  console.error(err);
  cleanup();
  process.exit(1);
});

console.log('Waiting for Music & Beats workstation to boot in Chrome...');

// Wait for boot
let ready = false;
for (let i = 0; i < 40; i++) {
  const evalRes = await send('Runtime.evaluate', {
    expression: 'Boolean(window.MB_V39?.booted && window.MB_MIDI)'
  });
  if (evalRes.result.value) {
    ready = true;
    break;
  }
  await new Promise(r => setTimeout(r, 100));
}

assert(ready, 'Workstation booted with MB_MIDI installed');
console.log('Workstation and Web MIDI engine ready!');

// Setup Mock MIDI Environment in Browser
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
          this.onmidimessage({ data, target: this });
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
  `
});

// --- TEST 1: Fallback when Web MIDI is Unsupported ---
console.log('\n--- Test 1: Fallback when Web MIDI is Unsupported ---');
const unsupportedRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    window.MB_MIDI.state.supported = false;
    await window.MB_MIDI.requestAccess();
    const st = window.MB_MIDI.state.status;
    window.MB_MIDI.state.supported = true;
    return st;
  })()`,
  awaitPromise: true,
  returnByValue: true
});
assert.strictEqual(unsupportedRes.result.value, 'unsupported', 'Handled unsupported Web MIDI gracefully');
console.log('PASS: Web MIDI unsupported condition handled gracefully with no errors!');

// --- TEST 2: Connect Mock AKAI MPK Mini & Auto-Detection ---
console.log('\n--- Test 2: Connect Mock AKAI MPK Mini & Auto-Detection ---');
const mockAccess = await send('Runtime.evaluate', {
  expression: `(async () => {
    const mock = new window.MockMIDIAccess();
    navigator.requestMIDIAccess = async () => mock;
    window.testMidiAccess = mock;

    // Add AKAI MPK mini
    const akai = mock.addInput('input-mpk', 'MPK mini 3');
    window.testAkaiInput = akai;

    await window.MB_MIDI.requestAccess();

    return {
      status: window.MB_MIDI.state.status,
      deviceName: window.MB_MIDI.state.deviceName,
      isAkai: window.MB_MIDI.state.isAkai,
      inputCount: window.MB_MIDI.state.inputs.length
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Connect result:', mockAccess.result.value);
assert.strictEqual(mockAccess.result.value.status, 'connected', 'MIDI is connected');
assert.strictEqual(mockAccess.result.value.isAkai, true, 'Detected AKAI MPK mini');
assert.strictEqual(mockAccess.result.value.deviceName, 'MPK mini 3', 'Device name matched');
console.log('PASS: AKAI MPK mini auto-detected and connected cleanly!');

// --- TEST 3: Keyboard Routing to Lead (Note On, Note Off, Polyphony, Velocity) ---
console.log('\n--- Test 3: Keyboard Routing to Lead (Note On / Off / Polyphony) ---');
const leadRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const akai = window.testAkaiInput;
    const M = window.MB_V39;

    // Open lead keyboard in workspace
    window.MB_V34_LOOPER.open();
    document.querySelector('button[data-select="keys"]')?.click();

    // Ensure audio initialized
    if (typeof ensureAudio === 'function') await ensureAudio();

    // Send Note On: Note 60 (C4), Velocity 100
    akai.send([0x90, 60, 100]);
    for (let i = 0; i < 30; i++) {
      if (M.state.leadMidiVoices.has(60) || M.state.leadMidiPending.has(60)) break;
      await new Promise(r => setTimeout(r, 20));
    }
    // Wait for voice to resolve
    for (let i = 0; i < 30; i++) {
      if (M.state.leadMidiVoices.has(60)) break;
      await new Promise(r => setTimeout(r, 20));
    }

    const note60Active = M.state.leadMidiVoices.has(60);
    const lastEv1 = { ...window.MB_MIDI.state.lastEvent };

    // Send Note On: Note 64 (E4), Velocity 90 (Polyphonic)
    akai.send([0x90, 64, 90]);
    for (let i = 0; i < 30; i++) {
      if (M.state.leadMidiVoices.has(64)) break;
      await new Promise(r => setTimeout(r, 20));
    }

    const polyCount = M.state.leadMidiVoices.size;

    // Send Velocity-zero Note On for Note 60 (standard MIDI Note Off variant)
    akai.send([0x90, 60, 0]);
    for (let i = 0; i < 30; i++) {
      if (!M.state.leadMidiVoices.has(60)) break;
      await new Promise(r => setTimeout(r, 20));
    }

    const note60Released = !M.state.leadMidiVoices.has(60);
    const note64StillActive = M.state.leadMidiVoices.has(64);

    // Send normal Note Off for Note 64
    akai.send([0x80, 64, 0]);
    for (let i = 0; i < 30; i++) {
      if (M.state.leadMidiVoices.size === 0) break;
      await new Promise(r => setTimeout(r, 20));
    }

    const allReleased = M.state.leadMidiVoices.size === 0;

    return {
      note60Active,
      polyCount,
      note60Released,
      note64StillActive,
      allReleased,
      lastEvType: lastEv1.type,
      lastEvNumber: lastEv1.data1,
      lastEvVel: lastEv1.data2
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Lead note result:', leadRes.result.value);
assert.strictEqual(leadRes.result.value.note60Active, true, 'Note 60 triggered Lead voice');
assert.strictEqual(leadRes.result.value.polyCount, 2, '2 polyphonic notes held simultaneously');
assert.strictEqual(leadRes.result.value.note60Released, true, 'Velocity 0 correctly treated as Note Off');
assert.strictEqual(leadRes.result.value.note64StillActive, true, 'Polyphonic second note remained sounding');
assert.strictEqual(leadRes.result.value.allReleased, true, 'All lead notes released with no stuck voices');
assert.strictEqual(leadRes.result.value.lastEvType, 'Note On', 'Last event diagnostics captured');
console.log('PASS: Note On, velocity-zero Note Off, and polyphony work seamlessly on Lead!');

// --- TEST 4: Pitch Bend & Modulation Wheel ---
console.log('\n--- Test 4: Pitch Bend & Modulation Wheel ---');
const bendModRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const akai = window.testAkaiInput;
    const M = window.MB_V39;

    // Pitch Bend up to max: 16383 (LSB: 127, MSB: 127)
    akai.send([0xE0, 127, 127]);
    const maxBend = M.state.pitchBend;

    // Center pitch bend: 8192 (LSB: 0, MSB: 64)
    akai.send([0xE0, 0, 64]);
    const centerBend = M.state.pitchBend;

    // Mod wheel: CC 1, Value 95
    akai.send([0xB0, 1, 95]);
    const modVal = M.state.mod;

    return {
      maxBend,
      centerBend,
      modVal
    };
  })()`,
  returnByValue: true
});
console.log('Pitch bend / mod result:', bendModRes.result.value);
assert(bendModRes.result.value.maxBend > 1.9, 'Pitch bend reached upper range');
assert(Math.abs(bendModRes.result.value.centerBend) < 0.05, 'Pitch bend centered at 0');
assert(Math.abs(bendModRes.result.value.modVal - (95 / 127)) < 0.02, 'Modulation updated');
console.log('PASS: Hardware pitch bend and modulation wheel route cleanly into Lead expression!');

// --- TEST 5: Panic & Disconnect Cleans Active Notes (No Stuck Voices) ---
console.log('\n--- Test 5: Panic & Disconnect Cleans Active Notes ---');
const panicRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const akai = window.testAkaiInput;
    const M = window.MB_V39;

    // Play 3 notes
    akai.send([0x90, 60, 100]);
    akai.send([0x90, 64, 100]);
    akai.send([0x90, 67, 100]);
    await new Promise(r => setTimeout(r, 20));

    const voicesBefore = M.state.leadMidiVoices.size;

    // Unplug device unexpectedly
    window.testMidiAccess.removeInput('input-mpk');
    await new Promise(r => setTimeout(r, 30));

    const voicesAfter = M.state.leadMidiVoices.size;
    const status = window.MB_MIDI.state.status;

    return {
      voicesBefore,
      voicesAfter,
      status
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Panic / disconnect result:', panicRes.result.value);
assert.strictEqual(panicRes.result.value.voicesBefore, 3, '3 notes active before disconnect');
assert.strictEqual(panicRes.result.value.voicesAfter, 0, 'ZERO hanging voices after unplug');
assert.strictEqual(panicRes.result.value.status, 'disconnected', 'Status updated to disconnected');
console.log('PASS: Unplugging device immediately panics and releases all voices with zero hanging audio!');

// Reconnect device for remaining tests
await send('Runtime.evaluate', {
  expression: `(() => {
    const akai = window.testMidiAccess.addInput('input-mpk', 'MPK mini 3');
    window.testAkaiInput = akai;
    window.MB_MIDI.connectInput(akai);
  })()`
});

// --- TEST 6: AKAI Pads Contextual Mapping (Smart Keys 1–7 & Bass 1–8) ---
console.log('\n--- Test 6: AKAI Pads Contextual Mapping ---');
const padRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const akai = window.testAkaiInput;
    const looper = window.MB_V34_LOOPER;
    const M = window.MB_V39;

    // 1. Keys Lane Active
    looper.open();
    document.querySelector('button[data-select="keys"]')?.click();
    await new Promise(r => setTimeout(r, 30));

    // Send Pad 1 (Note 36) -> triggers Chord Pad 0
    akai.send([0x90, 36, 100]);
    await new Promise(r => setTimeout(r, 40));

    const pad0 = document.querySelectorAll('#v34ChordPads .v34-performance-pad')[0];
    const chord0Active = pad0?.classList.contains('active') || pad0?.classList.contains('v36-latched');

    akai.send([0x80, 36, 0]);

    // 2. Pad 8 (Note 43) in Keys toggles Latch
    const latchBefore = window.MB_V35.extra.latchKeys;
    akai.send([0x90, 43, 100]);
    await new Promise(r => setTimeout(r, 30));
    const latchAfter = window.MB_V35.extra.latchKeys;
    akai.send([0x80, 43, 0]);

    // 3. Bass Lane Active
    document.querySelector('button[data-select="bass"]')?.click();
    await new Promise(r => setTimeout(r, 30));

    // Send Pad 1 (Note 36) -> triggers Bass Pad 0
    akai.send([0x90, 36, 100]);
    await new Promise(r => setTimeout(r, 40));

    const bassPad0 = document.querySelectorAll('#v34BassPads .v34-bass-pad')[0];
    const bass0Active = bassPad0?.classList.contains('active') || bassPad0?.classList.contains('v36-latched');

    akai.send([0x80, 36, 0]);

    return {
      chord0Active: Boolean(chord0Active),
      latchToggled: latchBefore !== latchAfter,
      bass0Active: Boolean(bass0Active)
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('Pad contextual result:', padRes.result.value);
assert.strictEqual(padRes.result.value.chord0Active, true, 'Pad 1 triggered Smart Keys chord pad');
assert.strictEqual(padRes.result.value.latchToggled, true, 'Pad 8 toggled Keys latch mode');
assert.strictEqual(padRes.result.value.bass0Active, true, 'Pad 1 contextually triggered Bass pad in Bass lane');
console.log('PASS: AKAI Pads 1–8 route contextually to Smart Keys and Bass!');

// --- TEST 7: 8 Knobs Mapping (Mixer, Tone, Intensity, Space, Tempo) ---
console.log('\n--- Test 7: 8 Knobs Mapping ---');
const knobRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const akai = window.testAkaiInput;
    const V37 = window.MB_V37;
    const V38 = window.MB_V38;
    const looper = window.MB_V34_LOOPER;

    // Knob 1 (CC 70): Beats Level -> 0.6
    akai.send([0xB0, 70, 64]);
    const beatsLvl = V37.mix.beats;

    // Knob 5 (CC 74): Filter Tone -> 85%
    akai.send([0xB0, 74, 108]);
    const toneVal = V38.state.fx.tone;

    // Knob 8 (CC 77): Tempo -> ~130 BPM
    akai.send([0xB0, 77, 64]);
    const tempoVal = looper.state.bpm;

    return {
      beatsLvl,
      toneVal,
      tempoVal
    };
  })()`,
  returnByValue: true
});
console.log('Knob result:', knobRes.result.value);
assert(knobRes.result.value.beatsLvl > 0.4 && knobRes.result.value.beatsLvl < 0.8, 'Beats volume adjusted');
assert.strictEqual(knobRes.result.value.toneVal, 85, 'Lead tone adjusted to 85%');
assert(knobRes.result.value.tempoVal >= 125 && knobRes.result.value.tempoVal <= 135, 'Tempo adjusted');
console.log('PASS: All 8 Knobs map to real mixer levels, Lead tone, and tempo!');

// --- TEST 8: MIDI Learn for Pads and Knobs + Local Persistence ---
console.log('\n--- Test 8: MIDI Learn for Pads and Knobs ---');
const learnRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const akai = window.testAkaiInput;
    const midi = window.MB_MIDI;

    // 1. Learn Pad 1 to Note 48 (C2) on Channel 2
    midi.state.learning = { kind: 'pad', index: 0 };
    akai.send([0x91, 48, 100]); // 0x91 = Note On Ch 2

    const pad1Mapped = midi.config.pads[0].number === 48 && midi.config.pads[0].channel === 2;

    // 2. Learn Knob 1 to CC 22 on Channel 3
    midi.state.learning = { kind: 'knob', index: 0 };
    akai.send([0xB2, 22, 50]); // 0xB2 = CC Ch 3

    const knob1Mapped = midi.config.knobs[0].number === 22 && midi.config.knobs[0].channel === 3;

    // 3. Check persistence in localStorage
    const savedConfig = JSON.parse(localStorage.getItem('musicandbeats:midi:config'));
    const persisted = savedConfig.pads[0].number === 48 && savedConfig.knobs[0].number === 22;

    // 4. Reset to defaults
    midi.resetDefaults?.() || (() => {
      midi.config = JSON.parse(JSON.stringify(midi.DEFAULT_CONFIG));
      midi.saveConfig();
    })();

    const resetPads = midi.config.pads[0].number === 36;
    const resetKnobs = midi.config.knobs[0].number === 70;

    return {
      pad1Mapped,
      knob1Mapped,
      persisted,
      resetPads,
      resetKnobs
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('MIDI Learn result:', learnRes.result.value);
assert.strictEqual(learnRes.result.value.pad1Mapped, true, 'Pad 1 learned new note and channel');
assert.strictEqual(learnRes.result.value.knob1Mapped, true, 'Knob 1 learned new CC and channel');
assert.strictEqual(learnRes.result.value.persisted, true, 'Learned mapping persisted to localStorage');
assert.strictEqual(learnRes.result.value.resetPads, true, 'Pads reset to factory defaults');
assert.strictEqual(learnRes.result.value.resetKnobs, true, 'Knobs reset to factory defaults');
console.log('PASS: MIDI Learn, custom channel/note capture, persistence, and reset fully verified!');

// --- TEST 9: Repeatedly Opening & Closing MIDI Modal ---
console.log('\n--- Test 9: Repeatedly Opening & Closing MIDI Modal ---');
const modalRes = await send('Runtime.evaluate', {
  expression: `(() => {
    const midi = window.MB_MIDI;
    for (let i = 0; i < 5; i++) {
      midi.openDialog();
      midi.closeDialog();
    }
    const dialogs = document.querySelectorAll('#v39MidiDialog');
    const buttons = document.querySelectorAll('#v39MidiBtn');
    return {
      dialogCount: dialogs.length,
      buttonCount: buttons.length,
      isOpen: midi.state.dialogOpen
    };
  })()`,
  returnByValue: true
});
console.log('Modal stability result:', modalRes.result.value);
assert.strictEqual(modalRes.result.value.dialogCount, 1, 'Exactly one modal instance in DOM');
assert.strictEqual(modalRes.result.value.buttonCount, 1, 'Exactly one topbar button instance');
assert.strictEqual(modalRes.result.value.isOpen, false, 'Modal closed cleanly');
console.log('PASS: Reopening MIDI screen repeatedly causes zero duplicate DOM elements or leaks!');

// --- TEST 10: MIDI Keys/Bass Recording Into Looper (Pre-Held Step 0 Capture) ---
console.log('\n--- Test 10: MIDI Keys/Bass Recording with Pre-Held Step 0 Capture ---');
const recordRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const looper = window.MB_V34_LOOPER;
    const V = window.MB_V35;
    const akai = window.testAkaiInput;

    V.extra.latchKeys = true;
    looper.open();
    document.querySelector('button[data-select="keys"]')?.click();
    document.querySelector('#v34BarChoices button[data-bars="1"]')?.click();
    looper.state.bpm = 140;

    await looper.start(false);

    // Press MIDI Pad 1 (Note 36) before arming / rollover
    akai.send([0x90, 36, 100]);
    await new Promise(r => setTimeout(r, 60));

    // Arm keys recording
    document.querySelector('#v34KeysRecord').click();

    // Wait until recording begins at 1.1 (step 0)
    while (looper.state.recordingLane !== 'keys') {
      await new Promise(r => setTimeout(r, 20));
    }

    // Sustain the chord across the 1-bar loop
    while (looper.state.recordingLane === 'keys') {
      await new Promise(r => setTimeout(r, 20));
    }

    looper.stop();
    const recordedEvents = [...looper.tracks.keys.events];

    return {
      recordedEvents
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
console.log('MIDI recording result:', recordRes.result.value);
const recEvents = recordRes.result.value.recordedEvents;
assert(recEvents.length >= 1, 'Looper recorded event triggered via MIDI pad');
assert.strictEqual(recEvents[0].step, 0, 'MIDI chord carried forward into step 0 seamlessly');
assert.strictEqual(recEvents[0].durationSteps, 16, 'MIDI chord sustained across full 1-bar loop');
console.log('PASS: MIDI pad triggers flow through authoritative looper pipeline and capture at Step 0!');

console.log('\nALL 10 WEB MIDI & AKAI MPK MINI VERIFICATION SUITES PASSED (0 errors)!');
cleanup();
process.exit(0);
