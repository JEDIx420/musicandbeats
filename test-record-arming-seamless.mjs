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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-chrome-arm-'));

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
assert(ready, 'Workstation did not initialize');

// Open looper screen
await send('Runtime.evaluate', {
  expression: 'window.MB_V34_LOOPER.open();',
  returnByValue: true
});
await new Promise(r => setTimeout(r, 150));
console.log('Looper ready for arming tests!');

// --- TEST 1: Record Arming Waits for Next ENTIRE Loop (Not Next Bar) ---
console.log('\n--- Test 1: Record Arming Waits for Next ENTIRE Loop (Not Bar) ---');
const armTimingRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    try {
      const looper = window.MB_V34_LOOPER;
      looper.open();
      document.querySelector('button[data-select="keys"]')?.click();
      document.querySelector('#v34BarChoices button[data-bars="4"]')?.click();
      looper.state.bpm = 140;

      await looper.start(false);

      // Wait until bar 2 (e.g. step ~20)
      while (looper.state.absoluteStep < 18) {
        await new Promise(r => setTimeout(r, 20));
      }
      const stepAtArm = looper.state.absoluteStep % 64;
      const barAtArm = Math.floor(stepAtArm / 16) + 1;

      // Press record button on keys workspace
      document.querySelector('#v34KeysRecord').click();

      const armedBtnText = document.querySelector('#v34KeysRecord')?.textContent;
      const armedBtnClass = document.querySelector('#v34KeysRecord')?.className;
      const clockStatus = document.querySelector('#v34ClockStatus')?.textContent;
      const clockHint = document.querySelector('#v34ClockHint')?.textContent;
      const pendingLane = looper.state.pendingLane;
      const pendingStartAbs = looper.state.pendingStartAbs;

      // Advance to bar 3 (step ~36) - must NOT be recording yet!
      while (looper.state.absoluteStep < 34) {
        await new Promise(r => setTimeout(r, 20));
      }
      const isRecordingAtBar3 = looper.state.recordingLane === 'keys';

      // Advance to bar 4 (step ~50) - must NOT be recording yet!
      while (looper.state.absoluteStep < 50) {
        await new Promise(r => setTimeout(r, 20));
      }
      const isRecordingAtBar4 = looper.state.recordingLane === 'keys';

      // Advance until loop wraps to bar 1 (step 64)
      while (looper.state.absoluteStep < 65) {
        await new Promise(r => setTimeout(r, 20));
      }
      const isRecordingAtLoopStart = looper.state.recordingLane === 'keys';
      const recBtnText = document.querySelector('#v34KeysRecord')?.textContent;
      const recBtnClass = document.querySelector('#v34KeysRecord')?.className;

      looper.stop();

      return {
        barAtArm,
        stepAtArm,
        pendingLane,
        pendingStartAbs,
        armedBtnText,
        armedBtnClass,
        clockStatus,
        clockHint,
        isRecordingAtBar3,
        isRecordingAtBar4,
        isRecordingAtLoopStart,
        recBtnText,
        recBtnClass
      };
    } catch (e) {
      return { err: e.message, stack: e.stack };
    }
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('Arm timing test result:', armTimingRes.result.value);
assert(armTimingRes.result.value.barAtArm >= 2, 'Arm occurred during bar 2 or later');
assert.strictEqual(armTimingRes.result.value.pendingLane, 'keys', 'Keys lane is armed');
assert.strictEqual(armTimingRes.result.value.pendingStartAbs, 64, 'Armed start step targets loop boundary (64), NOT next bar (32)');
assert(armTimingRes.result.value.armedBtnText.includes('Armed · starts at 1.1'), 'Button text shows Armed · starts at 1.1');
assert(armTimingRes.result.value.armedBtnClass.includes('v34-rec-armed'), 'Button has v34-rec-armed class');
assert.strictEqual(armTimingRes.result.value.clockStatus, 'Armed', 'Clock status shows Armed');
assert(armTimingRes.result.value.clockHint.includes('1.1'), 'Clock hint points to 1.1');
assert.strictEqual(armTimingRes.result.value.isRecordingAtBar3, false, 'Must NOT start recording at Bar 3');
assert.strictEqual(armTimingRes.result.value.isRecordingAtBar4, false, 'Must NOT start recording at Bar 4');
assert.strictEqual(armTimingRes.result.value.isRecordingAtLoopStart, true, 'MUST start recording at Bar 1 Beat 1 of next loop');
assert(armTimingRes.result.value.recBtnText.includes('Recording chord loop'), 'Button transitions to Recording chord loop');
assert(armTimingRes.result.value.recBtnClass.includes('v34-rec-recording'), 'Button has v34-rec-recording class');
console.log('PASS: Record arming waits for next entire loop boundary (1.1) and updates UI cleanly!');

