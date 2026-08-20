const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let ctx, master, inputGain, micSource, micStream, synthBus, drumBus;
let transportRunning = false;
let beatRunning = false;
let transportStart = 0;
let currentStep = 0;
let nextStepTime = 0;
let schedulerTimer = null;
let armedTrack = null;
let db;

const trackState = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  name: `Layer ${i + 1}`,
  source: i === 5 ? 'beats' : i < 2 ? 'input' : 'keyboard',
  gain: null,
  buffer: null,
  blob: null,
  playingSource: null,
  recorder: null,
  recordDest: null,
  muted: false,
  recording: false,
}));

const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const whiteNotes = ['C','D','E','F','G','A','B','C','D','E','F','G','A','B'];
const blackLayout = [
  [0,'C#'],[1,'D#'],[3,'F#'],[4,'G#'],[5,'A#'],
  [7,'C#'],[8,'D#'],[10,'F#'],[11,'G#'],[12,'A#']
];

const soundPresets = {
  'Grand-ish Piano': { wave:'triangle', attack:.006, release:.7, detune:0, filter:6500 },
  'Mellow Piano': { wave:'triangle', attack:.012, release:1.2, detune:-3, filter:3600 },
  'Bright Keys': { wave:'sine', attack:.003, release:.45, detune:4, filter:9000 },
  'Rhodes': { wave:'sine', attack:.01, release:1.6, detune:0, filter:4200 },
  'Wurli': { wave:'square', attack:.008, release:.9, detune:0, filter:2500 },
  'Hammond Organ': { wave:'square', attack:.02, release:.25, detune:-8, filter:5000 },
  'Warm Pad': { wave:'sawtooth', attack:.5, release:2.5, detune:-7, filter:1800 },
  'Dream Pad': { wave:'triangle', attack:.8, release:3, detune:7, filter:2500 },
  'Analog Poly': { wave:'sawtooth', attack:.05, release:.8, detune:4, filter:3200 },
  'Pluck': { wave:'triangle', attack:.001, release:.18, detune:0, filter:7000 },
  'Synth Bass': { wave:'sawtooth', attack:.01, release:.35, detune:-12, filter:1100 },
  'Soft Bell': { wave:'sine', attack:.002, release:1.8, detune:12, filter:10000 },
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

async function initAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint:'interactive' });
    master = ctx.createGain(); master.gain.value = .85; master.connect(ctx.destination);
    inputGain = ctx.createGain(); inputGain.gain.value = 1;
    synthBus = ctx.createGain(); synthBus.gain.value = .72; synthBus.connect(master);
    drumBus = ctx.createGain(); drumBus.gain.value = .8; drumBus.connect(master);
    trackState.forEach(t => { t.gain = ctx.createGain(); t.gain.value=.9; t.gain.connect(master); });
  }
  if (ctx.state === 'suspended') await ctx.resume();
  $('#audioBtn').textContent = 'Audio Ready';
  $('#status').textContent = 'Audio ready';
  await refreshInputs();
}

async function refreshInputs() {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    if (!micStream) micStream = await navigator.mediaDevices.getUserMedia({ audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false } });
    const devices = await navigator.mediaDevices.enumerateDevices();
    const current = $('#inputDevice').value;
    $('#inputDevice').innerHTML = '<option value="">Default iPad input</option>' + devices.filter(d=>d.kind==='audioinput').map(d=>`<option value="${d.deviceId}">${d.label || 'Audio input'}</option>`).join('');
    $('#inputDevice').value = current;
    await connectInput(current);
  } catch (e) {
    $('#status').textContent = 'Input permission needed';
  }
}

async function connectInput(deviceId='') {
  if (!ctx) return;
  if (micSource) { try { micSource.disconnect(); } catch {} }
  if (micStream) micStream.getTracks().forEach(t=>t.stop());
  const constraints = { audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false, ...(deviceId ? {deviceId:{exact:deviceId}} : {}) } };
  try {
    micStream = await navigator.mediaDevices.getUserMedia(constraints);
    micSource = ctx.createMediaStreamSource(micStream);
    micSource.connect(inputGain);
    routeMonitor();
    $('#status').textContent = 'Input connected';
  } catch (e) { $('#status').textContent = 'Could not connect input'; }
}

function routeMonitor(){
  if (!ctx || !inputGain) return;
  try { inputGain.disconnect(master); } catch {}
  if ($('#monitorInput').checked) inputGain.connect(master);
}

