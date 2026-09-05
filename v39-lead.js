/* Music & Beats V39 lead — glide, pitch/mod strips, deep FX path and Western sample voices. */
(()=>{
const M=window.MB_V39,V37=window.MB_V37;if(!M||!V37||M.leadReady)return;M.leadReady=true;const {V38,state:S,clamp}=M,L=M.api.state,BASE='https://cdn.jsdelivr.net/gh/surikov/webaudiofontdata@master/sound/';
Object.assign(S,{leadPointers:new Map(),leadPending:new Map(),leadMidiVoices:new Map(),leadMidiPending:new Map(),scripts:new Map(),buffers:new WeakMap(),decodedBuffers:new WeakMap(),fxInput:null,fxOutput:null,fxNodes:[],fxLfos:[],sampleStatus:new Map()});
const curve=a=>{const n=2048,x=new Float32Array(n);for(let i=0;i<n;i++){const v=i*2/n-1;x[i]=(1+a)*v/(1+a*Math.abs(v))}return x};
function impulse(sec,dec){const r=ctx.sampleRate,n=Math.max(1,r*sec|0),b=ctx.createBuffer(2,n,r);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,dec)}return b}
function cleanFX(){for(const l of S.fxLfos){try{l.stop()}catch{}}S.fxLfos=[];for(const n of S.fxNodes){try{n.disconnect()}catch{}}S.fxNodes=[];S.fxInput=S.fxOutput=null}
function buildFX(){if(!ctx)return null;stopLead();cleanFX();const f=V38.state.fx||V38.FX_PRESETS.Studio,I=(+f.intensity||0)/100,W=(+f.wet||0)/100,input=ctx.createGain(),tone=ctx.createBiquadFilter(),drive=ctx.createWaveShaper();tone.type='lowpass';tone.frequency.value=1800+Math.pow((+f.tone||70)/100,1.5)*15000;tone.Q.value=.25;drive.curve=curve(f.drive==='Warm'?1.2:f.drive==='Crunch'?4:f.drive==='Fuzz'?12:0);drive.oversample='2x';input.connect(tone).connect(drive);let cur=drive;S.fxNodes.push(input,tone,drive);
if(f.mod==='Chorus'||f.mod==='Vibrato'){const dry=ctx.createGain(),del=ctx.createDelay(.06),wg=ctx.createGain(),sum=ctx.createGain(),lfo=ctx.createOscillator(),lg=ctx.createGain();dry.gain.value=f.mod==='Vibrato'?.18:.72;wg.gain.value=f.mod==='Vibrato'?.92:.48;del.delayTime.value=f.mod==='Vibrato'?.004:.014;lfo.frequency.value=f.mod==='Vibrato'?4.8:1.1;lg.gain.value=(f.mod==='Vibrato'?.0025:.006)*I;lfo.connect(lg).connect(del.delayTime);cur.connect(dry).connect(sum);cur.connect(del).connect(wg).connect(sum);lfo.start();S.fxLfos.push(lfo);S.fxNodes.push(dry,del,wg,sum,lg);cur=sum}else if(f.mod==='Tremolo'){const g=ctx.createGain(),l=ctx.createOscillator(),lg=ctx.createGain();g.gain.value=1-I*.35;l.frequency.value=3.2+I*4;lg.gain.value=I*.34;l.connect(lg).connect(g.gain);cur.connect(g);l.start();S.fxLfos.push(l);S.fxNodes.push(g,lg);cur=g}else if(f.mod==='Phaser'){const sum=ctx.createGain();let chain=cur;for(let i=0;i<4;i++){const a=ctx.createBiquadFilter();a.type='allpass';a.frequency.value=550+i*420;a.Q.value=1.1+I*4;chain.connect(a);chain=a;S.fxNodes.push(a)}const dry=ctx.createGain(),wg=ctx.createGain();dry.gain.value=.64;wg.gain.value=.58;cur.connect(dry).connect(sum);chain.connect(wg).connect(sum);S.fxNodes.push(sum,dry,wg);cur=sum}else if(f.mod==='Auto Wah'){const wah=ctx.createBiquadFilter(),l=ctx.createOscillator(),lg=ctx.createGain();wah.type='bandpass';wah.frequency.value=700+I*600;wah.Q.value=2.5+I*5;l.frequency.value=1.2+I*2.6;lg.gain.value=500+I*1600;l.connect(lg).connect(wah.frequency);cur.connect(wah);l.start();S.fxLfos.push(l);S.fxNodes.push(wah,lg);cur=wah}
const dd=ctx.createGain(),dw=ctx.createGain(),delay=ctx.createDelay(1.2),fb=ctx.createGain(),ds=ctx.createGain();dd.gain.value=1;dw.gain.value=f.delay==='Off'?0:Math.min(.72,W*.85+.08);delay.delayTime.value=f.delay==='Slap'?.09:f.delay==='Tape'?.29:f.delay==='Stereo'?.38:f.delay==='Ping Pong'?.46:.01;fb.gain.value=f.delay==='Off'?0:Math.min(.68,.18+I*.45);cur.connect(dd).connect(ds);cur.connect(delay);delay.connect(fb).connect(delay);let dout=delay;if((f.delay==='Stereo'||f.delay==='Ping Pong')&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=f.delay==='Ping Pong'?.72:.38;delay.connect(p);dout=p;S.fxNodes.push(p)}dout.connect(dw).connect(ds);S.fxNodes.push(dd,dw,delay,fb,ds);cur=ds;
const rd=ctx.createGain(),rw=ctx.createGain(),conv=ctx.createConvolver(),rs=ctx.createGain(),sec=f.space==='Room'?.7:f.space==='Plate'?1.3:f.space==='Hall'?2.4:f.space==='Cathedral'?4.2:.2,dec=f.space==='Cathedral'?3.2:f.space==='Hall'?2.8:2.2;conv.buffer=impulse(sec,dec);rd.gain.value=1;rw.gain.value=f.space==='Off'?0:Math.min(.78,W);cur.connect(rd).connect(rs);cur.connect(conv).connect(rw).connect(rs);S.fxNodes.push(rd,rw,conv,rs);cur=rs;
const hp=ctx.createBiquadFilter(),presence=ctx.createBiquadFilter(),comp=ctx.createDynamicsCompressor(),out=ctx.createGain();hp.type='highpass';hp.frequency.value=75;presence.type='peaking';presence.frequency.value=2700;presence.Q.value=.75;presence.gain.value=2.8;comp.threshold.value=-18;comp.knee.value=10;comp.ratio.value=3;comp.attack.value=.004;comp.release.value=.12;out.gain.value=V37.mix?.lead??1.1;const targetBus=(synthBus&&synthBus.context===ctx)?synthBus:ctx.destination;cur.connect(hp).connect(presence).connect(comp).connect(out).connect(targetBus);S.fxNodes.push(hp,presence,comp,out);S.fxInput=input;S.fxOutput=out;return input}
const dest=()=>!S.fxInput||S.fxInput.context!==ctx?buildFX():S.fxInput;

