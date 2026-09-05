/* Music & Beats V39 core — transpose, live editable chord pads, Western sample catalog, keyboard shortcuts, and project recall. */
(()=>{
const V=window.MB_V35,api=window.MB_V34_LOOPER,V38=window.MB_V38;if(!V||!api||!V38||window.MB_V39)return;
const {tracks}=api,L=api.state,PROJECTS='musicandbeats:v35:projects',SETTINGS='musicandbeats:v39:settings',clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),clone=x=>JSON.parse(JSON.stringify(x));
const sample=n=>({file:`${String(n).padStart(3,'0')}0_GeneralUserGS_sf2_file.js`,variable:`_tone_${String(n).padStart(3,'0')}0_GeneralUserGS_sf2_file`});
const SAMPLES={'Grand Piano':sample(0),'Bright Piano':sample(1),'Electric Grand':sample(2),'Honky Tonk':sample(3),'Classic EP':sample(4),'FM EP':sample(5),'Harpsichord':sample(6),'Clavinet':sample(7),'Drawbar Organ':sample(16),'Percussive Organ':sample(17),'Rock Organ':sample(18),'Church Organ':sample(19),'Nylon Guitar':sample(24),'Steel Guitar':sample(25),'Jazz Guitar':sample(26),'Clean Guitar':sample(27),'Muted Guitar':sample(28),'Overdrive Guitar':sample(29),'Distortion Guitar':sample(30),'Acoustic Bass':sample(32),'Finger Bass':sample(33),'Pick Bass':sample(34),'Fretless Bass':sample(35),'Slap Bass 1':sample(36),'Slap Bass 2':sample(37),'Synth Bass 1':sample(38),'Synth Bass 2':sample(39),'Violin':sample(40),'Cello':sample(42),'String Ensemble':sample(48),'Synth Strings':sample(50),'Choir Aahs':sample(52),'Trumpet':sample(56),'Trombone':sample(57),'French Horn':sample(60),'Alto Sax':sample(65),'Tenor Sax':sample(66),'Clarinet':sample(71),'Concert Flute':sample(73),'Square Lead':sample(80),'Saw Lead':sample(81),'Calliope Lead':sample(82),'Charang Lead':sample(84),'New Age Pad':sample(88),'Warm Pad':sample(89),'Poly Synth':sample(90),'Choir Pad':sample(91),'Metallic Pad':sample(93),'Halo Pad':sample(94),'Sweep Pad':sample(95)};Object.assign(V38.SAMPLE_VOICES,SAMPLES);
const voiceGroups={'Pianos & Keys':['Grand Piano','Bright Piano','Electric Grand','Honky Tonk','Classic EP','FM EP','Harpsichord','Clavinet'],'Organs':['Drawbar Organ','Percussive Organ','Rock Organ','Church Organ'],'Guitars':['Nylon Guitar','Steel Guitar','Jazz Guitar','Clean Guitar','Muted Guitar','Overdrive Guitar','Distortion Guitar'],'Basses':['Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2'],'Strings & Ensemble':['Violin','Cello','String Ensemble','Synth Strings','Choir Aahs'],'Brass & Winds':['Trumpet','Trombone','French Horn','Alto Sax','Tenor Sax','Clarinet','Concert Flute'],'Synth Leads':['Fusion Lead','Glass Lead','Square Lead','Saw Lead','Calliope Lead','Charang Lead'],'Pads':['New Age Pad','Warm Pad','Poly Synth','Choir Pad','Metallic Pad','Halo Pad','Sweep Pad']};
const hidden=new Set(['Bansuri Lead','Sitar Lead','Sample Shakuhachi','Sample Sitar']);
const chordTypes={'Major':[0,4,7],'Minor':[0,3,7],'Diminished':[0,3,6],'Augmented':[0,4,8],'Sus2':[0,2,7],'Sus4':[0,5,7],'Power 5':[0,7,12],'6':[0,4,7,9],'m6':[0,3,7,9],'7':[0,4,7,10],'maj7':[0,4,7,11],'m7':[0,3,7,10],'dim7':[0,3,6,9],'m7b5':[0,3,6,10],'add9':[0,4,7,14],'madd9':[0,3,7,14],'9':[0,4,7,10,14],'maj9':[0,4,7,11,14],'m9':[0,3,7,10,14],'11':[0,4,7,10,14,17],'m11':[0,3,7,10,14,17],'13':[0,4,7,10,14,17,21],'m13':[0,3,7,10,14,17,21],'6/9':[0,4,7,9,14],'7sus4':[0,5,7,10],'mMaj7':[0,3,7,11],'maj7#11':[0,4,7,11,18],'7b9':[0,4,7,10,13],'7#9':[0,4,7,10,15],'7b5':[0,4,6,10],'7#5':[0,4,8,10],'add11':[0,4,7,17],'madd11':[0,3,7,17]};
const suffix={Major:'',Minor:'m',Diminished:'°',Augmented:'+',Sus2:'sus2',Sus4:'sus4','Power 5':'5','6':'6','m6':'m6','7':'7',maj7:'maj7',m7:'m7',dim7:'dim7',m7b5:'m7♭5',add9:'add9',madd9:'madd9','9':'9',maj9:'maj9',m9:'m9','11':'11',m11:'m11','13':'13',m13:'m13','6/9':'6/9','7sus4':'7sus4',mMaj7:'mMaj7','maj7#11':'maj7♯11','7b9':'7♭9','7#9':'7♯9','7b5':'7♭5','7#5':'7♯5',add11:'add11',madd11:'madd11',Custom:' custom'};
const S={transpose:{keys:0,bass:0},chords:[],chordsCustomized:false,chordKey:tracks.keys.key,editorSlot:0,editorOpen:false,slide:true,glideMs:85,pitchRange:2,pitchBend:0,mod:0,leadVoice:'Grand Piano',keyPointers:new Map(),keyLatch:null,heldShortcuts:new Map(),heldMidiPads:new Map(),bassPointers:new Map(),bassLatch:null,heldBassShortcuts:new Map(),heldMidiBassPads:new Map()};

const COLLAPSE_KEY='musicandbeats:ui:controls';
const collapseState={keys:false,bass:false,lead:false};
function loadCollapseState(){
  try{
    const v=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'{}');
    if(typeof v.keysControls==='boolean')collapseState.keys=v.keysControls;
    if(typeof v.bassControls==='boolean')collapseState.bass=v.bassControls;
    if(typeof v.leadControls==='boolean')collapseState.lead=v.leadControls;
  }catch{}
}
loadCollapseState();

function saveCollapseState(){
  try{
    const v=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'{}');
    v.keysControls=collapseState.keys;
    v.bassControls=collapseState.bass;
    v.leadControls=collapseState.lead;
    localStorage.setItem(COLLAPSE_KEY,JSON.stringify(v));
  }catch{}
}

