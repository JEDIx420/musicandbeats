// V4 refinement layer: safer touch behavior, better input gain, robust note release,
// expression controls, and record-mode ergonomics without replacing the V3 workflow.

const V4 = {
  velocity: 0.84,
  sustain: 1.0,
  tone: 1.0,
  space: 0.16,
  inputDb: 6,
  autoLevel: true,
  meterRaf: null,
  analyser: null,
  analyserSink: null,
  analyserData: null,
  bassBus: null,
};

function v4DbToGain(db){ return Math.pow(10, db / 20); }
function v4Pct(v){ return `${Math.round(v * 100)}%`; }

// ---------- Touch / selection stability ----------

document.addEventListener('dblclick', e => {
  if(!e.target.closest('input,select,textarea')) e.preventDefault();
}, { capture:true });

document.addEventListener('selectstart', e => {
  if(!e.target.closest('input,select,textarea')) e.preventDefault();
}, { capture:true });

document.addEventListener('dragstart', e => {
  if(!e.target.closest('input,select,textarea')) e.preventDefault();
}, { capture:true });

// Old WebKit gesture events can still appear on installed PWAs.
['gesturestart','gesturechange','gestureend'].forEach(type => {
  document.addEventListener(type, e => e.preventDefault(), { passive:false, capture:true });
});

function v4ReleasePointer(pointerId){
  const held = pointerVoices.get(pointerId);
  if(held){
    try{ held.key?.classList.remove('active'); }catch{}
    try{ held.voice?.stop(); }catch{}
    pointerVoices.delete(pointerId);
  }
  const chord = chordVoices.get(pointerId);
  if(chord){
    try{ chord.forEach(v => v.stop()); }catch{}
    chordVoices.delete(pointerId);
    $$('.chord-pad.active').forEach(el => el.classList.remove('active'));
  }
}

['pointerup','pointercancel'].forEach(type => {
  document.addEventListener(type, e => v4ReleasePointer(e.pointerId), { capture:true });
});
window.addEventListener('blur', () => panic());
document.addEventListener('visibilitychange', () => { if(document.hidden) panic(); });
window.addEventListener('pagehide', () => panic());

// ---------- Audio buses / expression ----------

function v4EnsureBassBus(){
  if(!ctx || V4.bassBus) return V4.bassBus;
  V4.bassBus = ctx.createGain();
  V4.bassBus.gain.value = 0.92;
  V4.bassBus.connect(master);
  return V4.bassBus;
}

function v4SetSpace(value){
  V4.space = clamp(value, 0, .45);
  if(reverbWet && ctx) reverbWet.gain.setTargetAtTime(V4.space, ctx.currentTime, .02);
}

// Replace voice creation with a version that keeps the good V3 polyphony,
// but gives us explicit velocity, sustain/release and bass-specific cleanup.
startVoice = function(midi, preset='Studio Grand', velocity=.86){
  primeAudio();
  const s = SOUND_PRESETS[preset] || SOUND_PRESETS['Studio Grand'];
  const isBass = preset === 'Sub Bass';
  const now = ctx.currentTime;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  const effectiveVelocity = clamp(velocity * V4.velocity, .05, 1);
  const toneCutoff = clamp(s.filter * V4.tone, 500, 14000);

  f.type = 'lowpass';
  f.frequency.setValueAtTime(toneCutoff, now);
  f.Q.value = s.q || .3;
  g.gain.setValueAtTime(.0001, now);
  g.gain.exponentialRampToValueAtTime(Math.max(.001, s.gain * effectiveVelocity), now + s.attack + .004);
  g.gain.exponentialRampToValueAtTime(Math.max(.001, s.gain * s.sustain * effectiveVelocity), now + s.attack + s.decay + .01);

  if(isBass) f.connect(g).connect(v4EnsureBassBus());
  else f.connect(g).connect(synthBus);

  const oscillators = s.oscs.map(([type, semi, level]) => {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = midiToFreq(midi + semi);
    og.gain.value = level;
    o.connect(og).connect(f);
    o.start(now);
    return o;
  });

  let stopped = false;
  const voice = {
    stop(){
      if(stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      // Bass gets a deliberately tight release and never enters the shared reverb.
      const release = isBass ? Math.min(.13, Math.max(.055, s.release * .55 * V4.sustain)) : clamp(s.release * V4.sustain, .06, 3.2);
      try{
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(.0001, g.gain.value), t);
        g.gain.exponentialRampToValueAtTime(.0001, t + release);
        oscillators.forEach(o => o.stop(t + release + .035));
      }catch{}
      activeVoices.delete(voice);
      updateVoiceBadges();
    }
  };
  activeVoices.add(voice);
  updateVoiceBadges();
  return voice;
};

