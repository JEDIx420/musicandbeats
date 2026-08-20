const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

let ctx = null;
let master = null;
let compressor = null;
let inputGain = null;
let micSource = null;
let micStream = null;
let synthBus = null;
let synthDry = null;
let reverbNode = null;
let reverbWet = null;
let drumBus = null;
let transportRunning = false;
let beatRunning = false;
let transportStart = 0;
let currentStep = 0;
let nextStepTime = 0;
let schedulerTimer = null;
let armedTrack = null;
let db = null;
let inputInitialized = false;

const activePointers = new Map();
const activeChordPointers = new Map();
const activeVoices = new Set();
const trackColors = ['#8b7cff','#5fb7ff','#58d59a','#f5b85c','#f47eac','#7ed8d2'];

const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const flatNames = {'C#':'C♯','D#':'D♯','F#':'F♯','G#':'G♯','A#':'A♯'};
const trackState = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  name: ['Guitar / Input','Vocal / Input','Keys','Pad','Idea','Beat'][i],
  source: i < 2 ? 'input' : i === 5 ? 'beats' : 'keyboard',
  gain: null,
  buffer: null,
  blob: null,
  playingSource: null,
  recorder: null,
  recordDest: null,
  muted: false,
  recording: false,
  volume: .88,
}));

const soundPresets = {
  'Studio Grand': { oscs:[['triangle',0,.74],['sine',12,.20],['sine',24,.06]], attack:.004, decay:.55, sustain:.34, release:.75, filter:7600, resonance:.35, velocity:.95 },
  'Soft Grand': { oscs:[['triangle',0,.78],['sine',12,.16],['sine',24,.04]], attack:.008, decay:.8, sustain:.28, release:1.05, filter:4300, resonance:.25, velocity:.82 },
  'Velvet EP': { oscs:[['sine',0,.70],['triangle',12,.22],['sine',24,.08]], attack:.009, decay:.28, sustain:.58, release:1.15, filter:5000, resonance:.4, velocity:.92 },
  'Wurli Drive': { oscs:[['triangle',0,.62],['square',12,.16],['sine',24,.08]], attack:.006, decay:.22, sustain:.52, release:.7, filter:3500, resonance:.7, velocity:.90 },
  'Tonewheel Organ': { oscs:[['sine',0,.48],['sine',12,.27],['sine',19,.15],['sine',24,.10]], attack:.025, decay:.05, sustain:.9, release:.22, filter:8500, resonance:.2, velocity:.75 },
  'Warm Analog': { oscs:[['sawtooth',0,.50],['triangle',-12,.24],['sawtooth',7,.18]], attack:.08, decay:.32, sustain:.62, release:.9, filter:2900, resonance:1.1, velocity:.72 },
  'Dream Pad': { oscs:[['triangle',0,.44],['sawtooth',12,.23],['sine',7,.18]], attack:.48, decay:.55, sustain:.68, release:2.2, filter:3600, resonance:.55, velocity:.62 },
  'Air Choir': { oscs:[['sine',0,.48],['triangle',7,.24],['triangle',12,.18]], attack:.38, decay:.4, sustain:.7, release:1.8, filter:4200, resonance:.45, velocity:.60 },
  'Glass Bell': { oscs:[['sine',0,.58],['sine',19,.23],['sine',31,.12]], attack:.002, decay:.35, sustain:.18, release:1.6, filter:11000, resonance:.2, velocity:.84 },
  'Pluck': { oscs:[['triangle',0,.62],['sawtooth',12,.16]], attack:.002, decay:.14, sustain:.10, release:.26, filter:6200, resonance:1.0, velocity:.86 },
  'Sub Bass': { oscs:[['sine',-12,.58],['sawtooth',0,.24],['triangle',12,.08]], attack:.008, decay:.16, sustain:.68, release:.28, filter:1250, resonance:1.2, velocity:.82 },
  'Neon Lead': { oscs:[['sawtooth',0,.52],['square',12,.13],['triangle',7,.20]], attack:.015, decay:.18, sustain:.67, release:.38, filter:4700, resonance:1.5, velocity:.72 },
};