function loadSample(name){
  const spec=V38.SAMPLE_VOICES[name];if(!spec)return Promise.resolve(null);
  if(window[spec.variable])return Promise.resolve(window[spec.variable]);
  if(S.scripts.has(name))return S.scripts.get(name);
  const p=new Promise(resolve=>{
    const timer=setTimeout(()=>{S.scripts.delete(name);resolve(window[spec.variable]||null)},12000);
    const s=document.createElement('script');s.src=BASE+spec.file;s.crossOrigin='anonymous';
    s.onload=()=>{clearTimeout(timer);resolve(window[spec.variable]||null)};
    s.onerror=()=>{clearTimeout(timer);S.scripts.delete(name);resolve(null)};
    document.head.appendChild(s);
  });
  S.scripts.set(name,p);return p;
}
const zoneFor=(p,m)=>p?.zones?.find(z=>m>=z.keyRangeLow&&m<=z.keyRangeHigh)||p?.zones?.reduce((a,z)=>Math.abs(m-(z.keyRangeLow+z.keyRangeHigh)/2)<Math.abs(m-(a.keyRangeLow+a.keyRangeHigh)/2)?z:a,p?.zones?.[0]);
async function zoneBuffer(z){
  if(!z?.file)return null;
  if(S.decodedBuffers.has(z))return S.decodedBuffers.get(z);
  if(S.buffers.has(z))return S.buffers.get(z);
  if(!ctx&&typeof buildAudio==='function')buildAudio();
  if(!ctx)return null;
  try{
    const bytes=Uint8Array.from(atob(z.file),c=>c.charCodeAt(0)).buffer;
    const p=ctx.decodeAudioData(bytes.slice(0)).then(ab=>{
      if(ab)S.decodedBuffers.set(z,ab);
      return ab;
    }).catch(()=>null);
    S.buffers.set(z,p);return p;
  }catch(e){return null}
}