function renderTracks(){
  $('#tracks').innerHTML = trackState.map(t => `
    <div class="track" data-track="${t.id}">
      <div class="track-number">${t.id+1}</div>
      <div class="name"><strong>${t.name}</strong><small>${t.buffer ? 'Loop loaded' : 'Empty'}</small></div>
      <select class="source"><option value="input" ${t.source==='input'?'selected':''}>Audio input</option><option value="keyboard" ${t.source==='keyboard'?'selected':''}>Keyboard</option><option value="beats" ${t.source==='beats'?'selected':''}>Beats</option></select>
      <input class="volume" type="range" min="0" max="1" step=".01" value=".9" aria-label="Track volume" />
      <button class="record-btn">● Record</button>
      <button class="mute-btn">Mute</button>
      <button class="clear-btn">Clear</button>
    </div>`).join('');

  $$('.track').forEach(el => {
    const t = trackState[+el.dataset.track];
    el.querySelector('.source').addEventListener('change', e=>t.source=e.target.value);
    el.querySelector('.volume').addEventListener('input', e=>{ if(t.gain) t.gain.gain.value=+e.target.value; });
    el.querySelector('.record-btn').addEventListener('click', ()=> t.recording ? stopRecording(t) : startRecording(t));
    el.querySelector('.mute-btn').addEventListener('click', e=>{ t.muted=!t.muted; if(t.gain) t.gain.gain.value=t.muted?0:+el.querySelector('.volume').value; e.target.textContent=t.muted?'Unmute':'Mute'; });
    el.querySelector('.clear-btn').addEventListener('click', ()=>clearTrack(t));
  });
}

function getRecordSource(t){
  if (t.source==='keyboard') return synthBus;
  if (t.source==='beats') return drumBus;
  return inputGain;
}

async function startRecording(t){
  await initAudio();
  if (armedTrack && armedTrack !== t) await stopRecording(armedTrack);
  t.recordDest = ctx.createMediaStreamDestination();
  getRecordSource(t).connect(t.recordDest);
  const types = ['audio/mp4','audio/webm;codecs=opus','audio/webm'];
  const mimeType = types.find(x=>window.MediaRecorder?.isTypeSupported?.(x)) || '';
  const chunks=[];
  t.recorder = new MediaRecorder(t.recordDest.stream, mimeType ? {mimeType} : undefined);
  t.recorder.ondataavailable = e=>{ if(e.data.size) chunks.push(e.data); };
  t.recorder.onstop = async()=>{
    try {
      const blob = new Blob(chunks,{type:t.recorder.mimeType || 'audio/webm'});
      const ab = await blob.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab.slice(0));
      t.blob=blob; t.buffer=decoded;
      updateTrackUI(t);
      if (transportRunning) startTrack(t, alignedStart());
    } catch(e){ $('#status').textContent='Recording saved, but browser could not decode it'; }
  };
  t.recorder.start(100);
  t.recording=true; armedTrack=t;
  const el=$(`.track[data-track="${t.id}"]`); el.classList.add('active'); el.querySelector('.record-btn').classList.add('recording'); el.querySelector('.record-btn').textContent='■ Stop';
  $('#status').textContent=`Recording ${t.name} from ${t.source}`;
}

async function stopRecording(t){
  if (!t.recording) return;
  t.recording=false;
  if (t.recorder?.state !== 'inactive') t.recorder.stop();
  try { getRecordSource(t).disconnect(t.recordDest); } catch {}
  const el=$(`.track[data-track="${t.id}"]`); el.classList.remove('active'); el.querySelector('.record-btn').classList.remove('recording'); el.querySelector('.record-btn').textContent='● Record';
  if (armedTrack===t) armedTrack=null;
  $('#status').textContent=`Captured ${t.name}`;
}

function updateTrackUI(t){
  const el=$(`.track[data-track="${t.id}"]`); if(!el)return;
  el.querySelector('small').textContent=t.buffer ? `${t.buffer.duration.toFixed(1)}s loop` : 'Empty';
}

function clearTrack(t){
  if(t.playingSource){ try{t.playingSource.stop()}catch{} }
  t.buffer=null; t.blob=null; t.playingSource=null; updateTrackUI(t);
}

function alignedStart(){
  const bar = (60 / +$('#bpm').value) * 4;
  if (!transportRunning) return ctx.currentTime + .05;
  const elapsed = Math.max(0,ctx.currentTime-transportStart);
  return transportStart + Math.ceil(elapsed/bar)*bar;
}