const beatPresets = {
  Worship: { kick:[0,8], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
  Pop: { kick:[0,6,8,11], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
  Rock: { kick:[0,3,8,10], snare:[4,12], hat:[0,2,4,6,8,10,12,14] },
  Funk: { kick:[0,3,7,10,14], snare:[4,12,15], hat:[0,2,3,5,6,8,10,11,13,14] },
  House: { kick:[0,4,8,12], snare:[4,12], hat:[2,6,10,14] },
  Trap: { kick:[0,7,10,14], snare:[4,12], hat:[0,2,4,6,8,9,10,11,12,14,15] },
  Reggaeton: { kick:[0,3,8,11], snare:[4,7,12,15], hat:[0,2,4,6,8,10,12,14] },
  'Lo-Fi': { kick:[0,7,10], snare:[4,12], hat:[0,3,6,9,12,15] },
};

let pattern = { kick:new Array(16).fill(false), snare:new Array(16).fill(false), hat:new Array(16).fill(false) };

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }
function midiToFreq(m){ return 440 * Math.pow(2, (m - 69) / 12); }
function midiName(midi){ const n = notes[midi % 12]; return `${flatNames[n] || n}${Math.floor(midi / 12) - 1}`; }
function setStatus(text){ $('#status').textContent = text; }

function createReverbImpulse(audioCtx, seconds = 1.65, decay = 2.8){
  const length = Math.floor(audioCtx.sampleRate * seconds);
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for(let c = 0; c < 2; c++){
    const data = impulse.getChannelData(c);
    for(let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
  }
  return impulse;
}

function buildAudioGraph(){
  if(ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint:'interactive' });
  master = ctx.createGain();
  compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -12; compressor.knee.value = 12; compressor.ratio.value = 4; compressor.attack.value = .003; compressor.release.value = .18;
  master.gain.value = .9; master.connect(compressor).connect(ctx.destination);

  inputGain = ctx.createGain(); inputGain.gain.value = 1;
  synthBus = ctx.createGain(); synthBus.gain.value = .92;
  synthDry = ctx.createGain(); synthDry.gain.value = .92;
  reverbNode = ctx.createConvolver(); reverbNode.buffer = createReverbImpulse(ctx);
  reverbWet = ctx.createGain(); reverbWet.gain.value = +$('#reverb').value;
  synthBus.connect(synthDry).connect(master);
  synthBus.connect(reverbNode).connect(reverbWet).connect(master);
  drumBus = ctx.createGain(); drumBus.gain.value = .84; drumBus.connect(master);
  trackState.forEach(t => { t.gain = ctx.createGain(); t.gain.gain.value = t.volume; t.gain.connect(master); });
  updateEngineUI(true);
}

async function ensureAudioContext(){
  buildAudioGraph();
  if(ctx.state === 'suspended') await ctx.resume();
  updateEngineUI(true);
  return ctx;
}

function primeAudioForGesture(){
  buildAudioGraph();
  if(ctx.state === 'suspended') ctx.resume().catch(()=>{});
  updateEngineUI(true);
  return ctx;
}

function updateEngineUI(ready){
  const btn = $('#audioBtn'); const badge = $('#engineBadge');
  btn.classList.toggle('ready', ready); badge.classList.toggle('ready', ready);
  if(ready){
    btn.querySelector('strong').textContent = 'Audio ready'; btn.querySelector('small').textContent = 'Low-latency engine active';
    badge.innerHTML = '<span class="status-dot"></span>Engine ready';
  }
}

async function setupAudioInput(forceDeviceId = null){
  await ensureAudioContext();
  if(!navigator.mediaDevices?.getUserMedia){ setStatus('Audio input is not available in this browser'); return false; }
  try{
    const deviceId = forceDeviceId ?? $('#inputDevice').value;
    if(micSource){ try{ micSource.disconnect(); }catch{} }
    if(micStream) micStream.getTracks().forEach(t => t.stop());
    const audio = { echoCancellation:false, noiseSuppression:false, autoGainControl:false };
    if(deviceId) audio.deviceId = { exact: deviceId };
    micStream = await navigator.mediaDevices.getUserMedia({ audio });
    micSource = ctx.createMediaStreamSource(micStream); micSource.connect(inputGain);
    inputInitialized = true;
    routeMonitor();
    await populateInputs();
    $('#inputHint').textContent = 'Input connected and ready to record.';
    setStatus('External audio connected');
    return true;
  }catch(err){
    console.warn(err); inputInitialized = false; $('#inputHint').textContent = 'Input permission was not granted or the device is unavailable.'; setStatus('Could not connect audio input'); return false;
  }
}

async function populateInputs(){
  if(!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  const select = $('#inputDevice'); const current = select.value;
  const inputs = devices.filter(d => d.kind === 'audioinput');
  select.innerHTML = '<option value="">Default iPad input</option>' + inputs.map(d => `<option value="${d.deviceId}">${d.label || 'Audio input'}</option>`).join('');
  if(inputs.some(d => d.deviceId === current)) select.value = current;
}

function routeMonitor(){
  if(!ctx || !inputGain) return;
  try{ inputGain.disconnect(master); }catch{}
  if($('#monitorInput').checked) inputGain.connect(master);
}

function renderTracks(){
  $('#tracks').innerHTML = trackState.map(t => `
    <article class="track ${t.recording ? 'active' : ''}" data-track="${t.id}" style="--track:${trackColors[t.id]}">
      <div class="track-number">${String(t.id+1).padStart(2,'0')}</div>
      <div class="track-name"><strong>${t.name}</strong><small>${t.buffer ? `${t.buffer.duration.toFixed(1)}s loop` : 'Empty layer'}</small></div>
      <select class="source-select" aria-label="Source for layer ${t.id+1}">
        <option value="input" ${t.source==='input'?'selected':''}>Audio input</option>
        <option value="keyboard" ${t.source==='keyboard'?'selected':''}>Keys</option>
        <option value="beats" ${t.source==='beats'?'selected':''}>Beats</option>
      </select>
      <input class="track-volume" type="range" min="0" max="1" step=".01" value="${t.volume}" aria-label="Volume for layer ${t.id+1}" />
      <button class="record-btn ${t.recording?'recording':''}" type="button" aria-label="${t.recording?'Stop':'Record'} layer ${t.id+1}"></button>
      <button class="track-action mute-btn ${t.muted?'muted':''}" type="button" aria-label="Mute layer ${t.id+1}">${t.muted?'On':'Mute'}</button>
      <button class="track-action clear-btn" type="button" aria-label="Clear layer ${t.id+1}">×</button>
    </article>`).join('');

  $$('.track').forEach(el => {
    const t = trackState[+el.dataset.track];
    $('.source-select', el).addEventListener('change', e => t.source = e.target.value);
    $('.track-volume', el).addEventListener('input', e => { t.volume = +e.target.value; if(t.gain && !t.muted) t.gain.gain.value = t.volume; });
    $('.record-btn', el).addEventListener('click', () => t.recording ? stopRecording(t) : startRecording(t));
    $('.mute-btn', el).addEventListener('click', () => { t.muted = !t.muted; if(t.gain) t.gain.gain.value = t.muted ? 0 : t.volume; renderTracks(); });
    $('.clear-btn', el).addEventListener('click', () => { clearTrack(t); renderTracks(); });
  });
}

function getRecordSource(t){ return t.source === 'keyboard' ? synthBus : t.source === 'beats' ? drumBus : inputGain; }

async function startRecording(t){
  await ensureAudioContext();
  if(t.source === 'input' && !inputInitialized){ const ok = await setupAudioInput(); if(!ok) return; }
  if(armedTrack && armedTrack !== t) await stopRecording(armedTrack);
  if(!window.MediaRecorder){ setStatus('Recording is not supported by this browser'); return; }
  t.recordDest = ctx.createMediaStreamDestination();
  getRecordSource(t).connect(t.recordDest);
  const types = ['audio/mp4','audio/webm;codecs=opus','audio/webm'];
  const mimeType = types.find(x => MediaRecorder.isTypeSupported?.(x)) || '';
  const chunks = [];
  try{ t.recorder = new MediaRecorder(t.recordDest.stream, mimeType ? { mimeType } : undefined); }catch(err){ console.warn(err); setStatus('Could not start the recorder'); return; }
  t.recorder.ondataavailable = e => { if(e.data.size) chunks.push(e.data); };
  t.recorder.onstop = async () => {
    try{
      const blob = new Blob(chunks, { type:t.recorder.mimeType || 'audio/webm' });
      const decoded = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      t.blob = blob; t.buffer = decoded; renderTracks();
      if(transportRunning) startTrack(t, alignedStart());
      setStatus(`${t.name} captured`);
    }catch(err){ console.warn(err); setStatus('Recording captured, but Safari could not decode it'); }
  };
  t.recorder.start(120); t.recording = true; armedTrack = t; renderTracks(); setStatus(`Recording ${t.name}`);
}

async function stopRecording(t){
  if(!t.recording) return;
  t.recording = false;
  if(t.recorder?.state !== 'inactive') t.recorder.stop();
  try{ getRecordSource(t).disconnect(t.recordDest); }catch{}
  if(armedTrack === t) armedTrack = null;
  renderTracks();
}

function clearTrack(t){
  if(t.playingSource){ try{ t.playingSource.stop(); }catch{} }
  if(t.recording) stopRecording(t);
  t.buffer = null; t.blob = null; t.playingSource = null;
}

function alignedStart(){
  const bar = (60 / +$('#bpm').value) * 4;
  if(!transportRunning) return ctx.currentTime + .04;
  const elapsed = Math.max(0, ctx.currentTime - transportStart);
  return transportStart + Math.ceil(elapsed / bar) * bar;
}

function startTrack(t, when = ctx.currentTime + .04){
  if(!t.buffer || !ctx) return;
  if(t.playingSource){ try{ t.playingSource.stop(); }catch{} }
  const s = ctx.createBufferSource(); s.buffer = t.buffer; s.loop = true; s.connect(t.gain); s.start(when); t.playingSource = s;
}
function stopTracks(){ trackState.forEach(t => { if(t.playingSource){ try{ t.playingSource.stop(); }catch{} t.playingSource = null; } }); }

async function toggleTransport(){
  await ensureAudioContext(); transportRunning = !transportRunning;
  $('#transportBtn').classList.toggle('playing', transportRunning); $('#transportBtn').textContent = transportRunning ? '■' : '▶';
  if(transportRunning){ transportStart = ctx.currentTime + .06; trackState.forEach(t => startTrack(t, transportStart)); startScheduler(); setStatus('Session playing'); }
  else{ stopTracks(); if(!beatRunning) stopScheduler(); setStatus('Stopped'); }
}

function setBpm(value){ $('#bpm').value = clamp(Math.round(value), 40, 220); }
function stepDuration(){ return 60 / +$('#bpm').value / 4; }
function startScheduler(){ if(!ctx) return; if(!schedulerTimer){ currentStep = 0; nextStepTime = ctx.currentTime + .05; schedulerTimer = setInterval(scheduleAhead, 25); } }
function stopScheduler(){ if(schedulerTimer){ clearInterval(schedulerTimer); schedulerTimer = null; clearStepHighlight(); } }
function scheduleAhead(){ while(nextStepTime < ctx.currentTime + .12){ scheduleStep(currentStep, nextStepTime); const swing = +$('#swing').value / 100; nextStepTime += stepDuration() * (currentStep % 2 ? 1 + swing : 1 - swing); currentStep = (currentStep + 1) % 16; } }
function scheduleStep(step,time){
  if(beatRunning){ if(pattern.kick[step]) kick(time); if(pattern.snare[step]) snare(time); if(pattern.hat[step]) hat(time); }
  if($('#metronome').checked && step % 4 === 0) click(time, step === 0);
  const delay = Math.max(0, (time - ctx.currentTime) * 1000); setTimeout(() => highlightStep(step), delay);
}
function highlightStep(step){ clearStepHighlight(); $$(`.step[data-step="${step}"]`).forEach(x => x.classList.add('playing')); }
function clearStepHighlight(){ $$('.step.playing').forEach(x => x.classList.remove('playing')); }

function kick(time){
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(145,time); o.frequency.exponentialRampToValueAtTime(46,time+.115); g.gain.setValueAtTime(.95,time); g.gain.exponentialRampToValueAtTime(.001,time+.32); o.connect(g).connect(drumBus); o.start(time); o.stop(time+.34);
}
function snare(time){
  const len = Math.floor(ctx.sampleRate * .18), b = ctx.createBuffer(1,len,ctx.sampleRate), d = b.getChannelData(0); for(let i=0;i<len;i++) d[i] = Math.random()*2-1;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer=b; f.type='highpass'; f.frequency.value=1100; g.gain.setValueAtTime(.48,time); g.gain.exponentialRampToValueAtTime(.001,time+.18); s.connect(f).connect(g).connect(drumBus); s.start(time);
  const tone = ctx.createOscillator(), tg = ctx.createGain(); tone.type='triangle'; tone.frequency.value=185; tg.gain.setValueAtTime(.16,time); tg.gain.exponentialRampToValueAtTime(.001,time+.12); tone.connect(tg).connect(drumBus); tone.start(time); tone.stop(time+.13);
}
function hat(time){
  const len = Math.floor(ctx.sampleRate * .055), b = ctx.createBuffer(1,len,ctx.sampleRate), d = b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(.18,time);g.gain.exponentialRampToValueAtTime(.001,time+.055);s.connect(f).connect(g).connect(drumBus);s.start(time);
}
function click(time,accent){ const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=accent?1250:880;g.gain.setValueAtTime(.14,time);g.gain.exponentialRampToValueAtTime(.001,time+.05);o.connect(g).connect(master);o.start(time);o.stop(time+.06); }

function loadBeat(style, variation = false){
  const base = beatPresets[style] || beatPresets.Pop; const energy = +$('#beatEnergy').value;
  for(const lane of ['kick','snare','hat']) pattern[lane] = new Array(16).fill(false);
  for(const lane of ['kick','snare','hat']) base[lane].forEach(i => pattern[lane][i] = true);
  if(variation){
    const density = (.035 + energy * .018) * (style === 'Funk' || style === 'Trap' ? 1.5 : 1);
    for(const lane of ['kick','snare','hat']) for(let i=0;i<16;i++){
      if(Math.random() < density){
        if(lane === 'snare' && (i === 4 || i === 12)) continue;
        pattern[lane][i] = !pattern[lane][i];
      }
    }
    pattern.snare[4] = true; pattern.snare[12] = true;
    if(energy >= 4){ pattern.hat[15] = true; if(Math.random()>.45) pattern.kick[14] = true; }
  }
  renderSequencer();
}
function renderSequencer(){
  const lanes = [['kick','KICK'],['snare','SNARE'],['hat','HI-HAT']];
  $('#sequencer').innerHTML = lanes.map(([lane,label]) => `<div class="step-label">${label}</div>${pattern[lane].map((on,i) => `<button type="button" class="step ${on?'on':''}" data-lane="${lane}" data-step="${i}" aria-label="${label} step ${i+1}"></button>`).join('')}`).join('');
  $$('.step').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); const lane=b.dataset.lane,i=+b.dataset.step; pattern[lane][i]=!pattern[lane][i]; b.classList.toggle('on',pattern[lane][i]); }));
}