// --- TEST 2: Arm Cancellation on Re-press ---
console.log('\n--- Test 2: Arm Cancellation on Re-press ---');
const cancelRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    try {
      const looper = window.MB_V34_LOOPER;
      looper.open();
      document.querySelector('button[data-select="bass"]')?.click();
      await looper.start(false);

      // Arm bass
      document.querySelector('#v34BassRecord').click();
      const armedState = looper.state.pendingLane;
      const armedText = document.querySelector('#v34BassRecord')?.textContent;

      // Press again while armed to cancel
      document.querySelector('#v34BassRecord').click();
      const cancelledPending = looper.state.pendingLane;
      const cancelledText = document.querySelector('#v34BassRecord')?.textContent;
      const stillRunning = looper.state.running;

      looper.stop();

      return {
        armedState,
        armedText,
        cancelledPending,
        cancelledText,
        stillRunning
      };
    } catch (e) {
      return { err: e.message, stack: e.stack };
    }
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('Arm cancellation result:', cancelRes.result.value);
assert.strictEqual(cancelRes.result.value.armedState, 'bass', 'Bass was initially armed');
assert(cancelRes.result.value.armedText.includes('Armed · starts at 1.1'), 'Bass button was in armed state');
assert.strictEqual(cancelRes.result.value.cancelledPending, null, 'Pending lane cleared on re-press');
assert(cancelRes.result.value.cancelledText.includes('● Record bass loop'), 'Bass button reset to idle state');
assert.strictEqual(cancelRes.result.value.stillRunning, true, 'Playback continued without interruption');
console.log('PASS: Re-pressing armed button cleanly cancels arming without stopping playback!');

// --- TEST 3: Latched Chord Carry-Forward Into Step 0 (Seamless Transition) ---
console.log('\n--- Test 3: Latched Chord Carry-Forward Into Step 0 ---');
const latchKeysCarryRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    try {
      const looper = window.MB_V34_LOOPER;
      const V = window.MB_V35;
      const M = window.MB_V39;

      V.extra.latchKeys = true;
      looper.open();
      document.querySelector('button[data-select="keys"]')?.click();
      document.querySelector('#v34BarChoices button[data-bars="2"]')?.click();
      looper.state.bpm = 140;

      await looper.start(false);

      // Play Chord Pad 0 in Bar 1 (before 1.1 of next loop)
      const pad0 = document.querySelector('#v34ChordPads .v34-performance-pad[data-index="0"]');
      pad0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
      await new Promise(r => setTimeout(r, 80));

      // Verify Chord 0 is latched and sounding
      const chord0Latched = pad0.classList.contains('v36-latched');
      const keyLatchActive = Boolean(M.state.keyLatch);

      // Arm Keys recording while chord 0 is sounding
      document.querySelector('#v34KeysRecord').click();

      // Wait until recording starts at step 0 (boundary rollover)
      while (looper.state.recordingLane !== 'keys') {
        await new Promise(r => setTimeout(r, 20));
      }
      const startedAtStep = looper.state.recordStartStep;

      // Check that Chord 0 is STILL sounding and latched at step 0 (not cut off!)
      const stillLatchedAtStep0 = pad0.classList.contains('v36-latched') && Boolean(M.state.keyLatch);

      // Advance to Bar 2 (step 16)
      while ((looper.state.absoluteStep % 32) < 16) {
        await new Promise(r => setTimeout(r, 20));
      }

      // Switch to Chord Pad 3 (bar 2 downbeat)
      const pad3 = document.querySelector('#v34ChordPads .v34-performance-pad[data-index="3"]');
      pad3.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 2 }));
      await new Promise(r => setTimeout(r, 80));

      // Wait for the recording to finish (2-bar loop completed, finishes at step 32)
      while (looper.state.recordingLane === 'keys') {
        await new Promise(r => setTimeout(r, 25));
      }

      looper.stop();

      const recordedEvents = [...looper.tracks.keys.events];

      return {
        chord0Latched,
        keyLatchActive,
        startedAtStep,
        stillLatchedAtStep0,
        recordedEvents
      };
    } catch (e) {
      return { err: e.message, stack: e.stack };
    }
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('Latch Keys carry-forward result:', latchKeysCarryRes.result.value);
assert.strictEqual(latchKeysCarryRes.result.value.chord0Latched, true, 'Pad 0 was latched before recording');
assert.strictEqual(latchKeysCarryRes.result.value.keyLatchActive, true, 'Key latch was active');
assert.strictEqual(latchKeysCarryRes.result.value.stillLatchedAtStep0, true, 'Chord 0 remained latched and sounding at step 0');