function startTrack(t, when=ctx.currentTime+.05){
  if(!t.buffer || !ctx) return;
  if(t.playingSource){ try{t.playingSource.stop()}catch{} }
  const s=ctx.createBufferSource(); s.buffer=t.buffer; s.loop=true; s.connect(t.gain); s.start(when); t.playingSource=s;
}

function stopTracks(){ trackState.forEach(t=>{ if(t.playingSource){ try{t.playingSource.stop()}catch{} t.playingSource=null; } }); }

async function toggleTransport(){
  await initAudio();
  transportRunning=!transportRunning;
  if(transportRunning){
    transportStart=ctx.currentTime+.08; trackState.forEach(t=>startTrack(t,transportStart));
    $('#transportBtn').textContent='■ Stop';
    startScheduler();
  } else {
    stopTracks(); $('#transportBtn').textContent='▶ Play';
    if(!beatRunning) stopScheduler();
  }
}

function stepDuration(){ return 60 / +$('#bpm').value / 4; }
function startScheduler(){
  if(!ctx) return;
  if(!schedulerTimer){ currentStep=0; nextStepTime=ctx.currentTime+.06; schedulerTimer=setInterval(scheduleAhead,25); }
}
function stopScheduler(){ if(schedulerTimer){ clearInterval(schedulerTimer); schedulerTimer=null; clearStepHighlight(); } }
function scheduleAhead(){
  while(nextStepTime < ctx.currentTime+.12){
    scheduleStep(currentStep,nextStepTime);
    const swing=+$('#swing').value/100;
    nextStepTime += stepDuration() * (currentStep%2 ? 1+swing : 1-swing);
    currentStep=(currentStep+1)%16;
  }
}
function scheduleStep(step,time){
  if(beatRunning){ if(pattern.kick[step]) kick(time); if(pattern.snare[step]) snare(time); if(pattern.hat[step]) hat(time); }
  if($('#metronome').checked && step%4===0) click(time,step===0);
  const delay=Math.max(0,(time-ctx.currentTime)*1000); setTimeout(()=>highlightStep(step),delay);
}
function highlightStep(step){ clearStepHighlight(); $$(`.step[data-step="${step}"]`).forEach(x=>x.classList.add('playing')); }
function clearStepHighlight(){ $$('.step.playing').forEach(x=>x.classList.remove('playing')); }

function kick(time){
  const o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.setValueAtTime(140,time); o.frequency.exponentialRampToValueAtTime(48,time+.12); g.gain.setValueAtTime(1,time); g.gain.exponentialRampToValueAtTime(.001,time+.32); o.connect(g).connect(drumBus); o.start(time); o.stop(time+.35);
}
function snare(time){
  const len=ctx.sampleRate*.18, b=ctx.createBuffer(1,len,ctx.sampleRate), d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain(); s.buffer=b; f.type='highpass'; f.frequency.value=1200; g.gain.setValueAtTime(.55,time); g.gain.exponentialRampToValueAtTime(.001,time+.18); s.connect(f).connect(g).connect(drumBus); s.start(time);
}
function hat(time){
  const len=ctx.sampleRate*.05,b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(); s.buffer=b; f.type='highpass'; f.frequency.value=6500; g.gain.setValueAtTime(.22,time); g.gain.exponentialRampToValueAtTime(.001,time+.05); s.connect(f).connect(g).connect(drumBus); s.start(time);
}
function click(time,accent){ const o=ctx.createOscillator(),g=ctx.createGain(); o.frequency.value=accent?1200:850; g.gain.setValueAtTime(.18,time); g.gain.exponentialRampToValueAtTime(.001,time+.05); o.connect(g).connect(master);o.start(time);o.stop(time+.06); }

