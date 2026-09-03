/* Music & Beats V13 — transport hard stop.
   Stop Session must silence every owned layer source and live synth voice immediately. */

/* ---------- Track every AudioBufferSourceNode owned by a layer ---------- */
function v13SourceSet(layer){
  if(!layer._playingSources)layer._playingSources=new Set();
  return layer._playingSources;
}

startSingleLayer=function(layer,time=null){
  if(!ctx||!layer?.buffer)return null;
  ensureLayerGain(layer);
  stopLayerSource(layer);
  const source=ctx.createBufferSource();
  source.buffer=layer.buffer;
  source.loop=true;
  source.playbackRate.value=layerPlaybackRate(layer);
  source.connect(layer.gain);
  const owned=v13SourceSet(layer);
  owned.add(source);
  layer.playingSource=source;
  source.onended=()=>{
    owned.delete(source);
    if(layer.playingSource===source)layer.playingSource=null;
    try{source.disconnect()}catch{}
  };
  source.start(time??ctx.currentTime+.04);
  return source;
};

stopLayerSource=function(layer){
  if(!layer)return;
  const all=new Set();
  if(layer.playingSource)all.add(layer.playingSource);
  layer._playingSources?.forEach(source=>all.add(source));
  all.forEach(source=>{
    try{source.stop(0)}catch{}
    try{source.disconnect()}catch{}
  });
  layer._playingSources?.clear();
  layer.playingSource=null;
};

/* ---------- Preserve normal musical releases, but expose a true hard stop ---------- */
startVoice=function(m,p='Studio Grand',v=.86){
  primeAudio();
  const s=SOUND_PRESETS[p]||SOUND_PRESETS['Studio Grand'],x=v4Expr(),now=ctx.currentTime;
  if(reverbWet)reverbWet.gain.setTargetAtTime(x.space,now,.02);
  const g=ctx.createGain(),f=ctx.createBiquadFilter();
  f.type='lowpass';f.frequency.value=Math.min(16000,Math.max(500,x.tone||s.filter));f.Q.value=s.q||.3;
  const velocity=clamp((v||.86)*(x.velocity||.78),.03,1.25),peak=Math.max(.001,s.gain*velocity);
  g.gain.setValueAtTime(.0001,now);
  g.gain.exponentialRampToValueAtTime(peak,now+s.attack+.004);
  g.gain.exponentialRampToValueAtTime(Math.max(.001,peak*s.sustain),now+s.attack+s.decay+.01);
  f.connect(g).connect(synthBus);
  const os=s.oscs.map(([type,semi,lev])=>{
    const o=ctx.createOscillator(),og=ctx.createGain();
    o.type=type;o.frequency.value=midiToFreq(m+semi);og.gain.value=lev;
    o.connect(og).connect(f);o.start(now);return o;
  });
  let stopped=false;
  const release=Math.max(.04,(x.sustain||.8)*.72+s.release*.35);
  const voice={
    stop(){
      if(stopped)return;stopped=true;
      const t=ctx.currentTime;
      try{
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(.0001,g.gain.value),t);
        g.gain.exponentialRampToValueAtTime(.0001,t+release);
        os.forEach(o=>o.stop(t+release+.04));
      }catch{}
      activeVoices.delete(voice);updateVoiceBadges();
    },
    hardStop(){
      if(stopped)return;stopped=true;
      const t=ctx.currentTime;
      try{
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(Math.max(.0001,g.gain.value),t);
        g.gain.linearRampToValueAtTime(0,t+.006);
        os.forEach(o=>o.stop(t+.012));
      }catch{}
      activeVoices.delete(voice);updateVoiceBadges();
    }
  };
  activeVoices.add(voice);updateVoiceBadges();return voice;
};

function v13HardStopVoice(voice){
  try{if(typeof voice?.hardStop==='function')voice.hardStop();else voice?.stop?.()}catch{}
}
function v13HardStopLivePerformance(){
  /* Stop arpeggiator scheduling first so it cannot create another note after the transport stops. */
  try{if(typeof v7HardStopArp==='function')v7HardStopArp();else if(typeof v6StopArp==='function')v6StopArp('immediate')}catch{}

  pointerVoices.forEach(hit=>v13HardStopVoice(hit?.voice));
  pointerVoices.clear();
  chordVoices.forEach(voices=>voices?.forEach(v13HardStopVoice));
  chordVoices.clear();
  if(typeof v5NumberChordVoices!=='undefined'){
    v5NumberChordVoices.forEach(hit=>hit?.voices?.forEach(v13HardStopVoice));
    v5NumberChordVoices.clear();
  }
  [...activeVoices].forEach(v13HardStopVoice);
  $$('.piano-key.active,.chord-pad.active,.chord-pad.keyboard-active,.chord-pad.arp-active').forEach(el=>el.classList.remove('active','keyboard-active','arp-active'));

  /* Flush any already-generated convolution tail as part of the explicit transport stop. */
  try{if(reverbNode&&ctx)reverbNode.buffer=createImpulse()}catch{}
  updateVoiceBadges();
}

/* ---------- Stop Session is now a true transport stop ---------- */
stopSession=function(){
  sessionPlaying=false;
  session.layers.forEach(stopLayerSource);
  v13HardStopLivePerformance();
  const button=$('#playSessionBtn');
  if(button){button.classList.remove('active');button.textContent='▶ Play session'}
};