function createVoice(midi, velocity = .8){
  if(!ctx) return null;
  const preset = soundPresets[$('#soundPreset').value] || soundPresets['Studio Grand'];
  const now = ctx.currentTime; const filter = ctx.createBiquadFilter(); const amp = ctx.createGain();
  filter.type = 'lowpass'; filter.frequency.value = Math.min(+$('#tone').value, preset.filter); filter.Q.value = preset.resonance;
  const peak = clamp(velocity * preset.velocity * .30, .02, .32);
  amp.gain.setValueAtTime(.0001, now); amp.gain.exponentialRampToValueAtTime(peak, now + preset.attack + .004); amp.gain.exponentialRampToValueAtTime(Math.max(.0001, peak * preset.sustain), now + preset.attack + preset.decay);
  filter.connect(amp).connect(synthBus);
  const oscillators = preset.oscs.map(([type,semi,gainAmount], idx) => {
    const osc = ctx.createOscillator(); const mix = ctx.createGain(); osc.type = type; osc.frequency.value = midiToFreq(midi + semi); osc.detune.value = (idx - 1) * 2.5; mix.gain.value = gainAmount; osc.connect(mix).connect(filter); osc.start(now); return {osc,mix};
  });
  const voice = { stopped:false, midi, stop(){
    if(this.stopped) return; this.stopped = true; const t = ctx.currentTime; const rel = preset.release * (0.65 + +$('#sustain').value * .45);
    try{ amp.gain.cancelScheduledValues(t); amp.gain.setValueAtTime(Math.max(.0001, amp.gain.value), t); amp.gain.exponentialRampToValueAtTime(.0001, t + rel); oscillators.forEach(({osc}) => osc.stop(t + rel + .03)); }catch{}
    activeVoices.delete(this); updatePolyphony();
  }};
  activeVoices.add(voice); updatePolyphony(); return voice;
}
function updatePolyphony(){ $('#polyphonyBadge').textContent = `${activeVoices.size} ${activeVoices.size === 1 ? 'voice' : 'voices'}`; }
function panicVoices(){ activePointers.forEach(v => v.voice?.stop()); activeChordPointers.forEach(list => list.forEach(v => v.stop())); activePointers.clear(); activeChordPointers.clear(); activeVoices.forEach(v => v.stop()); $$('.piano-key.active,.chord.active').forEach(el => el.classList.remove('active')); }