function loadBeat(style,variation=false){
  const base=beatPresets[style] || beatPresets.Pop;
  for(const lane of ['kick','snare','hat']) pattern[lane]=new Array(16).fill(false);
  for(const lane of ['kick','snare','hat']) base[lane].forEach(i=>pattern[lane][i]=true);
  if(variation){
    const density = style==='Trap' ? .22 : style==='Funk' ? .16 : .1;
    for(const lane of ['kick','snare','hat']) for(let i=0;i<16;i++) if(Math.random()<density) pattern[lane][i]=!pattern[lane][i];
    pattern.snare[4]=true; pattern.snare[12]=true;
  }
  renderSequencer();
}
function renderSequencer(){
  const lanes=[['kick','Kick'],['snare','Snare'],['hat','Hi-hat']];
  $('#sequencer').innerHTML=lanes.map(([lane,label])=>`<div class="step-label">${label}</div>${pattern[lane].map((on,i)=>`<button class="step ${on?'on':''}" data-lane="${lane}" data-step="${i}" aria-label="${label} step ${i+1}"></button>`).join('')}`).join('');
  $$('.step').forEach(b=>b.addEventListener('click',()=>{ const l=b.dataset.lane,i=+b.dataset.step; pattern[l][i]=!pattern[l][i]; b.classList.toggle('on',pattern[l][i]); }));
}

function midiToFreq(m){ return 440*Math.pow(2,(m-69)/12); }
function noteMidi(name,oct){ return (oct+1)*12 + notes.indexOf(name); }
function playNote(name,oct,velocity=.8,duration=null){
  if(!ctx) return null;
  const p=soundPresets[$('#soundPreset').value] || soundPresets['Grand-ish Piano'];
  const now=ctx.currentTime, midi=noteMidi(name,oct)+(p.detune||0)/100;
  const o=ctx.createOscillator(), g=ctx.createGain(), f=ctx.createBiquadFilter();
  o.type=p.wave; o.frequency.value=midiToFreq(midi); f.type='lowpass'; f.frequency.value=Math.min(+$('#tone').value,p.filter); f.Q.value=.5;
  g.gain.setValueAtTime(.0001,now); g.gain.exponentialRampToValueAtTime(Math.max(.001,velocity*.34),now+p.attack+.005);
  o.connect(f).connect(g).connect(synthBus); o.start(now);
  const release = duration ?? +$('#sustain').value;
  const stop=()=>{ const t=ctx.currentTime; try{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(Math.max(.0001,g.gain.value),t);g.gain.exponentialRampToValueAtTime(.0001,t+p.release+release*.25);o.stop(t+p.release+release*.25+.03);}catch{} };
  if(duration) setTimeout(stop,duration*1000);
  return {stop};
}

function renderKeyboard(){
  const oct=+$('#octave').value;
  $('#keyboard').innerHTML=whiteNotes.map((n,i)=>`<button class="white-key" data-note="${n}" data-oct="${oct+(i>6?1:0)}">${n}${oct+(i>6?1:0)}</button>`).join('') + blackLayout.map(([i,n])=>{
    const left=((i+1)/14*100)-3.5; const o=oct+(i>6?1:0); return `<button class="black-key" style="left:${left}%" data-note="${n}" data-oct="${o}">${n}</button>`;
  }).join('');
  bindKeys();
}
function bindKeys(){
  $$('#keyboard button').forEach(k=>{
    let voice=null;
    const down=async e=>{e.preventDefault();await initAudio();if(voice)return;k.classList.add('active');voice=playNote(k.dataset.note,+k.dataset.oct);};
    const up=e=>{e.preventDefault();k.classList.remove('active');voice?.stop();voice=null;};
    k.addEventListener('pointerdown',down); k.addEventListener('pointerup',up); k.addEventListener('pointercancel',up); k.addEventListener('pointerleave',e=>{if(e.buttons)up(e)});
  });
}

function chordIntervals(flavor,quality){
  if(flavor==='sus2') return [0,2,7]; if(flavor==='sus4') return [0,5,7]; if(flavor==='6') return quality==='minor'?[0,3,7,9]:[0,4,7,9];
  const triad=quality==='minor'?[0,3,7]:quality==='dim'?[0,3,6]:[0,4,7];
  if(flavor==='triad') return triad;
  if(flavor==='maj7') return [...triad,11]; if(flavor==='m7') return [0,3,7,10];
  if(flavor==='7') return [...triad,quality==='major'?10:quality==='dim'?9:10];
  if(flavor==='9') return [...triad,10,14]; if(flavor==='maj9') return [...triad,11,14]; if(flavor==='m9') return [0,3,7,10,14];
  if(flavor==='11') return [...triad,10,14,17]; if(flavor==='13') return [...triad,10,14,17,21]; return triad;
}
function renderChords(){
  const root=notes.indexOf($('#songKey').value), scale=[0,2,4,5,7,9,11], qualities=['major','minor','minor','major','major','minor','dim'];
  const romans=['I','ii','iii','IV','V','vi','vii°'];
  $('#chords').innerHTML=scale.map((semi,i)=>{const n=notes[(root+semi)%12],q=qualities[i];return `<button class="chord" data-root="${n}" data-quality="${q}">${n}${q==='minor'?'m':q==='dim'?'°':''}<span>${romans[i]}</span></button>`}).join('');
  $$('.chord').forEach(b=>b.addEventListener('pointerdown',async e=>{e.preventDefault();await initAudio();playChord(b.dataset.root,b.dataset.quality);}));
}
function playChord(root,quality){
  const flavor=$('#chordFlavor').value, base=notes.indexOf(root), oct=+$('#octave').value;
  chordIntervals(flavor,quality).forEach((semi,i)=>{ const idx=base+semi, n=notes[idx%12], o=oct+Math.floor(idx/12); setTimeout(()=>playNote(n,o,.72,Math.max(.25,+$('#sustain').value)),i*10); });
}

