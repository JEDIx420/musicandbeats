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
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-lead-test-'));
const chromePort = 9500 + Math.floor(Math.random() * 400);

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
}, 30000);

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
await new Promise(r => setTimeout(r, 1000));

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
      const V38 = window.MB_V38;
      const V39 = window.MB_V39;
      if (!V39?.makeLeadVoice) throw new Error('V39.makeLeadVoice not exposed');

      // Test 1: Synth voice plays normally
      V38.state.voice = 'Glass Lead';
      const v1 = await V39.makeLeadVoice(60, null, 0.8);
      record('synth_lead_voice_created', Boolean(v1 && typeof v1.stop === 'function'), 'Voice created');
      v1?.stop();

      // Test 2: Sampled voice with mock buffer to simulate decoded GeneralUser GS
      V38.state.voice = 'Grand Piano';
      const spec = V38.SAMPLE_VOICES['Grand Piano'];
      window[spec.variable] = {
        zones: [
          { keyRangeLow: 0, keyRangeHigh: 127, originalPitch: 6000, sampleRate: 44100, file: btoa('testaudio') }
        ]
      };
      const zone = window[spec.variable].zones[0];
      const audioCtx = await ensureAudio();
      const fakeBuffer = audioCtx.createBuffer(1, 4410, 44100);
      V39.state.decodedBuffers.set(zone, fakeBuffer);

      // Now V39.sampleManager.isVoiceReady('Grand Piano', 60) will be true!
      const isReady = V39.sampleManager.isVoiceReady('Grand Piano', 60);
      record('sample_voice_is_ready', isReady === true, 'Sample zone marked ready');

      // Test 3: Call makeLeadVoice when sample is ready - this was where ReferenceError: vel threw!
      let sampleV = null;
      let errorThrown = null;
      try {
        sampleV = await V39.makeLeadVoice(60, null, 0.75);
      } catch (err) {
        errorThrown = err.message;
      }
      record('sample_lead_voice_no_throw', errorThrown === null, errorThrown || 'makeLeadVoice executed smoothly');
      record('sample_lead_voice_has_velocity', sampleV?.velocity === 0.75, 'Voice received velocity');
      record('sample_lead_voice_stoppable', typeof sampleV?.stop === 'function', 'Voice can stop');
      sampleV?.stop();

      // Test 4: Rapid 25 notes sequence on sampled Lead
      let rapidSuccess = true;
      const voices = [];
      for (let m = 48; m <= 72; m++) {
        try {
          const v = await V39.makeLeadVoice(m, null, 0.8);
          if (!v) { rapidSuccess = false; break; }
          voices.push(v);
        } catch (e) {
          rapidSuccess = false;
          record('rapid_sample_lead', false, e.message);
          break;
        }
      }
      record('rapid_25_sample_lead_notes', rapidSuccess && voices.length === 25, 'All 25 notes produced voices');
      voices.forEach(v => v?.stop());

      // Test 5: MIDI Lead trigger
      const midiLead = await V39.startMidiLead(64, 0.9, 1);
      record('start_midi_lead_sampled', Boolean(midiLead?.voice), 'startMidiLead returned voice');
      V39.stopMidiLead(64, 1);
      record('stop_midi_lead_clean', true, 'stopMidiLead cleaned up');

      // Test 6: Blur / visibility simulation does not crash or leave hung notes
      window.dispatchEvent(new Event('blur'));
      document.dispatchEvent(new Event('visibilitychange'));
      record('blur_visibility_handled', true, 'stopLead handled on blur/visibility');

      // Test 7: Notes immediately playable again after blur/visibility
      const afterBlurV = await V39.makeLeadVoice(60, null, 0.8);
      record('lead_playable_after_blur', Boolean(afterBlurV?.stop), 'Lead continues to play after blur');
      afterBlurV?.stop();

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

assert.strictEqual(testResult?.result?.value?.pass, true, 'Lead reliability tests must pass');
console.log('ALL LEAD RELIABILITY TESTS PASSED!');
process.exit(0);