function keyboardRange(){ return window.matchMedia('(max-width: 640px)').matches ? 12 : 24; }
function renderKeyboard(){
  const startOct = +$('#octave').value; const startMidi = (startOct + 1) * 12; const semitones = keyboardRange(); const endMidi = startMidi + semitones;
  const whites = []; const blacks = []; let whiteIndex = 0;
  for(let m = startMidi; m <= endMidi; m++){
    const note = notes[m % 12]; const isBlack = note.includes('#');
    if(isBlack){ blacks.push({midi:m, afterWhite:whiteIndex}); }
    else{ whites.push({midi:m, index:whiteIndex}); whiteIndex++; }
  }
  const whiteCount = whites.length;
  $('#keyboard').innerHTML = whites.map(w => `<button type="button" class="piano-key white-key" data-midi="${w.midi}" aria-label="${midiName(w.midi)}">${midiName(w.midi)}</button>`).join('') + blacks.map(b => {
    const left = (b.afterWhite / whiteCount) * 100; return `<button type="button" class="piano-key black-key" style="left:${left}%" data-midi="${b.midi}" aria-label="${midiName(b.midi)}">${midiName(b.midi)}</button>`;
  }).join('');
}

function keyFromPoint(x,y){ const el = document.elementFromPoint(x,y); return el?.closest?.('.piano-key'); }
function startPointerNote(pointerId,key,pressure=.75){
  primeAudioForGesture();
  if(activePointers.has(pointerId) || !key) return;
  key.classList.add('active');
  const velocity = pressure > 0 && pressure < 1 ? .55 + pressure * .45 : .82;
  const voice = createVoice(+key.dataset.midi, velocity);
  activePointers.set(pointerId,{ key, voice, midi:+key.dataset.midi });
}
function movePointerNote(pointerId,key){
  const current = activePointers.get(pointerId); if(!current || !key || +key.dataset.midi === current.midi) return;
  current.key.classList.remove('active'); current.voice?.stop(); key.classList.add('active');
  const voice = createVoice(+key.dataset.midi,.82); activePointers.set(pointerId,{key,voice,midi:+key.dataset.midi});
}
function stopPointerNote(pointerId){ const current = activePointers.get(pointerId); if(!current) return; current.key.classList.remove('active'); current.voice?.stop(); activePointers.delete(pointerId); }
function bindKeyboardSurface(){
  const keyboard = $('#keyboard');
  keyboard.addEventListener('pointerdown', e => { const key=e.target.closest('.piano-key'); if(!key) return; e.preventDefault(); try{ keyboard.setPointerCapture(e.pointerId); }catch{} startPointerNote(e.pointerId,key,e.pressure); });
  keyboard.addEventListener('pointermove', e => { if(!activePointers.has(e.pointerId)) return; e.preventDefault(); const key=keyFromPoint(e.clientX,e.clientY); if(key && keyboard.contains(key)) movePointerNote(e.pointerId,key); });
  const end = e => { if(activePointers.has(e.pointerId)){ e.preventDefault(); stopPointerNote(e.pointerId); } };
  keyboard.addEventListener('pointerup',end); keyboard.addEventListener('pointercancel',end); keyboard.addEventListener('lostpointercapture',end);
}

