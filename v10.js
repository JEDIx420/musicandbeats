/* Music & Beats V10 — stronger vocal/input capture with preamp, metering and safe normalization. */
let v10InputNodes=null,v10MeterRAF=0,v10MonitorConnected=false;
const V10_DEFAULT_INPUT={gainDb:9,autoLevel:true,lastNormalizeDb:0};

function v10DbToGain(db){return Math.pow(10,db/20)}
function v10InputSettings(layer=session.layers?.length?sessionLayer():null){
  if(!layer)return {...V10_DEFAULT_INPUT};
  if(!layer.inputSettings)layer.inputSettings={...V10_DEFAULT_INPUT};
  return layer.inputSettings;
}
function v10EnsureInputGraph(){
  buildAudio();if(v10InputNodes)return v10InputNodes;
  const n={};n.preamp=ctx.createGain();n.comp=ctx.createDynamicsCompressor();n.makeup=ctx.createGain();n.analyser=ctx.createAnalyser();n.analyser.fftSize=1024;n.bus=ctx.createGain();
  inputGain.connect(n.preamp);n.preamp.connect(n.comp).connect(n.makeup).connect(n.analyser).connect(n.bus);
  v10InputNodes=n;v10ApplyInputSettings();return n;
}
function v10ApplyInputSettings(layer=session.layers?.length?sessionLayer():null){
  if(!ctx)return;const n=v10EnsureInputGraph(),s=v10InputSettings(layer);const t=ctx.currentTime;
  n.preamp.gain.setTargetAtTime(v10DbToGain(clamp(s.gainDb??9,0,18)),t,.025);
  if(s.autoLevel){n.comp.threshold.setTargetAtTime(-24,t,.02);n.comp.knee.setTargetAtTime(18,t,.02);n.comp.ratio.setTargetAtTime(4,t,.02);n.comp.attack.setTargetAtTime(.004,t,.02);n.comp.release.setTargetAtTime(.18,t,.02);n.makeup.gain.setTargetAtTime(1.38,t,.025)}
  else{n.comp.threshold.setTargetAtTime(0,t,.02);n.comp.knee.setTargetAtTime(0,t,.02);n.comp.ratio.setTargetAtTime(1,t,.02);n.makeup.gain.setTargetAtTime(1,t,.025)}
}
function v10StartMeter(){
  cancelAnimationFrame(v10MeterRAF);if(!v10InputNodes)return;
  const data=new Float32Array(v10InputNodes.analyser.fftSize),tick=()=>{
    if(!v10InputNodes)return;v10InputNodes.analyser.getFloatTimeDomainData(data);let sum=0,peak=0;for(let i=0;i<data.length;i++){const x=data[i];sum+=x*x;peak=Math.max(peak,Math.abs(x))}
    const rms=Math.sqrt(sum/data.length),dbv=rms>1e-6?20*Math.log10(rms):-60,pct=clamp((dbv+54)/54,0,1)*100;
    $$('.v10-input-meter-fill').forEach(el=>{el.style.width=`${pct}%`;el.classList.toggle('hot',peak>.82);el.classList.toggle('clip',peak>.98)});
    $$('.v10-input-db').forEach(el=>el.textContent=`${Math.round(dbv)} dB`);
    $$('.v10-input-state').forEach(el=>{el.textContent=peak>.98?'Clipping — lower boost':rms>.11?'Strong signal':rms>.035?'Good level':rms>.012?'Signal detected':'Speak or play into the input';el.dataset.state=peak>.98?'clip':rms>.035?'good':'low'});
    v10MeterRAF=requestAnimationFrame(tick)
  };tick()
}
function v10SetMonitor(on){
  if(!ctx)return;const n=v10EnsureInputGraph();
  try{if(v10MonitorConnected){n.bus.disconnect(master);v10MonitorConnected=false}}catch{}
  if(on){n.bus.connect(master);v10MonitorConnected=true}
}

const v10BaseSetupInput=setupInput;
setupInput=async function(){const ok=await v10BaseSetupInput();if(ok){v10EnsureInputGraph();v10ApplyInputSettings();v10StartMeter()}return ok};
if(typeof setupInputDevice==='function'){
  const v10BaseSetupInputDevice=setupInputDevice;
  setupInputDevice=async function(deviceId=''){const ok=await v10BaseSetupInputDevice(deviceId);if(ok){v10EnsureInputGraph();v10ApplyInputSettings();v10StartMeter()}return ok};
}
const v10BaseGetLayerBus=getLayerBus;
getLayerBus=function(layer){if(layer?.source==='input'){v10EnsureInputGraph();v10ApplyInputSettings(layer);return v10InputNodes.bus}return v10BaseGetLayerBus(layer)};