function getUICollapse(key){
  if(key==='keysControls'||key==='keys')return collapseState.keys;
  if(key==='bassControls'||key==='bass')return collapseState.bass;
  if(key==='leadControls'||key==='lead')return collapseState.lead;
  try{const v=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'{}');return !!v[key]}catch{return false}
}

function setUICollapse(key,val){
  const b=!!val;
  if(key==='keysControls'||key==='keys')collapseState.keys=b;
  else if(key==='bassControls'||key==='bass')collapseState.bass=b;
  else if(key==='leadControls'||key==='lead')collapseState.lead=b;
  else{
    try{
      const v=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'{}');
      v[key]=b;
      localStorage.setItem(COLLAPSE_KEY,JSON.stringify(v));
    }catch{}
    return;
  }
  saveCollapseState();
}

function defaults(key){try{return chordData(key).slice(0,7).map(c=>({root:c.name,type:c.quality==='minor'?'Minor':c.quality==='dim'?'Diminished':'Major',custom:''}))}catch{}const i=Math.max(0,NOTES.indexOf(key)),steps=[0,2,4,5,7,9,11],types=['Major','Minor','Minor','Major','Major','Minor','Diminished'];return steps.map((x,n)=>({root:NOTES[(i+x)%12],type:types[n],custom:''}))}
try{const x=JSON.parse(localStorage.getItem(SETTINGS)||'null');if(x){if(x.transpose)Object.assign(S.transpose,x.transpose);if(Array.isArray(x.chords)&&x.chords.length===7)S.chords=x.chords;S.chordsCustomized=!!x.chordsCustomized;S.chordKey=x.chordKey||S.chordKey;S.slide=x.slide!==false;S.glideMs=clamp(+x.glideMs||85,0,300);S.pitchRange=[2,7,12].includes(+x.pitchRange)?+x.pitchRange:2;S.mod=clamp(+x.mod||0,0,1);S.leadVoice=x.leadVoice||S.leadVoice}}catch{}
S.transpose.keys=clamp(+S.transpose.keys||0,-12,12);S.transpose.bass=clamp(+S.transpose.bass||0,-12,12);if(S.chords.length!==7)S.chords=defaults(tracks.keys.key);if(hidden.has(S.leadVoice)||(!SAMPLES[S.leadVoice]&&!['Fusion Lead','Glass Lead'].includes(S.leadVoice)))S.leadVoice='Grand Piano';V38.state.voice=S.leadVoice;if(V38.state.fxPreset==='Indian Space'){V38.state.fxPreset='Studio';V38.state.fx={...V38.FX_PRESETS.Studio}}
function persist(){S.leadVoice=V38.state.voice;try{localStorage.setItem(SETTINGS,JSON.stringify({transpose:S.transpose,chords:S.chords,chordsCustomized:S.chordsCustomized,chordKey:S.chordKey,slide:S.slide,glideMs:S.glideMs,pitchRange:S.pitchRange,mod:S.mod,leadVoice:S.leadVoice}))}catch{}}
function custom(s){return String(s||'').split(/[ ,]+/).map(Number).filter(Number.isFinite).map(n=>clamp(Math.round(n),0,36)).filter((n,i,a)=>a.indexOf(n)===i).sort((a,b)=>a-b)}
function intervals(c){return c.type==='Custom'?(custom(c.custom).length?custom(c.custom):[0,4,7]):(chordTypes[c.type]||chordTypes.Major)}
function midis(c){const root=Math.max(0,NOTES.indexOf(c.root)),base=noteMidi('C',3)+root+S.transpose.keys;return intervals(c).map(x=>base+x)}
function label(c){return `${window.FLAT?.[c.root]||c.root}${suffix[c.type]??c.type}`}
function meta(now){if(L.recordingLane==='keys')return{startTime:L.recordStartTime,startStep:L.recordStartStep,boundary:L.recordStartTime+V.totalSteps()*V.stepSeconds(),sessionId:L.recordSessionId};const g=L.captureGrace;if(g?.lane==='keys'&&now<=g.boundary)return{startTime:g.startTime,startStep:g.startStep,boundary:g.boundary,sessionId:g.sessionId};return null}
function capture(h,end){if(h.captured||!h.meta)return;if(h.meta.sessionId&&L.recordSessionId&&h.meta.sessionId!==L.recordSessionId){h.captured=true;return}const sec=V.stepSeconds(),m=h.meta,e=Math.min(end,m.boundary),s=Math.max(h.startedAt,m.startTime);if(e<=m.startTime){h.captured=true;return}let a=Math.round((s-m.startTime)/sec),b=Math.round((e-m.startTime)/sec);a=clamp(a,0,V.totalSteps()-1);b=clamp(Math.max(a+1,b),a+1,V.totalSteps());tracks.keys.events.push({step:V.wrapStep(m.startStep+a),durationSteps:b-a,midis:[...h.midis],preset:h.preset});h.captured=true;if(L.normalizeTrackEvents)tracks.keys.events=L.normalizeTrackEvents(tracks.keys.events,V.totalSteps(),!!V.extra.latchKeys);V.persist()}
function stopKey(h,end=ctx?.currentTime||0){if(!h)return;capture(h,end);h.voices?.forEach(v=>{try{v.stop()}catch{}});h.button?.classList.remove('active','v36-latched');if(S.keyLatch===h)S.keyLatch=null}
function metaBass(now){if(L.recordingLane==='bass')return{startTime:L.recordStartTime,startStep:L.recordStartStep,boundary:L.recordStartTime+V.totalSteps()*V.stepSeconds(),sessionId:L.recordSessionId};const g=L.captureGrace;if(g?.lane==='bass'&&now<=g.boundary)return{startTime:g.startTime,startStep:g.startStep,boundary:g.boundary,sessionId:g.sessionId};return null}
function captureBass(h,end){if(h.captured||!h.meta)return;if(h.meta.sessionId&&L.recordSessionId&&h.meta.sessionId!==L.recordSessionId){h.captured=true;return}const sec=V.stepSeconds(),m=h.meta,e=Math.min(end,m.boundary),s=Math.max(h.startedAt,m.startTime);if(e<=m.startTime){h.captured=true;return}let a=Math.round((s-m.startTime)/sec),b=Math.round((e-m.startTime)/sec);a=clamp(a,0,V.totalSteps()-1);b=clamp(Math.max(a+1,b),a+1,V.totalSteps());tracks.bass.events.push({step:V.wrapStep(m.startStep+a),durationSteps:b-a,midis:[...h.midis],preset:h.preset});h.captured=true;if(L.normalizeTrackEvents)tracks.bass.events=L.normalizeTrackEvents(tracks.bass.events,V.totalSteps(),!!V.extra.latchBass);V.persist()}
function stopBass(h,end=ctx?.currentTime||0){if(!h)return;captureBass(h,end);h.voices?.forEach(v=>{try{v.stop()}catch{}});h.button?.classList.remove('active','v36-latched');if(S.bassLatch===h)S.bassLatch=null}
function carryForwardRecord(lane,t,sessId=null){const sId=sessId||L.recordSessionId;const sec=V.stepSeconds(),tot=V.totalSteps(),boundary=t+tot*sec;if(lane==='keys'){const holds=[...S.keyPointers.values(),...(S.keyLatch?[S.keyLatch]:[]),...S.heldShortcuts.values(),...(S.heldMidiPads?.values()||[])];for(const h of holds){h.captured=false;h.startedAt=t;h.meta={lane:'keys',startTime:t,startStep:0,boundary,sessionId:sId}}}else if(lane==='bass'){const holds=[...S.bassPointers.values(),...(S.bassLatch?[S.bassLatch]:[]),...S.heldBassShortcuts.values(),...(S.heldMidiBassPads?.values()||[])];for(const h of holds){h.captured=false;h.startedAt=t;h.meta={lane:'bass',startTime:t,startStep:0,boundary,sessionId:sId}}}}
function clearLanePerformance(lane){
  if(lane==='keys'){
    if(S.keyLatch){
      S.keyLatch.captured=true;
      S.keyLatch.meta=null;
      S.keyLatch.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      S.keyLatch.button?.classList.remove('active','v36-latched');
      S.keyLatch=null;
    }
    for(const h of S.keyPointers.values()){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.keyPointers.clear();
    for(const h of S.heldShortcuts.values()){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.heldShortcuts.clear();
    for(const h of (S.heldMidiPads?.values()||[])){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.heldMidiPads?.clear();
    document.querySelectorAll('#v34ChordPads .v34-performance-pad, #v39ChordPads button, .v36-chord-btn').forEach(btn=>{
      btn.classList.remove('active','v36-latched');
    });
  }else if(lane==='bass'){
    if(S.bassLatch){
      S.bassLatch.captured=true;
      S.bassLatch.meta=null;
      S.bassLatch.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      S.bassLatch.button?.classList.remove('active','v36-latched');
      S.bassLatch=null;
    }
    for(const h of S.bassPointers.values()){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.bassPointers.clear();
    for(const h of S.heldBassShortcuts.values()){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.heldBassShortcuts.clear();
    for(const h of (S.heldMidiBassPads?.values()||[])){
      h.captured=true;
      h.meta=null;
      h.voices?.forEach(v=>{try{v.stop?.()}catch{}});
      h.button?.classList.remove('active','v36-latched');
    }
    S.heldMidiBassPads?.clear();
    document.querySelectorAll('#v34BassPads .v34-performance-pad, #v39BassPads button, .v36-bass-btn').forEach(btn=>{
      btn.classList.remove('active','v36-latched');
    });
  }
}
function onFinishRecording(lane,boundary,cancelled){if(cancelled)return;if(lane==='keys'){const all=[...(S.keyLatch?[S.keyLatch]:[]),...S.keyPointers.values(),...S.heldShortcuts.values(),...(S.heldMidiPads?.values()||[])];for(const h of all){if(!h.captured&&h.meta)capture(h,boundary)}}else if(lane==='bass'){const all=[...(S.bassLatch?[S.bassLatch]:[]),...S.bassPointers.values(),...S.heldBassShortcuts.values(),...(S.heldMidiBassPads?.values()||[])];for(const h of all){if(!h.captured&&h.meta)captureBass(h,boundary)}}const latchOn=V.extra?.[lane==='keys'?'latchKeys':'latchBass']||false;if(tracks[lane]&&L.normalizeTrackEvents)tracks[lane].events=L.normalizeTrackEvents(tracks[lane].events,V.totalSteps(),latchOn);V.persist()}
function releaseBass(){for(const h of S.bassPointers.values())stopBass(h);S.bassPointers.clear();stopBass(S.bassLatch);S.bassLatch=null;for(const h of S.heldBassShortcuts.values())stopBass(h);S.heldBassShortcuts.clear();for(const h of (S.heldMidiBassPads?.values()||[]))stopBass(h);S.heldMidiBassPads?.clear()}
function releaseKeys(){for(const h of S.keyPointers.values())stopKey(h);S.keyPointers.clear();stopKey(S.keyLatch);S.keyLatch=null;for(const h of S.heldShortcuts.values())stopKey(h);S.heldShortcuts.clear();for(const h of (S.heldMidiPads?.values()||[]))stopKey(h);S.heldMidiPads?.clear();releaseBass()}

function playSampleBuffer(m,preset,vol=0.76,outNode=null){
  const ac=outNode?.context||ctx;
  if(!ac||!window.MB_V39?.sampleManager||!V38.SAMPLE_VOICES[preset])return null;
  const sm=window.MB_V39.sampleManager;
  const spec=V38.SAMPLE_VOICES[preset];
  const prog=window[spec?.variable];
  if(!prog)return null;
  const z=sm.zoneFor(prog,m);
  if(!z)return null;
  const b=sm.decodedBuffers?.get?.(z);
  if(!b)return null;
  const dest=(outNode&&outNode.context===ac)?outNode:(L?.playbackBus?.context===ac?L.playbackBus:(synthBus?.context===ac?synthBus:ac.destination));
  const src=ac.createBufferSource(),g=ac.createGain(),now=ac.currentTime;
  const base=(+z.originalPitch||6000)/100+(+z.coarseTune||0)+(+z.fineTune||0)/100;
  src.buffer=b;
  if(+z.loopStart>=0&&+z.loopEnd>+z.loopStart){
    src.loop=true;src.loopStart=z.loopStart/(z.sampleRate||b.sampleRate);src.loopEnd=z.loopEnd/(z.sampleRate||b.sampleRate);
  }
  g.gain.setValueAtTime(.0001,now);
  g.gain.exponentialRampToValueAtTime(Math.max(.001,vol*.88),now+.008);
  src.connect(g).connect(dest);
  const r=Math.pow(2,(m-base)/12);
  try{src.playbackRate.setValueAtTime(r,now)}catch{}
  let stopped=false;
  src.start(now,Math.max(0,+z.delay||0));
  const voice={midi:m,preset,stop(){
    if(stopped)return;stopped=true;const t=ac.currentTime;
    try{g.gain.cancelScheduledValues(t);g.gain.setTargetAtTime(.0001,t,.04);src.stop(t+.18)}catch{}
    if(window.activeVoices){window.activeVoices.delete(voice);window.updateVoiceBadges?.()}
  },hardStop(){
    if(stopped)return;stopped=true;const t=ac.currentTime;
    try{g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(Math.max(.0001,g.gain.value),t);g.gain.linearRampToValueAtTime(0,t+.006);src.stop(t+.012)}catch{}
    if(window.activeVoices){window.activeVoices.delete(voice);window.updateVoiceBadges?.()}
  }};
  if(window.activeVoices){window.activeVoices.add(voice);window.updateVoiceBadges?.()}
  return voice;
}

function playVoiceForChord(m,preset,vol=0.76){
  const targetDest=(L?.playbackBus?.context===ctx)?L.playbackBus:(synthBus?.context===ctx?synthBus:ctx.destination);
  if(V38.SAMPLE_VOICES[preset]){
    const sVoice=playSampleBuffer(m,preset,vol,targetDest);
    if(sVoice)return sVoice;
    window.MB_V39?.sampleManager?.preloadVoice?.(preset,Math.max(12,m-12),Math.min(108,m+12));
  }
  return startVoice(m,SOUND_PRESETS[preset]?preset:'Studio Grand',vol,targetDest);
}

const prevStartVoice=window.startVoice;
if(typeof prevStartVoice==='function'&&!prevStartVoice.__v39SampleHook){
  const hookedStartVoice=function(m,p='Studio Grand',v=.86,outNode=null){
    const ac=outNode?.context||ctx;
    const targetDest=(outNode&&outNode.context===ac)?outNode:(L?.playbackBus?.context===ac?L.playbackBus:(synthBus?.context===ac?synthBus:ac.destination));
    if(V38.SAMPLE_VOICES?.[p]){
      const sVoice=playSampleBuffer(m,p,v,targetDest);
      if(sVoice)return sVoice;
      window.MB_V39?.sampleManager?.preloadVoice?.(p,Math.max(12,m-12),Math.min(108,m+12));
    }
    if(window.MB_V39?.synthVoice){
      return window.MB_V39.synthVoice(m,SOUND_PRESETS[p]?p:'Studio Grand',targetDest);
    }
    return prevStartVoice(m,SOUND_PRESETS[p]?p:'Studio Grand',v);
  };
  hookedStartVoice.__v39SampleHook=true;
  window.startVoice=hookedStartVoice;
}

function startChordOnPad(b){
  if(!b||!ctx)return;
  let ms=b.dataset.v39Midis?.split(',').map(Number).filter(Number.isFinite);
  if(!ms||!ms.length){
    const idx=+b.dataset.index;
    if(Number.isFinite(idx)){
      const c=S.chords[idx]||defaults(tracks.keys.key)[idx];
      if(c)ms=midis(c);
    }
  }
  if(!ms||!ms.length)return;
  const preset=tracks.keys.sound,now=ctx.currentTime;
  if(V.extra.latchKeys){
    if(S.keyLatch?.button===b){stopKey(S.keyLatch,now);return}
    if(S.keyLatch)stopKey(S.keyLatch,now);
    const h={button:b,midis:ms,preset,voices:ms.map((m,i)=>playVoiceForChord(m,preset,.78-Math.min(i*.04,.22))),startedAt:now,meta:meta(now),captured:false};
    S.keyLatch=h;b.classList.add('active','v36-latched');return h;
  }
  const h={button:b,midis:ms,preset,voices:ms.map((m,i)=>playVoiceForChord(m,preset,.78-Math.min(i*.04,.22))),startedAt:now,meta:meta(now),captured:false};
  b.classList.add('active');return h;
}

function startBassOnPad(b){
  if(!b||!ctx)return;
  const midi=+b.dataset.midi;
  if(!Number.isFinite(midi))return;
  const preset=tracks.bass.sound,now=ctx.currentTime;
  const targetDest=(L?.playbackBus?.context===ctx)?L.playbackBus:(synthBus?.context===ctx?synthBus:ctx.destination);
  if(V.extra.latchBass){
    if(S.bassLatch?.button===b){stopBass(S.bassLatch,now);return}
    if(S.bassLatch)stopBass(S.bassLatch,now);
    window.MB_V36?.releaseLane?.('bass');
    const voice=startVoice(midi,preset,.84,targetDest);
    const h={button:b,midis:[midi],preset,voices:voice?[voice]:[],startedAt:now,meta:metaBass(now),captured:false};
    S.bassLatch=h;b.classList.add('active','v36-latched');return h;
  }
  const voice=startVoice(midi,preset,.84,targetDest);
  const h={button:b,midis:[midi],preset,voices:voice?[voice]:[],startedAt:now,meta:metaBass(now),captured:false};
  b.classList.add('active');return h;
}

function down(e){
  const kb=e.target.closest?.('#v34ChordPads .v34-performance-pad');
  if(kb){
    e.preventDefault();e.stopImmediatePropagation();primeAudio();if(!ctx)return;
    const h=startChordOnPad(kb);
    if(h&&!V.extra.latchKeys){
      S.keyPointers.set(e.pointerId,h);
      try{kb.setPointerCapture(e.pointerId)}catch{}
    }
    return;
  }
  const bb=e.target.closest?.('#v34BassPads .v34-bass-pad');
  if(bb){
    e.preventDefault();e.stopImmediatePropagation();primeAudio();if(!ctx)return;
    const h=startBassOnPad(bb);
    if(h&&!V.extra.latchBass){
      S.bassPointers.set(e.pointerId,h);
      try{bb.setPointerCapture(e.pointerId)}catch{}
    }
    return;
  }
}
function up(e){
  const kh=S.keyPointers.get(e.pointerId);
  if(kh){e.preventDefault();e.stopImmediatePropagation();stopKey(kh);S.keyPointers.delete(e.pointerId)}
  const bh=S.bassPointers.get(e.pointerId);
  if(bh){e.preventDefault();e.stopImmediatePropagation();stopBass(bh);S.bassPointers.delete(e.pointerId)}
}
document.addEventListener('pointerdown',down,true);['pointerup','pointercancel','lostpointercapture'].forEach(t=>document.addEventListener(t,up,true));

function handleKeyDown(e){
  if(e.repeat)return;
  const tag=document.activeElement?.tagName?.toLowerCase();
  if(['input','textarea','select'].includes(tag)||document.activeElement?.isContentEditable)return;
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  let padIdx=-1;
  if(e.code.startsWith('Digit')){const d=parseInt(e.code.slice(5),10);if(d>=1&&d<=8)padIdx=d-1}
  else if(e.code.startsWith('Numpad')){const d=parseInt(e.code.slice(6),10);if(d>=1&&d<=8)padIdx=d-1}
  if(padIdx<0)return;

  const bassPads=document.querySelectorAll('#v34BassPads .v34-bass-pad');
  if(bassPads.length&&(L.activeLane==='bass'||!document.querySelector('#v34ChordPads'))){
    const pad=bassPads[padIdx];if(!pad)return;
    e.preventDefault();primeAudio();
    if(V.extra.latchBass){
      startBassOnPad(pad);
    }else{
      if(S.heldBassShortcuts.has(padIdx))return;
      const h=startBassOnPad(pad);
      if(h)S.heldBassShortcuts.set(padIdx,h);
    }
    return;
  }

  const keyPads=document.querySelectorAll('#v34ChordPads .v34-performance-pad');
  if(keyPads.length&&(L.activeLane==='keys'||!document.querySelector('#v34BassPads'))){
    const pad=keyPads[padIdx];if(!pad)return;
    e.preventDefault();primeAudio();
    if(V.extra.latchKeys){
      startChordOnPad(pad);
    }else{
      if(S.heldShortcuts.has(padIdx))return;
      const h=startChordOnPad(pad);
      if(h)S.heldShortcuts.set(padIdx,h);
    }
    return;
  }
}
function handleKeyUp(e){
  const tag=document.activeElement?.tagName?.toLowerCase();
  if(['input','textarea','select'].includes(tag)||document.activeElement?.isContentEditable)return;
  let padIdx=-1;
  if(e.code.startsWith('Digit')){const d=parseInt(e.code.slice(5),10);if(d>=1&&d<=8)padIdx=d-1}
  else if(e.code.startsWith('Numpad')){const d=parseInt(e.code.slice(6),10);if(d>=1&&d<=8)padIdx=d-1}
  if(padIdx<0)return;

  if(S.heldBassShortcuts.has(padIdx)){
    const h=S.heldBassShortcuts.get(padIdx);
    if(h){stopBass(h);S.heldBassShortcuts.delete(padIdx)}
  }

  if(S.heldShortcuts.has(padIdx)){
    const h=S.heldShortcuts.get(padIdx);
    if(h){stopKey(h);S.heldShortcuts.delete(padIdx)}
  }
}
window.addEventListener('keydown',handleKeyDown,true);
window.addEventListener('keyup',handleKeyUp,true);

function triggerPadDown(lane,padIdx,vel=0.8){
  const targetLane=lane||L.activeLane||'keys';
  if(typeof primeAudio==='function')primeAudio();
  if(!ctx)return null;
  if(targetLane==='keys'){
    if(padIdx<0||padIdx>=7)return null;
    let pads=document.querySelectorAll('#v34ChordPads .v34-performance-pad');
    if(!pads.length){
      document.querySelector('button[data-select="keys"]')?.click();
      pads=document.querySelectorAll('#v34ChordPads .v34-performance-pad');
    }
    const pad=pads[padIdx];
    if(!pad)return null;
    if(S.heldMidiPads.has(padIdx))return S.heldMidiPads.get(padIdx);
    const h=startChordOnPad(pad);
    if(h)S.heldMidiPads.set(padIdx,h);
    return h;
  }else if(targetLane==='bass'){
    if(padIdx<0||padIdx>=8)return null;
    let pads=document.querySelectorAll('#v34BassPads .v34-bass-pad');
    if(!pads.length){
      document.querySelector('button[data-select="bass"]')?.click();
      pads=document.querySelectorAll('#v34BassPads .v34-bass-pad');
    }
    const pad=pads[padIdx];
    if(!pad)return null;
    if(S.heldMidiBassPads.has(padIdx))return S.heldMidiBassPads.get(padIdx);
    const h=startBassOnPad(pad);
    if(h)S.heldMidiBassPads.set(padIdx,h);
    return h;
  }
  return null;
}

function triggerPadUp(lane,padIdx){
  const targetLane=lane||L.activeLane||'keys';
  if(targetLane==='keys'){
    if(S.heldMidiPads.has(padIdx)){
      const h=S.heldMidiPads.get(padIdx);
      if(!V.extra.latchKeys&&h)stopKey(h);
      S.heldMidiPads.delete(padIdx);
    }
  }else if(targetLane==='bass'){
    if(S.heldMidiBassPads.has(padIdx)){
      const h=S.heldMidiBassPads.get(padIdx);
      if(!V.extra.latchBass&&h)stopBass(h);
      S.heldMidiBassPads.delete(padIdx);
    }
  }
}

function setTranspose(lane,n){n=clamp(+n||0,-12,12);const d=n-S.transpose[lane];if(!d)return;if(lane==='keys')releaseKeys();else releaseBass();tracks[lane].events=(tracks[lane].events||[]).map(e=>({...e,midis:(e.midis||[]).map(m=>clamp(+m+d,0,127))}));S.transpose[lane]=n;persist();V.persist();decorate()}
const tSelect=lane=>`<label class="v39-transpose">Transpose<select id="v39Transpose${lane==='keys'?'Keys':'Bass'}">${Array.from({length:25},(_,i)=>i-12).map(n=>`<option value="${n}" ${n===S.transpose[lane]?'selected':''}>${n>0?'+':''}${n} st</option>`).join('')}</select></label>`;
function bassPads(){document.querySelectorAll('#v34BassPads .v34-bass-pad').forEach((b,i)=>{if(!b.dataset.v39BaseMidi)b.dataset.v39BaseMidi=b.dataset.midi;const m=clamp(+b.dataset.v39BaseMidi+S.transpose.bass,0,127);b.dataset.midi=m;const q=b.querySelector('strong'),txt=midiLabel(m);if(q&&q.textContent!==txt)q.textContent=txt;let cap=b.querySelector('.v39-keycap');if(!cap){cap=document.createElement('span');cap.className='v39-keycap';cap.textContent=String(i+1);b.appendChild(cap)}})}
function bass(){
  const w=document.querySelector('#v34Workspace');if(!w)return;
  const voiceSel=w.querySelector('#v34BassSound');
  if(voiceSel)enhanceBassVoiceSelector(voiceSel);
  const g=w.querySelector('.v34-control-grid');if(!g)return;
  if(!document.querySelector('#v39TransposeBass')){const d=document.createElement('div');d.innerHTML=tSelect('bass');const x=d.firstElementChild;g.insertBefore(x,g.lastElementChild);x.querySelector('select').onchange=e=>setTranspose('bass',e.target.value)}
  bassPads();
  applyCollapse('bass');
}
function chordPads(){
  [...document.querySelectorAll('#v34ChordPads .v34-performance-pad')].forEach((b,i)=>{
    const c=S.chords[i]||defaults(tracks.keys.key)[i],ms=midis(c),a=label(c),z=`${i+1} · ${ms.map(m=>midiLabel(m)).join(' ')}`;
    b.dataset.v39Midis=ms.join(',');
    const q=b.querySelector('strong'),r=b.querySelector('small');
    if(q&&q.textContent!==a)q.textContent=a;
    if(r&&r.textContent!==z)r.textContent=z;
    let cap=b.querySelector('.v39-keycap');
    if(!cap){
      cap=document.createElement('span');cap.className='v39-keycap';cap.textContent=String(i+1);
      b.appendChild(cap);
    }
  });
}

function updateEditorLive(slot,root,type,customStr){
  releaseKeys();
  S.chords[slot]={root,type,custom:customStr||''};
  S.chordsCustomized=true;S.chordKey=tracks.keys.key;persist();
  chordPads();
  const c=S.chords[slot];
  const p=document.querySelector('#v39ChordEditor');
  if(p){
    const head=p.querySelector('header strong');
    if(head)head.textContent=`Pad ${slot+1} · ${label(c)}`;
    const slotBtn=p.querySelector(`[data-v39-slot="${slot}"] b`);
    if(slotBtn)slotBtn.textContent=label(c);
  }
}

function editorHTML(){
  const c=S.chords[S.editorSlot]||defaults(tracks.keys.key)[S.editorSlot];
  return `<section id="v39ChordEditor" class="v39-chord-editor">
    <header><div><span class="v34-kicker">CHORD EDITOR</span><strong>Pad ${S.editorSlot+1} · ${label(c)}</strong></div><button id="v39ChordToggle" type="button">${S.editorOpen?'Done':'Edit chords'}</button></header>
    <div class="v39-chord-body" ${S.editorOpen?'':'hidden'}>
      <div class="v39-slot-row">${S.chords.map((x,i)=>`<button data-v39-slot="${i}" type="button" class="${i===S.editorSlot?'active':''}"><span>${i+1}</span><b>${label(x)}</b></button>`).join('')}</div>
      <div class="v39-chord-fields">
        <label>Root<select id="v39ChordRoot">${NOTES.map(n=>`<option ${n===c.root?'selected':''}>${n}</option>`).join('')}</select></label>
        <label>Chord / extension<select id="v39ChordType">${[...Object.keys(chordTypes),'Custom'].map(n=>`<option ${n===c.type?'selected':''}>${n}</option>`).join('')}</select></label>
        <label id="v39CustomIntervals" class="${c.type==='Custom'?'':'v39-hidden'}">Custom intervals<input id="v39ChordCustom" value="${V.esc(c.custom||'0,4,7')}" placeholder="0,4,7,10,14"><small>Semitones from root. Live applied.</small></label>
      </div>
      <div class="v39-chord-actions"><button id="v39ResetChord" type="button">Reset pad</button><button id="v39ResetAll" type="button">Reset all to ${tracks.keys.key}</button></div>
    </div>
  </section>`;
}

let customDebounce=null;
function bindEditor(){
  const p=document.querySelector('#v39ChordEditor');if(!p)return;
  p.querySelector('#v39ChordToggle').onclick=()=>{S.editorOpen=!S.editorOpen;persist();keys(true)};
  p.querySelectorAll('[data-v39-slot]').forEach(b=>b.onclick=()=>{S.editorSlot=+b.dataset.v39Slot;keys(true)});
  const rootSel=p.querySelector('#v39ChordRoot'),typeSel=p.querySelector('#v39ChordType'),customInp=p.querySelector('#v39ChordCustom');
  if(rootSel)rootSel.onchange=()=>updateEditorLive(S.editorSlot,rootSel.value,typeSel.value,customInp?.value);
  if(typeSel)typeSel.onchange=()=>{
    p.querySelector('#v39CustomIntervals')?.classList.toggle('v39-hidden',typeSel.value!=='Custom');
    updateEditorLive(S.editorSlot,rootSel.value,typeSel.value,customInp?.value);
  };
  if(customInp)customInp.oninput=()=>{
    clearTimeout(customDebounce);
    customDebounce=setTimeout(()=>updateEditorLive(S.editorSlot,rootSel.value,typeSel.value,customInp.value),200);
  };
  p.querySelector('#v39ResetChord')?.addEventListener('click',()=>{releaseKeys();S.chords[S.editorSlot]=defaults(tracks.keys.key)[S.editorSlot];S.chordsCustomized=true;persist();keys(true)});
  p.querySelector('#v39ResetAll')?.addEventListener('click',()=>{releaseKeys();S.chords=defaults(tracks.keys.key);S.chordsCustomized=false;S.chordKey=tracks.keys.key;persist();keys(true)});
}

function applyCollapse(surface){
  const w=document.querySelector('#v34Workspace');if(!w)return;
  const activeSurface=surface||(document.querySelector('#v38Keyboard')||document.querySelector('#v37LeadTrack.active')?'lead':w.querySelector('#v34BassPads')?'bass':'keys');

  if(activeSurface==='keys'||activeSurface==='all'){
    const isCollapsed=collapseState.keys;
    let btn=w.querySelector('#v39KeysCollapseBtn');
    if(!btn){
      const head=w.querySelector('.v34-work-head');
      if(head&&w.querySelector('#v34ChordPads')){
        btn=document.createElement('button');btn.id='v39KeysCollapseBtn';btn.type='button';btn.className='v39-focus-toggle';head.appendChild(btn);
      }
    }
    if(btn){
      btn.setAttribute('aria-expanded',String(!isCollapsed));
      btn.setAttribute('aria-label',isCollapsed?'Show controls':'Hide controls');
      btn.innerHTML=isCollapsed?'<span>Show controls</span> <i>⌄</i>':'<span>Hide controls</span> <i>⌃</i>';
    }
    const grid=w.querySelector('.v34-control-grid');
    if(grid&&w.querySelector('#v34ChordPads')){
      grid.querySelectorAll('label:not(.v36-latch-control),button#v34KeysRecord').forEach(el=>el.classList.toggle('v39-hidden',isCollapsed));
    }
    const ed=w.querySelector('#v39ChordEditor');
    if(ed)ed.classList.toggle('v39-hidden',isCollapsed);
  }

  if(activeSurface==='bass'||activeSurface==='all'){
    const isCollapsed=collapseState.bass;
    let btn=w.querySelector('#v39BassCollapseBtn');
    if(!btn){
      const head=w.querySelector('.v34-work-head');
      if(head&&w.querySelector('#v34BassPads')){
        btn=document.createElement('button');btn.id='v39BassCollapseBtn';btn.type='button';btn.className='v39-focus-toggle';head.appendChild(btn);
      }
    }
    if(btn){
      btn.setAttribute('aria-expanded',String(!isCollapsed));
      btn.setAttribute('aria-label',isCollapsed?'Show controls':'Hide controls');
      btn.innerHTML=isCollapsed?'<span>Show controls</span> <i>⌄</i>':'<span>Hide controls</span> <i>⌃</i>';
    }
    const grid=w.querySelector('.v34-control-grid');
    if(grid&&w.querySelector('#v34BassPads')){
      grid.querySelectorAll('label:not(.v36-latch-control),button#v34BassRecord').forEach(el=>el.classList.toggle('v39-hidden',isCollapsed));
    }
  }

  if(activeSurface==='lead'||activeSurface==='all'){
    const isCollapsed=collapseState.lead;
    let btn=w.querySelector('#v39LeadCollapseBtn');
    if(!btn){
      const head=w.querySelector('.v34-work-head');
      if(head&&(w.querySelector('#v38Keyboard')||w.querySelector('.v38-toolbar'))){
        btn=document.createElement('button');btn.id='v39LeadCollapseBtn';btn.type='button';btn.className='v39-focus-toggle';head.appendChild(btn);
      }
    }
    if(btn){
      btn.setAttribute('aria-expanded',String(!isCollapsed));
      btn.setAttribute('aria-label',isCollapsed?'Show controls':'Hide controls');
      btn.innerHTML=isCollapsed?'<span>Show controls</span> <i>⌄</i>':'<span>Hide controls</span> <i>⌃</i>';
    }
    const toolbar=w.querySelector('.v38-toolbar');
    const fx=w.querySelector('.v38-fx');
    const status=w.querySelector('#v38SampleStatus');
    if(toolbar)toolbar.classList.toggle('v39-hidden',isCollapsed);
    if(fx)fx.classList.toggle('v39-hidden',isCollapsed);
    if(status)status.classList.toggle('v39-hidden',isCollapsed);
  }
}

function toggleCollapse(surface){
  if(surface==='keys'){
    collapseState.keys=!collapseState.keys;
  }else if(surface==='bass'){
    collapseState.bass=!collapseState.bass;
  }else if(surface==='lead'){
    collapseState.lead=!collapseState.lead;
  }
  saveCollapseState();
  applyCollapse(surface);
}

function decorateCollapseKeys(w){
  applyCollapse('keys');
}

function decorateCollapseBass(w){
  applyCollapse('bass');
}

document.addEventListener('click',e=>{
  const btn=e.target.closest?.('#v39KeysCollapseBtn, #v39BassCollapseBtn, #v39LeadCollapseBtn');
  if(!btn)return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  if(btn.id==='v39KeysCollapseBtn')toggleCollapse('keys');
  else if(btn.id==='v39BassCollapseBtn')toggleCollapse('bass');
  else if(btn.id==='v39LeadCollapseBtn')toggleCollapse('lead');
},true);

function enhanceKeysVoiceSelector(voiceSel){
  if(!voiceSel||voiceSel.dataset.v39Grouped==='1')return;
  voiceSel.dataset.v39Grouped='1';
  const standardSynths=['Studio Grand','Soft Grand','Velvet EP','Tonewheel Organ','Dream Pad'];
  let html=`<optgroup label="Standard Synths">${standardSynths.filter(x=>SOUND_PRESETS[x]).map(x=>`<option value="${x}">${x}</option>`).join('')}</optgroup>`;
  for(const [grp,names] of Object.entries(voiceGroups)){
    html+=`<optgroup label="${grp}">${names.map(x=>`<option value="${x}">${x}</option>`).join('')}</optgroup>`;
  }
  const legacySynths=['Harmonium','Tanpura Drone','Bansuri Air','Sitar Pluck'];
  html+=`<optgroup label="Legacy Synths">${legacySynths.filter(x=>SOUND_PRESETS[x]).map(x=>`<option value="${x}">${x}</option>`).join('')}</optgroup>`;
  voiceSel.innerHTML=html;
  voiceSel.value=tracks.keys.sound;
  voiceSel.onchange=e=>{
    tracks.keys.sound=e.target.value;
    persist();
    if(V38.SAMPLE_VOICES[e.target.value]){
      window.MB_V39?.sampleManager?.preloadVoice?.(e.target.value,36,84);
    }
  };
}

function enhanceBassVoiceSelector(voiceSel){
  if(!voiceSel||voiceSel.dataset.v39Grouped==='1')return;
  voiceSel.dataset.v39Grouped='1';
  const realBasses=['Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2'];
  const synthBasses=['Sub Bass','Deep Club Sub','Reese Bass','Acid Bass','FM House Bass','Pluck Bass','Future Growl','Warm Analog'];
  let html=`<optgroup label="Real Bass (Sampled)">${realBasses.map(x=>`<option value="${x}">${x}</option>`).join('')}</optgroup>`;
  html+=`<optgroup label="Synth Bass">${synthBasses.filter(x=>SOUND_PRESETS[x]).map(x=>`<option value="${x}">${x}</option>`).join('')}</optgroup>`;
  voiceSel.innerHTML=html;
  voiceSel.value=tracks.bass.sound;
  voiceSel.onchange=e=>{
    tracks.bass.sound=e.target.value;
    persist();
    if(V38.SAMPLE_VOICES[e.target.value]){
      window.MB_V39?.sampleManager?.preloadVoice?.(e.target.value,24,60);
    }
  };
}

function keys(force=false){
  const w=document.querySelector('#v34Workspace');if(!w)return;
  const voiceSel=w.querySelector('#v34KeysSound');
  if(voiceSel)enhanceKeysVoiceSelector(voiceSel);
  const g=w.querySelector('.v34-control-grid');if(!g)return;
  if(S.chordKey!==tracks.keys.key&&!S.chordsCustomized){S.chords=defaults(tracks.keys.key);S.chordKey=tracks.keys.key;persist()}
  if(!document.querySelector('#v39TransposeKeys')){const d=document.createElement('div');d.innerHTML=tSelect('keys');const x=d.firstElementChild;g.insertBefore(x,g.lastElementChild);x.querySelector('select').onchange=e=>setTranspose('keys',e.target.value)}
  chordPads();
  if(force)document.querySelector('#v39ChordEditor')?.remove();
  if(!document.querySelector('#v39ChordEditor')){document.querySelector('#v34ChordPads')?.insertAdjacentHTML('afterend',editorHTML());bindEditor()}
  applyCollapse('keys');
}

function decorate(){if(document.querySelector('#v38Keyboard')){applyCollapse('lead');return}if(L.activeLane==='keys')keys();else if(L.activeLane==='bass')bass()}
const baseSave=V.saveProject.bind(V),baseLoad=V.loadProject.bind(V),baseNew=V.newProject.bind(V);
V.saveProject=function(...a){const item=baseSave(...a);try{const list=JSON.parse(localStorage.getItem(PROJECTS)||'[]'),x=list.find(p=>p.id===item?.id);if(x?.data){x.data.v39={transpose:clone(S.transpose),chords:clone(S.chords),chordsCustomized:S.chordsCustomized,chordKey:S.chordKey,slide:S.slide,glideMs:S.glideMs,pitchRange:S.pitchRange,mod:S.mod,leadVoice:V38.state.voice};localStorage.setItem(PROJECTS,JSON.stringify(list))}}catch{}return item};
V.loadProject=function(id){let x=null;try{x=JSON.parse(localStorage.getItem(PROJECTS)||'[]').find(p=>p.id===id)?.data?.v39||null}catch{};releaseKeys();window.MB_V39?.stopLead?.();const out=baseLoad(id);if(x){S.transpose={keys:clamp(+x.transpose?.keys||0,-12,12),bass:clamp(+x.transpose?.bass||0,-12,12)};S.chords=Array.isArray(x.chords)&&x.chords.length===7?x.chords:defaults(tracks.keys.key);S.chordsCustomized=!!x.chordsCustomized;S.chordKey=x.chordKey||tracks.keys.key;S.slide=x.slide!==false;S.glideMs=clamp(+x.glideMs||85,0,300);S.pitchRange=[2,7,12].includes(+x.pitchRange)?+x.pitchRange:2;S.mod=clamp(+x.mod||0,0,1);S.leadVoice=x.leadVoice||'Grand Piano'}else{S.transpose={keys:0,bass:0};S.chords=defaults(tracks.keys.key);S.chordsCustomized=false;S.chordKey=tracks.keys.key;S.leadVoice='Grand Piano'}V38.state.voice=hidden.has(S.leadVoice)?'Grand Piano':S.leadVoice;persist();setTimeout(()=>window.MB_V39?.decorate?.(),0);return out};
V.newProject=function(){releaseKeys();window.MB_V39?.stopLead?.();const out=baseNew();Object.assign(S,{transpose:{keys:0,bass:0},chords:defaults(tracks.keys.key),chordsCustomized:false,chordKey:tracks.keys.key,slide:true,glideMs:85,pitchRange:2,pitchBend:0,mod:0,leadVoice:'Grand Piano'});V38.state.voice='Grand Piano';persist();setTimeout(()=>window.MB_V39?.decorate?.(),0);return out};
function monitor(){if(!ctx)return;if(S.keyLatch&&!V.extra.latchKeys){stopKey(S.keyLatch);S.keyLatch=null}if(S.bassLatch&&!V.extra.latchBass){stopBass(S.bassLatch);S.bassLatch=null}for(const h of [...S.keyPointers.values(),...(S.keyLatch?[S.keyLatch]:[])]){if(!h.meta&&L.recordingLane==='keys')h.meta=meta(ctx.currentTime);if(h.meta&&!h.captured&&ctx.currentTime>=h.meta.boundary-.002){if(S.keyLatch===h){capture(h,h.meta.boundary)}else{stopKey(h,h.meta.boundary);for(const [id,z] of S.keyPointers)if(z===h)S.keyPointers.delete(id)}}}for(const h of [...S.bassPointers.values(),...(S.bassLatch?[S.bassLatch]:[])]){if(!h.meta&&L.recordingLane==='bass')h.meta=metaBass(ctx.currentTime);if(h.meta&&!h.captured&&ctx.currentTime>=h.meta.boundary-.002){if(S.bassLatch===h){captureBass(h,h.meta.boundary)}else{stopBass(h,h.meta.boundary);for(const [id,z] of S.bassPointers)if(z===h)S.bassPointers.delete(id)}}}}

window.auditInstrumentPatches = async function(){
  if(typeof ensureAudio==='function') await ensureAudio();
  else if(typeof buildAudio==='function') buildAudio();
  const sm=window.MB_V39?.sampleManager;
  const V38=window.MB_V38;
  const res={
    keys:{total:0,passed:[],failed:[]},
    bass:{total:0,passed:[],failed:[]},
    lead:{total:0,passed:[],failed:[]},
    totalCount:0,
    failureCount:0,
    passed:true
  };

  const realBasses=['Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2'];
  const synthBasses=['Sub Bass','Deep Club Sub','Reese Bass','Acid Bass','FM House Bass','Pluck Bass','Future Growl','Warm Analog'];

  // Parallel preload of sampled real bass voices
  await Promise.all(realBasses.map(name=>sm?.preloadVoice?.(name,24,60)));

  for(const name of [...realBasses,...synthBasses]){
    res.bass.total++;res.totalCount++;
    try{
      if(V38?.SAMPLE_VOICES?.[name]){
        if(sm?.isVoiceReady?.(name,36)){
          res.bass.passed.push(name);
        }else{
          res.bass.failed.push({name,error:'Sample preload or decode failed'});
        }
      }else if(SOUND_PRESETS[name]){
        res.bass.passed.push(name);
      }else{
        res.bass.failed.push({name,error:'Preset not defined in SOUND_PRESETS or SAMPLE_VOICES'});
      }
    }catch(err){
      res.bass.failed.push({name,error:err.message});
    }
  }

  const standardKeys=['Studio Grand','Soft Grand','Velvet EP','Tonewheel Organ','Dream Pad'];
  const legacyKeys=['Harmonium','Tanpura Drone','Bansuri Air','Sitar Pluck'];
  const allKeys=[...standardKeys,...Object.values(window.MB_V39?.voiceGroups||{}).flat(),...legacyKeys];
  const uniqueKeys=[...new Set(allKeys)];

  // Parallel preload of sampled keys voices
  await Promise.all(uniqueKeys.filter(n=>V38?.SAMPLE_VOICES?.[n]).map(name=>sm?.preloadVoice?.(name,48,72)));

  for(const name of uniqueKeys){
    res.keys.total++;res.totalCount++;
    try{
      if(V38?.SAMPLE_VOICES?.[name]){
        if(sm?.isVoiceReady?.(name,60)){
          res.keys.passed.push(name);
        }else{
          res.keys.failed.push({name,error:'Sample preload or decode failed'});
        }
      }else if(SOUND_PRESETS[name]){
        res.keys.passed.push(name);
      }else{
        res.keys.failed.push({name,error:'Preset not defined'});
      }
    }catch(err){
      res.keys.failed.push({name,error:err.message});
    }
  }

  const leadVoices=[...new Set(Object.values(window.MB_V39?.voiceGroups||{}).flat())];
  for(const name of leadVoices){
    res.lead.total++;res.totalCount++;
    try{
      if(V38?.SAMPLE_VOICES?.[name]){
        if(sm?.isVoiceReady?.(name,60)){
          res.lead.passed.push(name);
        }else{
          res.lead.failed.push({name,error:'Sample preload or decode failed'});
        }
      }else if(SOUND_PRESETS[name]){
        res.lead.passed.push(name);
      }else{
        res.lead.failed.push({name,error:'Preset not defined'});
      }
    }catch(err){
      res.lead.failed.push({name,error:err.message});
    }
  }

  res.failureCount=res.bass.failed.length+res.keys.failed.length+res.lead.failed.length;
  res.passed=res.failureCount===0;
  return res;
};

window.MB_V39={version:'v39',V,api,V38,state:S,SAMPLES,voiceGroups,hidden,chordTypes,clamp,persist,releaseKeys,releaseBass,setTranspose,decorateCore:decorate,monitor,carryForwardRecord,onFinishRecording,clearLanePerformance,triggerPadDown,triggerPadUp,startChordOnPad,startBassOnPad,stopKey,stopBass,collapseState,applyCollapse,toggleCollapse,getUICollapse,setUICollapse,auditInstrumentPatches:window.auditInstrumentPatches};persist();
})();