function updateStatusUI(name,statusText){
  if(V38.state.voice===name){
    const el=document.querySelector('#v38SampleStatus');
    if(el)el.textContent=statusText;
  }
}

async function preloadVoice(name,minMidi=36,maxMidi=84){
  if(!V38.SAMPLE_VOICES[name])return true;
  S.sampleStatus.set(name,'loading');
  updateStatusUI(name,`Loading ${name}…`);
  const t0=performance.now();
  const prog=await loadSample(name);
  if(!prog){
    S.sampleStatus.set(name,'error');
    updateStatusUI(name,`Could not load ${name} — using synth fallback`);
    return false;
  }
  if(!ctx&&typeof buildAudio==='function')buildAudio();
  if(ctx){
    const needed=new Set();
    for(let m=minMidi;m<=maxMidi;m+=3){
      const z=zoneFor(prog,m);
      if(z)needed.add(z);
    }
    await Promise.all([...needed].map(z=>zoneBuffer(z)));
  }
  S.sampleStatus.set(name,'ready');
  const dur=(performance.now()-t0).toFixed(0);
  updateStatusUI(name,`${name} ready · GeneralUser GS (${dur}ms)`);
  return true;
}

function isVoiceReady(name,midi=60){
  if(!V38.SAMPLE_VOICES[name])return true;
  const spec=V38.SAMPLE_VOICES[name];
  const prog=window[spec.variable];
  if(!prog)return false;
  const z=zoneFor(prog,midi);
  if(!z)return false;
  return S.decodedBuffers.has(z);
}

const sampleManager={loadSample,zoneFor,zoneBuffer,preloadVoice,isVoiceReady,status:S.sampleStatus,decodedBuffers:S.decodedBuffers,buffers:S.buffers};
M.sampleManager=sampleManager;
M.synthVoice=synthVoice;

