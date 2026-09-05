import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import assert from 'assert';

const ROOT = process.cwd();
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, req.url.split('?')[0].replace(/^\//, '') || 'index.html');
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-clear-test-'));
const chromePort = 9600 + Math.floor(Math.random() * 300);

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
function cleanup() {
  try { if (ws) ws.close(); } catch {}
  try { chrome.kill('SIGKILL'); } catch {}
  try { server.close(); } catch {}
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
}

const watchdog = setTimeout(() => {
  console.error('Watchdog timeout');
  cleanup();
  process.exit(1);
}, 60000);

for (let i = 0; i < 40; i++) {
  try {
    const listRes = await fetch(`http://127.0.0.1:${chromePort}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
    if (pageTarget?.webSocketDebuggerUrl) {
      ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await new Promise(r => setTimeout(r, 150));
}

assert(ws, 'Failed to connect to Chrome page WebSocket');
await new Promise(r => ws.onopen = r);

let msgId = 1;
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
  const id = msgId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send('Runtime.enable');
await new Promise(r => setTimeout(r, 1200));

const testResult = await send('Runtime.evaluate', {
  expression: `(async () => {
    const results = [];
    function record(name, pass, detail = '') {
      results.push({ name, pass, detail });
      if (!pass) console.error('FAIL:', name, detail);
      else console.log('PASS:', name, detail);
    }

    try {
      if (typeof ensureAudio === 'function') await ensureAudio();
      const L = window.MB_V34_LOOPER;
      const V39 = window.MB_V39;
      if (!L || !V39) throw new Error('Looper or V39 not loaded');

      L.open();
      document.querySelector('button[data-select="keys"]')?.click();
      window.MB_V35.extra.latchKeys = true;
      L.state.bars = 1; // 1 bar = 16 steps for fast testing

      // Start transport
      if (!L.state.running) {
        document.querySelector('#v34Transport')?.click();
      }

      // --- TEST 1: Record Take A on Keys ---
      document.querySelector('#v34KeysRecord')?.click();
      let t0 = Date.now();
      while (L.state.recordingLane !== 'keys' && Date.now() - t0 < 4000) {
        await new Promise(r => setTimeout(r, 20));
      }
      record('take_a_recording_started', L.state.recordingLane === 'keys', 'Take A started');

      // Play Chord Pad 4 (e.g. G major, chord midis [55, 59, 62] or similar)
      const pads = document.querySelectorAll('#v34ChordPads .v34-performance-pad');
      pads[4]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));
      await new Promise(r => setTimeout(r, 200));
      // Play Chord Pad 5
      pads[5]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));

      // Wait for recording to complete 1-bar loop
      t0 = Date.now();
      while (L.state.recordingLane === 'keys' && Date.now() - t0 < 6000) {
        await new Promise(r => setTimeout(r, 30));
      }

      const takeAEvents = JSON.parse(JSON.stringify(L.tracks.keys.events));
      record('take_a_recorded_events', takeAEvents.length > 0, 'Take A recorded ' + takeAEvents.length + ' events');
      const takeAMidis = new Set(takeAEvents.flatMap(e => e.midis));

      // --- TEST 2: Clear Take A ---
      const clearBtn = document.querySelector('.v34-track[data-lane="keys"] button[data-action="clear"]');
      clearBtn?.click();

      record('clear_keys_events_empty', L.tracks.keys.events.length === 0, 'Track events reset to 0');
      record('clear_keys_latch_null', V39.state.keyLatch === null, 'keyLatch is null');
      const activePads = document.querySelectorAll('#v34ChordPads .v34-performance-pad.active, #v34ChordPads .v34-performance-pad.v36-latched');
      record('clear_keys_dom_unlatched', activePads.length === 0, 'No active/latched chord pads in DOM');
      record('clear_keys_transport_running', L.state.running === true, 'Transport keeps running');

      // --- TEST 3: Record Take B on Keys with completely different chord (Pad 0 - Tonic C) ---
      document.querySelector('#v34KeysRecord')?.click();
      t0 = Date.now();
      while (L.state.recordingLane !== 'keys' && Date.now() - t0 < 4000) {
        await new Promise(r => setTimeout(r, 20));
      }
      record('take_b_recording_started', L.state.recordingLane === 'keys', 'Take B started');

      // Play Chord Pad 0 only
      pads[0]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1 }));

      // Wait for recording to complete
      t0 = Date.now();
      while (L.state.recordingLane === 'keys' && Date.now() - t0 < 6000) {
        await new Promise(r => setTimeout(r, 30));
      }

      const takeBEvents = JSON.parse(JSON.stringify(L.tracks.keys.events));
      record('take_b_recorded_events', takeBEvents.length > 0, 'Take B recorded ' + takeBEvents.length + ' events');

      // Verify Take A notes NEVER appear in Take B!
      const pad4Midis = V39.midis ? V39.midis(V39.state.chords[4]) : [];
      const pad5Midis = V39.midis ? V39.midis(V39.state.chords[5]) : [];
      const takeBAllMidis = takeBEvents.flatMap(e => e.midis);
      const containsTakeAChord4 = pad4Midis.length > 0 && pad4Midis.every(m => takeBAllMidis.includes(m));
      const containsTakeAChord5 = pad5Midis.length > 0 && pad5Midis.every(m => takeBAllMidis.includes(m));

      record('take_a_chords_discarded', !containsTakeAChord4 && !containsTakeAChord5, 'Take A chords are completely absent from Take B');

      // --- TEST 4: Bass Lane Clear & Re-record ---
      document.querySelector('button[data-select="bass"]')?.click();
      window.MB_V35.extra.latchBass = true;
      document.querySelector('#v34BassRecord')?.click();
      t0 = Date.now();
      while (L.state.recordingLane !== 'bass' && Date.now() - t0 < 4000) {
        await new Promise(r => setTimeout(r, 20));
      }

      const bassPads = document.querySelectorAll('#v34BassPads .v34-performance-pad');
      bassPads[3]?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 2 }));
      t0 = Date.now();
      while (L.state.recordingLane === 'bass' && Date.now() - t0 < 6000) {
        await new Promise(r => setTimeout(r, 30));
      }
      record('bass_take_a_recorded', L.tracks.bass.events.length > 0, 'Bass Take A recorded');

      const bassClearBtn = document.querySelector('.v34-track[data-lane="bass"] button[data-action="clear"]');
      bassClearBtn?.click();
      record('clear_bass_events_empty', L.tracks.bass.events.length === 0, 'Bass events reset to 0');
      record('clear_bass_latch_null', V39.state.bassLatch === null, 'bassLatch is null');

      // --- TEST 5: Clear while Armed ---
      document.querySelector('#v34BassRecord')?.click();
      record('bass_armed', L.state.pendingLane === 'bass', 'Bass lane armed');
      document.querySelector('.v34-track[data-lane="bass"] button[data-action="clear"]')?.click();
      record('clear_disarms_pending', L.state.pendingLane === null, 'Clear disarmed pending lane');

      // --- TEST 6: Rapid Multiple Clears & Re-records ---
      let rapidPass = true;
      for (let cycle = 1; cycle <= 3; cycle++) {
        L.clearLane('keys');
        if (L.tracks.keys.events.length !== 0 || V39.state.keyLatch !== null) {
          rapidPass = false;
          break;
        }
      }
      record('rapid_repeated_clears_stable', rapidPass, 'Repeated clears stay 100% clean');

      // --- TEST 7: Live Lead remains playable and unaffected by Clear ---
      const leadV = await V39.makeLeadVoice(62, null, 0.85);
      record('lead_playing_before_clear', Boolean(leadV?.stop), 'Lead plays');
      L.clearLane('keys');
      record('lead_alive_after_clear', leadV?.stopped === false, 'Lead voice remained active after Keys clear');
      leadV?.stop();
      const leadV2 = await V39.makeLeadVoice(64, null, 0.85);
      record('lead_plays_after_clear', Boolean(leadV2?.stop), 'Lead continues to play after Keys clear');
      leadV2?.stop();

      // Stop transport
      L.stop();
      record('transport_stopped_clean', L.state.running === false, 'Transport stopped cleanly');

      return { pass: results.every(r => r.pass), results };
    } catch (e) {
      return { pass: false, error: e.message, stack: e.stack, results };
    }
  })()`,
  returnByValue: true,
  awaitPromise: true
});

console.log(JSON.stringify(testResult?.result?.value, null, 2));

clearTimeout(watchdog);
cleanup();

assert.strictEqual(testResult?.result?.value?.pass, true, 'Clear and re-record tests must pass');
console.log('ALL CLEAR AND RE-RECORD TESTS PASSED!');
process.exit(0);