function chordIntervals(flavor, quality){
  if(flavor==='sus2') return [0,2,7]; if(flavor==='sus4') return [0,5,7]; if(flavor==='6') return quality==='minor'?[0,3,7,9]:[0,4,7,9];
  const triad = quality==='minor'?[0,3,7]:quality==='dim'?[0,3,6]:[0,4,7];
  if(flavor==='triad') return triad; if(flavor==='maj7') return [...triad,11]; if(flavor==='m7') return [0,3,7,10]; if(flavor==='7') return [...triad,quality==='major'?10:quality==='dim'?9:10];
  if(flavor==='9') return [...triad,10,14]; if(flavor==='maj9') return [...triad,11,14]; if(flavor==='m9') return [0,3,7,10,14]; if(flavor==='11') return [...triad,10,14,17]; if(flavor==='13') return [...triad,10,14,17,21]; return triad;
}
function applyVoicing(intervals){
  const mode = $('#voicing').value; const out = [...intervals];
  if(mode === 'open' && out.length >= 3) out[1] += 12;
  if(mode === 'wide' && out.length >= 3){ out[1] += 12; out[out.length-1] += 12; }
  return out.sort((a,b)=>a-b);
}
function renderChords(){
  const root = notes.indexOf($('#songKey').value), scale=[0,2,4,5,7,9,11], qualities=['major','minor','minor','major','major','minor','dim'], romans=['I','ii','iii','IV','V','vi','vii°'];
  $('#chords').innerHTML = scale.map((semi,i) => { const n=notes[(root+semi)%12],q=qualities[i]; const display=flatNames[n]||n; return `<button type="button" class="chord" data-root="${n}" data-quality="${q}"><strong>${display}${q==='minor'?'m':q==='dim'?'°':''}</strong><span>${romans[i]}</span></button>`; }).join('');
  $$('.chord').forEach(b => {
    b.addEventListener('pointerdown', e => { e.preventDefault(); try{ b.setPointerCapture(e.pointerId); }catch{} primeAudioForGesture(); b.classList.add('active'); const voices=playChord(b.dataset.root,b.dataset.quality); activeChordPointers.set(e.pointerId,voices); });
    const end=e=>{ const voices=activeChordPointers.get(e.pointerId); if(!voices)return; e.preventDefault(); voices.forEach(v=>v.stop()); activeChordPointers.delete(e.pointerId); b.classList.remove('active'); };
    b.addEventListener('pointerup',end); b.addEventListener('pointercancel',end); b.addEventListener('lostpointercapture',end);
  });
}
function playChord(root,quality){
  const flavor=$('#chordFlavor').value, base=notes.indexOf(root), oct=+$('#octave').value, baseMidi=(oct+1)*12+base;
  return applyVoicing(chordIntervals(flavor,quality)).map((semi,i) => createVoice(baseMidi+semi, .72 - Math.min(i*.025,.12))).filter(Boolean);
}

