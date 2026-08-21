/* Music & Beats V17 integration hardening. */

/* Make legacy V15 bass arp state forward-compatible with the full V17 engine. */
const v17BaseLayerArp=v17LayerArp;
v17LayerArp=function(layer,kind){
  const s=v17BaseLayerArp(layer,kind),defaults={...V17_ARP_DEFAULTS,pattern:[...V17_ARP_DEFAULTS.pattern]};
  for(const [k,v] of Object.entries(defaults))if(s[k]===undefined)s[k]=Array.isArray(v)?[...v]:v;
  if(!Array.isArray(s.pattern)||s.pattern.length!==8)s.pattern=[...V17_ARP_DEFAULTS.pattern];
  s.ratchet=clamp(+s.ratchet||1,1,4);s.offset=clamp(+s.offset||0,0,7);s.steps=clamp(+s.steps||0,0,4);s.distance=+s.distance||12;s.swing=clamp(+s.swing||0,0,70);s.gate=clamp(+s.gate||.62,.08,1.5);s.octaves=clamp(+s.octaves||1,1,4);
  return s;
};

/* 1/32 joins the existing tempo-synchronised rates. */
v6RateMs=function(){
  const bpm=v6Arp.target?.bpm||clamp(+($('#playBpm')?.value||session.bpm||100),40,220);
  return({'1/4':60000/bpm,'1/8':30000/bpm,'1/16':15000/bpm,'1/32':7500/bpm,'1/8T':20000/bpm})[v6Arp.rate]||30000/bpm;
};

/* Chord Pulse on Bass pulses the root/fifth/octave stack together. */
v17ArpStepNotes=function(target,seq,idx,transpose){
  if(v6Arp.mode==='chord'){
    if(target?.chord)return v6ChordNotes(target.chord,target.voicing||'close',target.octave).map(m=>m+transpose);
    if(target?.kind==='bass')return seq.slice(0,Math.min(3,seq.length)).map(m=>m+transpose);
  }
  const off=(idx+(+v6Arp.offset||0))%seq.length,m=v6Arp.mode==='random'?seq[Math.floor(Math.random()*seq.length)]:seq[off];return[m+transpose];
};

/* Drive OFF must be truly clean. */
v17DriveCurve=function(amount=0){
  const n=1024,c=new Float32Array(n);if(amount<=.001){for(let i=0;i<n;i++)c[i]=i*2/n-1;return c}
  const k=1+amount*55,norm=Math.tanh(k);for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=Math.tanh(x*k)/norm}return c;
};

/* Initialise the rack before precise recording connects its capture node, then
   capture the post-FX mix so pedal/knob movements are printed into Keys/Bass takes. */
function v17EnsureCaptureOut(){
  const n=v17EnsureSynthRack();if(n.out)return n.out;n.out=ctx.createGain();
  [n.dry,n.chorusWet,n.delayWet,n.reverbWet].forEach(node=>{try{node.disconnect(master)}catch{}node.connect(n.out)});n.out.connect(master);return n.out;
}
const v17BaseEnsureAudio=ensureAudio;
ensureAudio=async function(){const out=await v17BaseEnsureAudio();v17EnsureSynthRack();v17EnsureCaptureOut();return out};
const v17BaseGetLayerBus=getLayerBus;
getLayerBus=function(layer){if(layer?.source==='chords'||layer?.source==='bass'){v17EnsureSynthRack();return v17EnsureCaptureOut()}return v17BaseGetLayerBus(layer)};

/* Explicit Stop Session also kills V17 delay/reverb tails. */
if(typeof v13HardStopLivePerformance==='function'){
  const v17BaseHardStop=v13HardStopLivePerformance;
  v13HardStopLivePerformance=function(){
    const out=v17BaseHardStop.apply(this,arguments);if(v17SynthRack&&ctx){const n=v17SynthRack,t=ctx.currentTime;try{n.feedback.gain.cancelScheduledValues(t);n.feedback.gain.setValueAtTime(0,t);n.delayWet.gain.cancelScheduledValues(t);n.delayWet.gain.setValueAtTime(0,t);n.reverbWet.gain.cancelScheduledValues(t);n.reverbWet.gain.setValueAtTime(0,t);n.reverb.buffer=createImpulse();setTimeout(()=>{if(ctx)v17ApplyFx()},28)}catch{}}return out;
  };
}

/* V17 replaces the older V15 record bass arp module instead of stacking two modules. */
const v17BaseEnhanceRecordArp=v17EnhanceRecordArp;
v17EnhanceRecordArp=function(){
  if(currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='bass')$('#layerSourceTools [data-v15-record-arp]')?.remove();
  return v17BaseEnhanceRecordArp();
};

/* Restore V17 Play rack/arp metadata when a named project is opened. */
if(typeof v7OpenProject==='function'&&typeof v7StoreGet==='function'){
  const v17BaseOpenProject=v7OpenProject;
  v7OpenProject=async function(id){
    let data=null;try{data=await v7StoreGet(`project:${id}`)}catch{}
    const out=await v17BaseOpenProject(id);
    if(data?.v17PlayFx){Object.assign(V17_PLAY_FX,v6Clone(data.v17PlayFx));}
    if(data?.v17PlayArp){Object.assign(V17_PLAY_ARP,v17ArpStateCopy(data.v17PlayArp));V17_PLAY_ARP.pattern=[...(data.v17PlayArp.pattern||V17_ARP_DEFAULTS.pattern)]}
    requestAnimationFrame(()=>{v17Hardwareize();if(ctx)v17ApplyFx()});return out;
  };
}

/* Keep Play state coherent when moving between Smart Keys and Bass. */
document.querySelectorAll('#playScreen .instrument-tab').forEach(tab=>tab.addEventListener('click',()=>requestAnimationFrame(()=>{v17ApplyArpState(V17_PLAY_ARP);v17Hardwareize()})));
requestAnimationFrame(()=>{v17EnhanceRecordArp();v17Hardwareize()});