function openDB(){
  return new Promise((resolve,reject)=>{ const r=indexedDB.open('musicandbeats',1); r.onupgradeneeded=()=>r.result.createObjectStore('projects'); r.onsuccess=()=>{db=r.result;resolve(db)}; r.onerror=()=>reject(r.error); });
}
async function saveProject(){
  if(!db) await openDB();
  const project={ bpm:+$('#bpm').value,swing:+$('#swing').value,style:$('#beatStyle').value,pattern,tracks:trackState.map(t=>({source:t.source,blob:t.blob||null})) };
  await new Promise((resolve,reject)=>{ const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(project,'last');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error); });
  $('#status').textContent='Project saved on this iPad';
}
async function loadProject(){
  if(!db) await openDB();
  const p=await new Promise(resolve=>{ const tx=db.transaction('projects');const r=tx.objectStore('projects').get('last');r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null); });
  if(!p)return;
  $('#bpm').value=p.bpm||100; $('#swing').value=p.swing||8; $('#swingValue').textContent=`${$('#swing').value}%`; $('#beatStyle').value=p.style||'Worship'; pattern=p.pattern||pattern; renderSequencer();
  p.tracks?.forEach((saved,i)=>{ trackState[i].source=saved.source||trackState[i].source; trackState[i].blob=saved.blob||null; });
  renderTracks();
  if(ctx) await decodeSavedTracks();
  $('#status').textContent='Saved project restored';
}
async function decodeSavedTracks(){
  for(const t of trackState){ if(t.blob && !t.buffer){ try{t.buffer=await ctx.decodeAudioData((await t.blob.arrayBuffer()).slice(0));updateTrackUI(t)}catch{} } }
}

function setupSelectors(){
  $('#soundPreset').innerHTML=Object.keys(soundPresets).map(n=>`<option>${n}</option>`).join('');
  $('#songKey').innerHTML=notes.map(n=>`<option>${n}</option>`).join(''); $('#songKey').value='C';
}

$('#audioBtn').addEventListener('click',async()=>{await initAudio();await decodeSavedTracks();});
$('#transportBtn').addEventListener('click',toggleTransport);
$('#refreshInputs').addEventListener('click',async()=>{await initAudio();await refreshInputs();});
$('#inputDevice').addEventListener('change',e=>connectInput(e.target.value));
$('#monitorInput').addEventListener('change',routeMonitor);
$('#swing').addEventListener('input',e=>$('#swingValue').textContent=`${e.target.value}%`);
$('#beatStyle').addEventListener('change',e=>loadBeat(e.target.value,false));
$('#generateBeat').addEventListener('click',()=>loadBeat($('#beatStyle').value,true));
$('#beatToggle').addEventListener('click',async()=>{await initAudio();beatRunning=!beatRunning;$('#beatToggle').textContent=beatRunning?'■ Beats':'▶ Beats';if(beatRunning)startScheduler();else if(!transportRunning)stopScheduler();});
$('#octave').addEventListener('change',renderKeyboard);
$('#songKey').addEventListener('change',renderChords);
$('#chordFlavor').addEventListener('change',renderChords);
$('#saveBtn').addEventListener('click',saveProject);
$('#clearAll').addEventListener('click',()=>trackState.forEach(clearTrack));

setupSelectors(); renderTracks(); renderKeyboard(); renderChords(); loadBeat('Worship'); openDB().then(loadProject).catch(()=>{});
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