function switchView(view){
  $('.workspace').dataset.activeView = view;
  $$('.view-tab,.mobile-nav').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if(view !== 'keys') panicVoices();
}

function openDB(){
  return new Promise((resolve,reject) => { const r=indexedDB.open('musicandbeats',2); r.onupgradeneeded=()=>{ if(!r.result.objectStoreNames.contains('projects')) r.result.createObjectStore('projects'); }; r.onsuccess=()=>{db=r.result;resolve(db)}; r.onerror=()=>reject(r.error); });
}
async function saveProject(){
  if(!db) await openDB();
  const project={ bpm:+$('#bpm').value,swing:+$('#swing').value,style:$('#beatStyle').value,energy:+$('#beatEnergy').value,pattern,sound:$('#soundPreset').value,key:$('#songKey').value,chord:$('#chordFlavor').value,voicing:$('#voicing').value,tracks:trackState.map(t=>({source:t.source,blob:t.blob||null,volume:t.volume,muted:t.muted})) };
  await new Promise((resolve,reject)=>{ const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(project,'last');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); });
  setStatus('Project saved on this device');
}
async function loadProject(){
  if(!db) await openDB();
  const p=await new Promise(resolve=>{ const tx=db.transaction('projects');const r=tx.objectStore('projects').get('last');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null); });
  if(!p) return;
  setBpm(p.bpm||100); $('#swing').value=p.swing||8; $('#swingValue').textContent=`${$('#swing').value}%`; $('#beatStyle').value=p.style||'Worship'; $('#beatEnergy').value=p.energy||3; $('#energyValue').textContent=$('#beatEnergy').value;
  if(p.sound && soundPresets[p.sound]) $('#soundPreset').value=p.sound; if(p.key) $('#songKey').value=p.key; if(p.chord) $('#chordFlavor').value=p.chord; if(p.voicing) $('#voicing').value=p.voicing;
  pattern=p.pattern||pattern; p.tracks?.forEach((saved,i)=>{ const t=trackState[i];t.source=saved.source||t.source;t.blob=saved.blob||null;t.volume=saved.volume??t.volume;t.muted=!!saved.muted; });
  renderSequencer(); renderTracks(); renderChords(); if(ctx) await decodeSavedTracks(); setStatus('Saved session restored');
}
async function decodeSavedTracks(){ for(const t of trackState){ if(t.blob&&!t.buffer){ try{t.buffer=await ctx.decodeAudioData((await t.blob.arrayBuffer()).slice(0));}catch{} } } renderTracks(); }