const pitch=(v,vib=0)=>(v.currentMidi??v.midi)+S.pitchBend+vib;
async function sampleVoice(midi,name,outNode=null){
  const targetOut=outNode||dest();
  const prog=await loadSample(name),z=zoneFor(prog,midi),b=await zoneBuffer(z);
  if(!prog||!z||!b||!targetOut||!ctx)return null;
  const src=ctx.createBufferSource(),g=ctx.createGain(),now=ctx.currentTime;
  const base=(+z.originalPitch||6000)/100+(+z.coarseTune||0)+(+z.fineTune||0)/100;
  src.buffer=b;
  if(+z.loopStart>=0&&+z.loopEnd>+z.loopStart){
    src.loop=true;src.loopStart=z.loopStart/(z.sampleRate||b.sampleRate);src.loopEnd=z.loopEnd/(z.sampleRate||b.sampleRate);
  }
  g.gain.setValueAtTime(.0001,now);
  g.gain.exponentialRampToValueAtTime(.88,now+.008);
  src.connect(g).connect(targetOut);
  const v={midi,currentMidi:midi,stopped:false,apply(gl=.02,vib=0){
    if(v.stopped)return;const r=Math.pow(2,(pitch(v,vib)-base)/12),t=ctx.currentTime;
    try{src.playbackRate.cancelScheduledValues(t);src.playbackRate.setTargetAtTime(r,t,Math.max(.002,gl/3))}catch{}
  },setMidi(n,gl){v.currentMidi=n;v.apply(gl)},stop(){
    if(v.stopped)return;v.stopped=true;const t=ctx.currentTime;
    try{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.0001,t,.04);src.stop(t+.18)}catch{}
  }};
  v.apply(0);src.start(now,Math.max(0,+z.delay||0));return v;
}
function synthVoice(midi,name,outNode=null){
  const ac=outNode?.context||ctx;
  const targetOut=(outNode&&outNode.context===ac)?outNode:dest();
  const p=SOUND_PRESETS[name]||SOUND_PRESETS['Glass Lead']||SOUND_PRESETS['Studio Grand'];
  if(!targetOut||!ac)return null;
  const f=ac.createBiquadFilter(),g=ac.createGain(),now=ac.currentTime;
  f.type='lowpass';
  const baseCut=p.filter||7600;
  f.frequency.setValueAtTime(baseCut,now);
  f.Q.value=p.q||.7;
  const envMul=p.v17?.filterEnv||(p.filterEnv??1);
  if(envMul!==1){
    f.frequency.setValueAtTime(Math.min(16000,baseCut*envMul),now);
    f.frequency.exponentialRampToValueAtTime(Math.max(80,baseCut),now+Math.max(.04,(p.decay||.2)*.75));
  }
  const peak=(p.gain||.6)*.93;
  g.gain.setValueAtTime(.0001,now);
  g.gain.exponentialRampToValueAtTime(Math.max(.001,peak),now+Math.max(.002,p.attack||.01));
  g.gain.exponentialRampToValueAtTime(Math.max(.001,peak*(p.sustain??.72)),now+Math.max(.05,(p.attack||.01)+(p.decay||.12)));
  f.connect(g).connect(targetOut);
  const os=(p.oscs||[['sine',0,1,0]]).map(oscDef=>{
    const [type,semi,lev,cents=0]=oscDef;
    const o=ac.createOscillator(),og=ac.createGain();o.type=type;
    o.frequency.value=midiToFreq(midi+semi);
    if(cents)try{o.detune.setValueAtTime(cents,now)}catch{}
    og.gain.value=lev;
    o.connect(og).connect(f);o.start();return{o,semi,cents};
  });
  const v={midi,currentMidi:midi,stopped:false,apply(gl=.02,vib=0){
    if(v.stopped)return;const t=ac.currentTime,q=pitch(v,vib);
    for(const x of os){try{x.o.frequency.cancelScheduledValues(t);x.o.frequency.setTargetAtTime(midiToFreq(q+x.semi),t,Math.max(.002,gl/3))}catch{}}
  },setMidi(n,gl){v.currentMidi=n;v.apply(gl)},stop(){
    if(v.stopped)return;v.stopped=true;const t=ac.currentTime,r=Math.max(.05,Math.min(.45,p.release||.18));
    try{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.0001,t,r/3);os.forEach(x=>x.o.stop(t+r+.04))}catch{}
  }};
  v.apply(0);return v;
}
async function makeVoice(m,outNode=null){
  const name=V38.state.voice;
  if(V38.SAMPLE_VOICES[name]){
    const spec=V38.SAMPLE_VOICES[name];
    const ready=window[spec.variable]&&zoneFor(window[spec.variable],m)&&S.decodedBuffers.has(zoneFor(window[spec.variable],m));
    if(ready){
      const voice=await sampleVoice(m,name,outNode);
      if(voice)return voice;
    }
    // Zero-dead-air immediate compatible fallback while preloading in background
    preloadVoice(name,m-12,m+12);
    return synthVoice(m,'Glass Lead',outNode);
  }
  return synthVoice(m,name,outNode);
}
function duck(){if(!ctx)return;const on=S.leadPointers.size||S.leadPending.size||(S.leadMidiVoices?.size||0)||(S.leadMidiPending?.size||0);try{if(L.playbackBus?.gain){L.playbackBus.gain.cancelScheduledValues(ctx.currentTime);L.playbackBus.gain.setTargetAtTime(on?.90:1,ctx.currentTime,.025)}if(L.beatBus?.gain){L.beatBus.gain.cancelScheduledValues(ctx.currentTime);L.beatBus.gain.setTargetAtTime((V37.mix?.beats??.86)*(on?.88:1),ctx.currentTime,.025)}}catch{}}
function stopLead(){for(const h of S.leadPointers.values()){h.voice?.stop?.();h.key?.classList.remove('active')}S.leadPointers.clear();for(const h of (S.leadMidiVoices?.values()||[])){h.voice?.stop?.();h.key?.classList.remove('active')}S.leadMidiVoices?.clear();for(const p of S.leadPending.values())p.cancelled=true;S.leadPending.clear();for(const p of (S.leadMidiPending?.values()||[]))p.cancelled=true;S.leadMidiPending?.clear();S.pitchBend=0;duck();ui()}
async function startMidiLead(midi,vel=0.8){await ensureAudio();primeAudio();duck();const existing=S.leadMidiVoices.get(midi);if(existing){existing.voice?.stop?.();existing.key?.classList.remove('active');S.leadMidiVoices.delete(midi)}const key=document.querySelector(`#v38Keyboard .v38-key[data-midi="${midi}"]`);if(key)key.classList.add('active');const pending={cancelled:false,key,midi,vel};S.leadMidiPending.set(midi,pending);const voice=await makeVoice(midi);S.leadMidiPending.delete(midi);if(pending.cancelled||!voice){voice?.stop?.();if(key)key.classList.remove('active');duck();return null}const entry={voice,key,midi,vel};S.leadMidiVoices.set(midi,entry);duck();return entry}
function stopMidiLead(midi){const pending=S.leadMidiPending?.get(midi);if(pending){pending.cancelled=true;pending.key?.classList.remove('active');S.leadMidiPending.delete(midi)}const existing=S.leadMidiVoices.get(midi);if(!existing)return;existing.voice?.stop?.();existing.key?.classList.remove('active');S.leadMidiVoices.delete(midi);duck()}
async function down(e){const key=e.target.closest?.('#v38Keyboard .v38-key');if(!key)return;e.preventDefault();e.stopImmediatePropagation();const id=e.pointerId,midi=+key.dataset.midi,p={key,cancelled:false};S.leadPending.set(id,p);key.classList.add('active');duck();await ensureAudio();if(p.cancelled)return;primeAudio();const voice=await makeVoice(midi);S.leadPending.delete(id);if(p.cancelled||!voice||!key.isConnected){voice?.stop?.();key.classList.remove('active');duck();return}S.leadPointers.set(id,{voice,key,midi});try{key.setPointerCapture(id)}catch{}duck()}
const at=(x,y)=>document.elementsFromPoint?.(x,y)?.find(e=>e.classList?.contains('v38-key'))||null;
function move(e){const h=S.leadPointers.get(e.pointerId);if(!h||!S.slide)return;e.preventDefault();e.stopImmediatePropagation();const k=at(e.clientX,e.clientY);if(!k||k===h.key)return;const m=+k.dataset.midi;if(!Number.isFinite(m)||m===h.midi)return;h.key.classList.remove('active');k.classList.add('active');h.key=k;h.midi=m;h.voice.setMidi?.(m,S.glideMs/1000)}
function up(e){const p=S.leadPending.get(e.pointerId);if(p){e.preventDefault();e.stopImmediatePropagation();p.cancelled=true;S.leadPending.delete(e.pointerId);p.key?.classList.remove('active')}const h=S.leadPointers.get(e.pointerId);if(!h){duck();return}e.preventDefault();e.stopImmediatePropagation();h.voice?.stop?.();h.key?.classList.remove('active');S.leadPointers.delete(e.pointerId);duck()}
document.addEventListener('pointerdown',down,true);document.addEventListener('pointermove',move,true);['pointerup','pointercancel','lostpointercapture'].forEach(t=>document.addEventListener(t,up,true));
function applyPitch(){for(const h of [...S.leadPointers.values(),...(S.leadMidiVoices?.values()||[])])h.voice?.apply?.(.025)}function pitchFrom(e,el){const r=el.getBoundingClientRect();S.pitchBend=clamp(1-2*((e.clientY-r.top)/r.height),-1,1)*S.pitchRange;applyPitch();ui()}function modFrom(e,el){const r=el.getBoundingClientRect();S.mod=clamp(1-((e.clientY-r.top)/r.height),0,1);M.persist();ui()}
function bindStrip(){const p=document.querySelector('#v39PitchStrip'),m=document.querySelector('#v39ModStrip');if(!p||p.dataset.bound)return;p.dataset.bound=1;let a=null,b=null;p.onpointerdown=e=>{e.preventDefault();a=e.pointerId;p.setPointerCapture?.(a);pitchFrom(e,p)};p.onpointermove=e=>{if(e.pointerId===a)pitchFrom(e,p)};const pe=e=>{if(e.pointerId!==a)return;a=null;S.pitchBend=0;applyPitch();ui()};p.onpointerup=pe;p.onpointercancel=pe;p.onlostpointercapture=pe;m.onpointerdown=e=>{e.preventDefault();b=e.pointerId;m.setPointerCapture?.(b);modFrom(e,m)};m.onpointermove=e=>{if(e.pointerId===b)modFrom(e,m)};const me=e=>{if(e.pointerId===b)b=null};m.onpointerup=me;m.onpointercancel=me;m.onlostpointercapture=me}
function ui(){const p=document.querySelector('#v39PitchStrip'),m=document.querySelector('#v39ModStrip'),po=document.querySelector('#v39PitchValue'),mo=document.querySelector('#v39ModValue');if(p)p.style.setProperty('--v39-pos',`${50-(S.pitchBend/S.pitchRange)*44}%`);if(m)m.style.setProperty('--v39-pos',`${94-S.mod*88}%`);if(po)po.textContent=`${S.pitchBend>=0?'+':''}${S.pitchBend.toFixed(1)}`;if(mo)mo.textContent=`${Math.round(S.mod*100)}%`}
const options=()=>Object.entries(M.voiceGroups).map(([g,n])=>`<optgroup label="${g}">${n.map(x=>`<option value="${x}" ${x===V38.state.voice?'selected':''}>${x}</option>`).join('')}</optgroup>`).join('');
function getUICollapse(key){try{const v=JSON.parse(localStorage.getItem('musicandbeats:ui:controls')||'{}');return !!v[key]}catch{return false}}
function setUICollapse(key,val){try{const v=JSON.parse(localStorage.getItem('musicandbeats:ui:controls')||'{}');v[key]=!!val;localStorage.setItem('musicandbeats:ui:controls',JSON.stringify(v))}catch{}}