function v10NormalizeInputBuffer(buffer,layer){
  if(!buffer||!layer||layer.source!=='input'||!v10InputSettings(layer).autoLevel)return buffer;
  let peak=0,sum=0,count=0;const stride=Math.max(1,Math.floor(buffer.length/350000));
  for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i+=stride){const x=d[i];peak=Math.max(peak,Math.abs(x));sum+=x*x;count++}}
  if(peak<.0005||!count)return buffer;const rms=Math.sqrt(sum/count),peakGain=.92/peak,rmsGain=rms>.0005?.18/rms:4;let gain;
  if(peak>.92)gain=peakGain;else gain=Math.max(1,Math.min(4,peakGain,rmsGain));
  const db=20*Math.log10(Math.max(.0001,gain));v10InputSettings(layer).lastNormalizeDb=Math.round(db*10)/10;
  if(Math.abs(gain-1)<.01)return buffer;
  for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=clamp(d[i]*gain,-.98,.98)}
  return buffer;
}
if(typeof v4MakeAudioBuffer==='function'){
  const v10BaseMakeAudioBuffer=v4MakeAudioBuffer;
  v4MakeAudioBuffer=function(channelBuffers,frames){const b=v10BaseMakeAudioBuffer(channelBuffers,frames),l=session.layers?.length?sessionLayer():null;return v10NormalizeInputBuffer(b,l)};
}

function v10InputPanelMarkup(layer){const s=v10InputSettings(layer),norm=s.lastNormalizeDb||0;return `<div class="v10-input-strip"><div class="v10-input-meter"><div class="v10-input-meter-head"><span>INPUT LEVEL</span><strong class="v10-input-db">−60 dB</strong></div><div class="v10-input-meter-track"><i class="v10-input-meter-fill"></i></div><small class="v10-input-state">Connect the input to meter it</small></div><label class="v10-input-boost"><span>Input boost <b data-v10-boost-value>+${Math.round(s.gainDb??9)} dB</b></span><input data-v10-boost type="range" min="0" max="18" step="1" value="${s.gainDb??9}"></label><button class="v10-auto-level ${s.autoLevel?'active':''}" data-v10-auto type="button"><span>Auto Level</span><small>${s.autoLevel?'Compression + safe normalization':'Raw dynamics'}</small></button>${norm?`<div class="v10-last-level"><span>LAST TAKE</span><strong>${norm>=0?'+':''}${norm.toFixed(1)} dB</strong><small>normalization</small></div>`:''}</div>`}
function v10EnhanceInputTool(){
  if(currentScreen!=='record'||!session.layers?.length||sessionLayer().source!=='input')return;const box=$('#layerSourceTools .input-connect-box');if(!box)return;const layer=sessionLayer();box.classList.add('v10-input-connect');
  if(!box.querySelector('.v10-input-strip'))box.insertAdjacentHTML('beforeend',v10InputPanelMarkup(layer));
  const boost=box.querySelector('[data-v10-boost]'),out=box.querySelector('[data-v10-boost-value]'),auto=box.querySelector('[data-v10-auto]');
  if(boost&&!boost.dataset.bound){boost.dataset.bound='1';boost.addEventListener('input',()=>{const s=v10InputSettings(layer);s.gainDb=+boost.value;if(out)out.textContent=`+${Math.round(s.gainDb)} dB`;if(ctx)v10ApplyInputSettings(layer)})}
  if(auto&&!auto.dataset.bound){auto.dataset.bound='1';auto.addEventListener('click',()=>{const s=v10InputSettings(layer);s.autoLevel=!s.autoLevel;auto.classList.toggle('active',s.autoLevel);auto.querySelector('small').textContent=s.autoLevel?'Compression + safe normalization':'Raw dynamics';if(ctx)v10ApplyInputSettings(layer)})}
  const oldMon=$('#recordMonitor');if(oldMon&&oldMon.dataset.v10!=='1'){const fresh=oldMon.cloneNode(true);fresh.dataset.v10='1';oldMon.replaceWith(fresh);fresh.addEventListener('change',()=>v10SetMonitor(fresh.checked))}
  if(micStream&&ctx){v10EnsureInputGraph();v10ApplyInputSettings(layer);v10StartMeter()}
}
const v10BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){const out=v10BaseRenderLayerTools();setTimeout(v10EnhanceInputTool,30);return out};

if(typeof v7ProjectPayload==='function'){
  const v10BaseProjectPayload=v7ProjectPayload;
  v7ProjectPayload=function(name,id){const p=v10BaseProjectPayload(name,id);p.session.layers.forEach((saved,i)=>{if(session.layers[i]?.inputSettings)saved.inputSettings={...session.layers[i].inputSettings}});return p};
}

function v10Init(){if(currentScreen==='record')setTimeout(v10EnhanceInputTool,80)}
v10Init();