function setupSelectors(){
  $('#soundPreset').innerHTML=Object.keys(soundPresets).map(n=>`<option>${n}</option>`).join('');
  $('#songKey').innerHTML=notes.map(n=>`<option>${n}</option>`).join(''); $('#songKey').value='C';
}

$('#audioBtn').addEventListener('click',async()=>{ await ensureAudioContext(); await decodeSavedTracks(); setStatus('Audio engine ready'); });
$('#transportBtn').addEventListener('click',toggleTransport);
$('#bpmDown').addEventListener('click',()=>setBpm(+$('#bpm').value-1)); $('#bpmUp').addEventListener('click',()=>setBpm(+$('#bpm').value+1)); $('#bpm').addEventListener('change',e=>setBpm(+e.target.value));
$('#refreshInputs').addEventListener('click',()=>setupAudioInput()); $('#inputDevice').addEventListener('change',e=>setupAudioInput(e.target.value)); $('#monitorInput').addEventListener('change',routeMonitor);
$('#swing').addEventListener('input',e=>$('#swingValue').textContent=`${e.target.value}%`); $('#reverb').addEventListener('input',e=>{ if(reverbWet) reverbWet.gain.setTargetAtTime(+e.target.value,ctx.currentTime,.03); });
$('#beatStyle').addEventListener('change',e=>loadBeat(e.target.value,false)); $('#beatEnergy').addEventListener('input',e=>$('#energyValue').textContent=e.target.value); $('#generateBeat').addEventListener('click',()=>loadBeat($('#beatStyle').value,true));
$('#beatToggle').addEventListener('click',async()=>{ await ensureAudioContext(); beatRunning=!beatRunning; $('#beatToggle').classList.toggle('active',beatRunning); $('#beatToggle').textContent=beatRunning?'■ Stop preview':'▶ Preview'; if(beatRunning)startScheduler();else if(!transportRunning)stopScheduler(); });
$('#octave').addEventListener('change',()=>{ panicVoices(); renderKeyboard(); }); $('#songKey').addEventListener('change',renderChords); $('#chordFlavor').addEventListener('change',renderChords); $('#voicing').addEventListener('change',renderChords);
$('#saveBtn').addEventListener('click',saveProject); $('#clearAll').addEventListener('click',()=>{ trackState.forEach(clearTrack); renderTracks(); setStatus('All loops cleared'); });
$$('.view-tab,.mobile-nav').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
window.addEventListener('blur',panicVoices); document.addEventListener('visibilitychange',()=>{ if(document.hidden) panicVoices(); });
let resizeTimer; window.addEventListener('resize',()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{ panicVoices(); renderKeyboard(); },160); });

setupSelectors(); renderTracks(); renderKeyboard(); bindKeyboardSurface(); renderChords(); loadBeat('Worship'); openDB().then(loadProject).catch(()=>{});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