function decorateCollapseLead(w){
  let btn=w.querySelector('#v39LeadCollapseBtn');
  if(!btn){
    const head=w.querySelector('.v34-work-head');
    if(!head)return;
    btn=document.createElement('button');
    btn.id='v39LeadCollapseBtn';
    btn.type='button';
    btn.className='v39-focus-toggle';
    head.appendChild(btn);
  }
  const isCollapsed=getUICollapse('leadControls');
  btn.setAttribute('aria-expanded',String(!isCollapsed));
  btn.innerHTML=isCollapsed?'<span>Show controls</span> <i>⌄</i>':'<span>Hide controls</span> <i>⌃</i>';
  btn.onclick=e=>{
    e.preventDefault();
    const next=!getUICollapse('leadControls');
    setUICollapse('leadControls',next);
    decorateCollapseLead(w);
  };
  const toolbar=w.querySelector('.v38-toolbar');
  const fx=w.querySelector('.v38-fx');
  const status=w.querySelector('#v38SampleStatus');
  if(toolbar)toolbar.classList.toggle('v39-hidden',isCollapsed);
  if(fx)fx.classList.toggle('v39-hidden',isCollapsed);
  if(status)status.classList.toggle('v39-hidden',isCollapsed);
}

function decorate(){
  const w=document.querySelector('#v34Workspace'),voice=w?.querySelector('#v38Voice');if(!voice)return;
  decorateCollapseLead(w);
  const valid=Object.values(M.voiceGroups).flat();if(M.hidden.has(V38.state.voice)||!valid.includes(V38.state.voice))V38.state.voice=S.leadVoice='Grand Piano';if(voice.dataset.v39!=='1'){voice.innerHTML=options();voice.dataset.v39='1'}voice.value=V38.state.voice;const t=w.querySelector('.v38-toolbar');if(t&&!w.querySelector('#v39SlideMode')){t.insertAdjacentHTML('beforeend',`<label>Slide<select id="v39SlideMode"><option value="on" ${S.slide?'selected':''}>Glide on</option><option value="off" ${!S.slide?'selected':''}>Off</option></select></label><label>Glide<input id="v39Glide" type="range" min="0" max="300" step="5" value="${S.glideMs}"><output>${S.glideMs} ms</output></label><label>Pitch range<select id="v39PitchRange">${[2,7,12].map(n=>`<option value="${n}" ${n===S.pitchRange?'selected':''}>±${n}</option>`).join('')}</select></label>`);w.querySelector('#v39SlideMode').onchange=e=>{S.slide=e.target.value==='on';M.persist()};w.querySelector('#v39Glide').oninput=e=>{S.glideMs=+e.target.value;e.target.closest('label').querySelector('output').textContent=`${S.glideMs} ms`;M.persist()};w.querySelector('#v39PitchRange').onchange=e=>{S.pitchRange=+e.target.value;S.pitchBend=clamp(S.pitchBend,-S.pitchRange,S.pitchRange);M.persist();ui()}}
  w.querySelector('#v38FxPreset')?.querySelector('option[value="Indian Space"]')?.remove();const k=w.querySelector('#v38Keyboard');if(k&&!k.closest('.v39-performance-shell')){const sh=document.createElement('div');sh.className='v39-performance-shell';k.before(sh);sh.innerHTML=`<aside class="v39-performance-controls"><div class="v39-strip-wrap"><span>PITCH</span><div id="v39PitchStrip" class="v39-perf-strip pitch" role="slider"><i></i></div><output id="v39PitchValue">0.0</output></div><div class="v39-strip-wrap"><span>MOD</span><div id="v39ModStrip" class="v39-perf-strip mod" role="slider"><i></i></div><output id="v39ModValue">${Math.round(S.mod*100)}%</output></div></aside><div class="v39-phone-rotate">Rotate phone to landscape for Pitch + Mod</div>`;sh.appendChild(k);bindStrip();ui()}
  if(!voice.dataset.v39Change){voice.dataset.v39Change=1;voice.addEventListener('change',()=>{stopLead();const newVoice=voice.value;V38.state.voice=S.leadVoice=newVoice;M.persist();sampleManager.preloadVoice(newVoice);setTimeout(()=>{decorate()},0)})}}
document.addEventListener('change',e=>{if(e.target.matches?.('#v38Layout,#v38StartOct,#v38Octaves'))stopLead();if(e.target.matches?.('#v38FxPreset,#v38Mod,#v38Drive,#v38Delay,#v38Space'))setTimeout(()=>{stopLead();if(ctx)buildFX()},0)},true);document.addEventListener('input',e=>{if(e.target.matches?.('#v38Intensity,#v38Wet,#v38Tone'))setTimeout(()=>{stopLead();if(ctx)buildFX()},0)},true);
function monitor(){if(!ctx)return;const vib=Math.sin(ctx.currentTime*Math.PI*2*5.2)*S.mod*.42;for(const h of [...S.leadPointers.values(),...(S.leadMidiVoices?.values()||[])])h.voice?.apply?.(.018,vib);if(S.fxOutput?.gain)try{S.fxOutput.gain.setTargetAtTime(V37.mix?.lead??1.1,ctx.currentTime,.03)}catch{}}
Object.assign(M,{decorateLead:decorate,stopLead,monitorLead:monitor,buildLeadFX:buildFX,makeLeadVoice:makeVoice,startMidiLead,stopMidiLead,applyPitch,updateLeadUI:ui,getUICollapse,setUICollapse});
})();