// Bass recordings need the dry bass bus, not the shared synth/reverb bus.
const v3GetLayerBus = getLayerBus;
getLayerBus = function(layer){
  if(layer?.source === 'bass') return v4EnsureBassBus();
  return v3GetLayerBus(layer);
};

// Give exact loops a tiny edge fade to avoid clicks / residual sample edges.
const v3ExactLoopBuffer = exactLoopBuffer;
exactLoopBuffer = function(source, targetSeconds){
  const out = v3ExactLoopBuffer(source, targetSeconds);
  const fadeSamples = Math.min(Math.floor(ctx.sampleRate * .012), Math.floor(out.length / 6));
  if(fadeSamples > 1){
    for(let c=0;c<out.numberOfChannels;c++){
      const d = out.getChannelData(c);
      for(let i=0;i<fadeSamples;i++){
        const x = i / fadeSamples;
        d[i] *= x;
        d[d.length - 1 - i] *= x;
      }
    }
  }
  return out;
};

// ---------- Input gain / auto level / metering ----------

function v4ApplyInputGain(){
  if(!ctx || !inputGain) return;
  const gain = v4DbToGain(V4.inputDb);
  inputGain.gain.setTargetAtTime(gain, ctx.currentTime, .025);
}

function v4EnsureMeter(){
  if(!ctx || !inputGain) return;
  if(!V4.analyser){
    V4.analyser = ctx.createAnalyser();
    V4.analyser.fftSize = 256;
    V4.analyser.smoothingTimeConstant = .72;
    V4.analyserData = new Float32Array(V4.analyser.fftSize);
    V4.analyserSink = ctx.createGain();
    V4.analyserSink.gain.value = 0;
    inputGain.connect(V4.analyser);
    V4.analyser.connect(V4.analyserSink).connect(master);
  }
}

function v4RunMeter(){
  if(V4.meterRaf) cancelAnimationFrame(V4.meterRaf);
  const tick = () => {
    const bar = $('.v4-meter > i');
    if(V4.analyser && bar){
      V4.analyser.getFloatTimeDomainData(V4.analyserData);
      let sum = 0;
      for(let i=0;i<V4.analyserData.length;i++) sum += V4.analyserData[i] * V4.analyserData[i];
      const rms = Math.sqrt(sum / V4.analyserData.length);
      const db = rms > 0 ? 20 * Math.log10(rms) : -80;
      const normalized = clamp((db + 55) / 55, 0, 1);
      bar.style.width = `${normalized * 100}%`;
    }
    V4.meterRaf = requestAnimationFrame(tick);
  };
  tick();
}

async function v4SetupInputDevice(deviceId=''){
  await ensureAudio();
  if(!navigator.mediaDevices?.getUserMedia) return false;
  try{
    if(micSource) try{ micSource.disconnect(); }catch{}
    if(micStream) micStream.getTracks().forEach(t => t.stop());

    const supported = navigator.mediaDevices.getSupportedConstraints?.() || {};
    const audio = {
      echoCancellation:false,
      noiseSuppression:false,
    };
    if(supported.autoGainControl) audio.autoGainControl = !!V4.autoLevel;
    if(deviceId) audio.deviceId = { exact:deviceId };

    micStream = await navigator.mediaDevices.getUserMedia({ audio });
    micSource = ctx.createMediaStreamSource(micStream);
    micSource.connect(inputGain);
    v4ApplyInputGain();
    v4EnsureMeter();
    v4RunMeter();
    return true;
  }catch(err){
    console.warn(err);
    return false;
  }
}

setupInput = async function(){ return v4SetupInputDevice(''); };
setupInputDevice = v4SetupInputDevice;

function v4InputControls(){
  const box = $('#layerSourceTools .input-connect-box');
  if(!box || box.querySelector('.v4-input-gain')) return;

  const row = document.createElement('div');
  row.className = 'v4-input-gain';
  row.innerHTML = `
    <label class="gain-control">
      <span>Input gain</span><output id="v4InputGainValue">+${V4.inputDb} dB</output>
      <input id="v4InputGain" type="range" min="0" max="18" step="1" value="${V4.inputDb}" />
    </label>
    <div class="v4-meter-wrap"><span>Input level</span><div class="v4-meter"><i></i></div></div>
    <label class="v4-auto-level"><input id="v4AutoLevel" type="checkbox" ${V4.autoLevel?'checked':''}/> Auto level</label>`;
  box.appendChild(row);

  $('#v4InputGain').addEventListener('input', e => {
    V4.inputDb = +e.target.value;
    $('#v4InputGainValue').textContent = `${V4.inputDb > 0 ? '+' : ''}${V4.inputDb} dB`;
    v4ApplyInputGain();
  });
  $('#v4AutoLevel').addEventListener('change', e => {
    V4.autoLevel = e.target.checked;
    const select = $('#recordInputDevice');
    if(micStream) v4SetupInputDevice(select?.value || '').then(ok => {
      const b = $('#connectRecordInput'); if(b) b.textContent = ok ? 'Input ready ✓' : 'Try again';
    });
  });

  v4ApplyInputGain();
  if(micStream){ v4EnsureMeter(); v4RunMeter(); }
}