const events = latchKeysCarryRes.result.value.recordedEvents;
console.log('Recorded events in keys track:', events);
assert(events.length >= 2, 'Recorded at least 2 chord events');
assert.strictEqual(events[0].step, 0, 'Event 0 MUST start at step 0 (carried forward from pre-held chord)');
assert(events[0].durationSteps >= 14 && events[0].durationSteps <= 16, 'Event 0 duration spans bar 1');
assert.strictEqual(events[1].step, events[0].step + events[0].durationSteps, 'ZERO GAP: event[0].end === event[1].start');
assert.strictEqual(events[1].step + events[1].durationSteps, 32, 'Event 1 extends exactly to loop boundary (step 32)');
console.log('PASS: Pre-held latched chord carried forward into step 0 with ZERO gaps between chords!');

// --- TEST 4: Latched Bass Sustained Across Entire Loop ---
console.log('\n--- Test 4: Latched Bass Sustained Across Entire Loop ---');
const bassSustainRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    try {
      const looper = window.MB_V34_LOOPER;
      const V = window.MB_V35;
      const M = window.MB_V39;

      V.extra.latchBass = true;
      looper.open();
      document.querySelector('button[data-select="bass"]')?.click();
      document.querySelector('#v34BarChoices button[data-bars="1"]')?.click();
      looper.state.bpm = 140;

      await looper.start(false);

      // Play Bass Pad 1
      const bassPad = document.querySelector('#v34BassPads .v34-bass-pad');
      bassPad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 3 }));
      await new Promise(r => setTimeout(r, 80));

      // Arm bass recording
      document.querySelector('#v34BassRecord').click();

      // Wait until recording starts at step 0
      while (looper.state.recordingLane !== 'bass') {
        await new Promise(r => setTimeout(r, 20));
      }

      // Sustain the same note across the entire 1-bar loop
      while (looper.state.recordingLane === 'bass') {
        await new Promise(r => setTimeout(r, 20));
      }

      looper.stop();
      const bassEvents = [...looper.tracks.bass.events];
      const bassLatchStillActive = Boolean(M.state.bassLatch);

      return {
        bassEvents,
        bassLatchStillActive
      };
    } catch (e) {
      return { err: e.message, stack: e.stack };
    }
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('Bass sustain test result:', bassSustainRes.result.value);
const bEvents = bassSustainRes.result.value.bassEvents;
assert(bEvents.length >= 1, 'Bass track recorded sustained event');
assert.strictEqual(bEvents[0].step, 0, 'Bass note starts at step 0');
assert.strictEqual(bEvents[0].durationSteps, 16, 'Bass note spans the entire 16 steps of the loop seamlessly');
console.log('PASS: Latched bass note captured at step 0 spanning full loop without voice cutoff!');

console.log('\nALL SECTION 2 & 3 ARMING, CARRY-FORWARD & GAPLESS TESTS PASSED (0 errors)!');
cleanup();
process.exit(0);