// ---------- Expression controls ----------

function v4ExpressionMarkup(compact=false){
  return `<div class="v4-expression ${compact?'compact':''}">
    <label><span>Velocity</span><output data-exp-out="velocity">${v4Pct(V4.velocity)}</output><input data-exp="velocity" type="range" min="0.3" max="1" step="0.01" value="${V4.velocity}" /></label>
    <label><span>Sustain</span><output data-exp-out="sustain">${V4.sustain.toFixed(1)}×</output><input data-exp="sustain" type="range" min="0.35" max="2.5" step="0.05" value="${V4.sustain}" /></label>
    <label><span>Tone</span><output data-exp-out="tone">${v4Pct(V4.tone)}</output><input data-exp="tone" type="range" min="0.55" max="1.4" step="0.01" value="${V4.tone}" /></label>
    <label><span>Space</span><output data-exp-out="space">${Math.round(V4.space*100)}%</output><input data-exp="space" type="range" min="0" max="0.45" step="0.01" value="${V4.space}" /></label>
  </div>`;
}

function v4BindExpression(root){
  root.querySelectorAll('[data-exp]').forEach(input => input.addEventListener('input', e => {
    const key = e.target.dataset.exp;
    const value = +e.target.value;
    if(key === 'velocity') V4.velocity = value;
    if(key === 'sustain') V4.sustain = value;
    if(key === 'tone') V4.tone = value;
    if(key === 'space') v4SetSpace(value);
    const out = root.querySelector(`[data-exp-out="${key}"]`);
    if(out){
      if(key === 'velocity' || key === 'tone') out.textContent = v4Pct(value);
      else if(key === 'sustain') out.textContent = `${value.toFixed(1)}×`;
      else out.textContent = `${Math.round(value*100)}%`;
    }
  }));
}

function v4EnhancePlayExpression(){
  const panel = $('#playScreen .instrument-panel');
  if(!panel || panel.querySelector('.v4-expression')) return;
  const tabs = panel.querySelector('.instrument-tabs');
  if(!tabs) return;
  tabs.insertAdjacentHTML('afterend', v4ExpressionMarkup(false));
  v4BindExpression(panel.querySelector('.v4-expression'));
}

function v4EnhanceRecordExpression(){
  const tool = $('#layerSourceTools .tool-box');
  const layer = typeof sessionLayer === 'function' ? sessionLayer() : null;
  if(!tool || !layer || !['keys','chords','bass'].includes(layer.source) || tool.querySelector('.v4-expression')) return;

  // Bass should stay clean and tight by default.
  if(layer.source === 'bass') v4SetSpace(0);
  tool.insertAdjacentHTML('beforeend', v4ExpressionMarkup(true));
  v4BindExpression(tool.querySelector('.v4-expression'));
}

// ---------- Record control clarity ----------

function v4SyncRecordButton(){
  const b = $('#recordLayerBtn');
  if(!b) return;
  const label = b.querySelector('strong');
  if(b.classList.contains('recording')){
    if(label) label.textContent = 'Recording…';
    b.setAttribute('aria-label','Recording current layer');
  }else if(b.classList.contains('counting')){
    if(label) label.textContent = 'Get ready';
    b.setAttribute('aria-label','Count-in before recording');
  }else{
    if(label) label.textContent = 'Record layer';
    b.setAttribute('aria-label','Record current layer');
  }
  const redo = $('#redoLayerBtn'); if(redo) redo.textContent = 'Record again';
  const clear = $('#clearLayerBtn'); if(clear) clear.textContent = 'Clear layer';
}

const recordButtonObserver = new MutationObserver(v4SyncRecordButton);
if($('#recordLayerBtn')) recordButtonObserver.observe($('#recordLayerBtn'), { attributes:true, attributeFilter:['class','disabled'] });

// A changing source tool is the right moment to enhance input/expression controls.
const v4ToolObserver = new MutationObserver(() => {
  requestAnimationFrame(() => {
    v4InputControls();
    v4EnhanceRecordExpression();
    v4SyncRecordButton();
  });
});
if($('#layerSourceTools')) v4ToolObserver.observe($('#layerSourceTools'), { childList:true, subtree:true });

// Keep expression state sensible when switching instrument tabs.
$$('.instrument-tab').forEach(tab => tab.addEventListener('click', () => {
  if(tab.dataset.instrument === 'bass') v4SetSpace(0);
  else if(V4.space === 0) v4SetSpace(.16);
}));

v4EnhancePlayExpression();
v4SyncRecordButton();
v4SetSpace(V4.space);
