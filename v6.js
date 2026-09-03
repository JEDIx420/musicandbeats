/* Music & Beats V6 — Guitar Rig, editable Smart Keys, Arp Lab and Tracks timeline. */
const V6_CHORD_TYPES=[
  ['major','Major'],['minor','Minor'],['dim','Diminished'],['aug','Augmented'],['sus2','Sus2'],['sus4','Sus4'],
  ['6','6th'],['m6','Minor 6'],['7','Dominant 7'],['maj7','Major 7'],['m7','Minor 7'],['dim7','Dim 7'],['m7b5','m7♭5'],
  ['add9','Add 9'],['9','Dominant 9'],['maj9','Major 9'],['m9','Minor 9'],['11','11th'],['m11','Minor 11'],['13','13th'],['m13','Minor 13']
];
const V6_CHORD_INTERVALS={
  major:[0,4,7],minor:[0,3,7],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],
  '6':[0,4,7,9],m6:[0,3,7,9],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],dim7:[0,3,6,9],m7b5:[0,3,6,10],
  add9:[0,4,7,14],'9':[0,4,7,10,14],maj9:[0,4,7,11,14],m9:[0,3,7,10,14],
  '11':[0,4,7,10,14,17],m11:[0,3,7,10,14,17],'13':[0,4,7,10,14,17,21],m13:[0,3,7,10,14,17,21]
};
const V6_GUITAR_PATCHES={
  'Clean Glass':{trim:.92,tone:9000,output:.88,drive:{on:false,amount:.08},chorus:{on:true,amount:.13},delay:{on:false,amount:.10},reverb:{on:true,amount:.16}},
  'Warm Combo':{trim:.96,tone:5600,output:.90,drive:{on:true,amount:.12},chorus:{on:false,amount:.08},delay:{on:false,amount:.08},reverb:{on:true,amount:.12}},
  'Edge Crunch':{trim:.92,tone:6100,output:.82,drive:{on:true,amount:.38},chorus:{on:false,amount:.06},delay:{on:false,amount:.08},reverb:{on:true,amount:.08}},
  'Arena Lead':{trim:.88,tone:6800,output:.76,drive:{on:true,amount:.64},chorus:{on:false,amount:.08},delay:{on:true,amount:.25},reverb:{on:true,amount:.18}},
  'Ambient Swell':{trim:.98,tone:7200,output:.86,drive:{on:false,amount:.05},chorus:{on:true,amount:.28},delay:{on:true,amount:.39},reverb:{on:true,amount:.48}},
  'Worship Shimmer':{trim:.95,tone:8400,output:.84,drive:{on:false,amount:.05},chorus:{on:true,amount:.22},delay:{on:true,amount:.31},reverb:{on:true,amount:.55}}
};
let v6PlaySmartKeys=null,v6PlaySmartKeyPreset='C';
const v6Edit={play:false,record:false};
const v6Arp={enabled:false,mode:'up',rate:'1/8',octaves:1,gate:.62,latch:false,target:null,timer:null,index:0,nextAt:0,voices:[]};
let v6GuitarStream=null,v6GuitarMediaSource=null,v6GuitarMeterRAF=0,v6GuitarNodes=null;
const v6GuitarState={patch:'Clean Glass',deviceId:'',connected:false,monitor:false,trim:.92,tone:9000,output:.88,pedals:{drive:{on:false,amount:.08},chorus:{on:true,amount:.13},delay:{on:false,amount:.10},reverb:{on:true,amount:.16}}};
let v6TimelineOpen=true;

function v6Clone(x){return JSON.parse(JSON.stringify(x))}
function v6DefaultSmartKeys(key='C'){
  return chordData(key).map(c=>({root:c.name,type:c.quality==='minor'?'minor':c.quality==='dim'?'dim':'major',roman:c.roman}));
}
function v6LayerSmartKeys(layer){
  if(!layer.smartKeys)layer.smartKeys=v6DefaultSmartKeys(layer.key||'C');
  return layer.smartKeys;
}
function v6ChordSuffix(type){return({major:'',minor:'m',dim:'°',aug:'+',sus2:'sus2',sus4:'sus4','6':'6',m6:'m6','7':'7',maj7:'maj7',m7:'m7',dim7:'°7',m7b5:'m7♭5',add9:'add9','9':'9',maj9:'maj9',m9:'m9','11':'11',m11:'m11','13':'13',m13:'m13'})[type]||type}
function v6ChordLabel(chord){return`${FLAT[chord.root]||chord.root}${v6ChordSuffix(chord.type)}`}
function v6ChordTypeLabel(type){return V6_CHORD_TYPES.find(x=>x[0]===type)?.[1]||type}
function v6ChordNotes(chord,voicing='close',octave=3){const base=noteMidi(chord.root,octave),ints=voiced(V6_CHORD_INTERVALS[chord.type]||V6_CHORD_INTERVALS.major,voicing);return ints.map(i=>base+i)}
function v6StartSmartChord(chord,{voicing='close',octave=3,preset='Studio Grand',velocity=.77}={}){return v6ChordNotes(chord,voicing,octave).map((m,i)=>startVoice(m,preset,velocity-Math.min(i*.03,.19)))}

function v6SmartSetFor(id){
  if(id==='#playChords'){if(!v6PlaySmartKeys)v6PlaySmartKeys=v6DefaultSmartKeys(v6PlaySmartKeyPreset);return v6PlaySmartKeys}
  const l=session.layers.length?sessionLayer():null;return l?v6LayerSmartKeys(l):v6DefaultSmartKeys('C');
}
function v6SmartEditMode(id){return id==='#playChords'?v6Edit.play:v6Edit.record}
function v6SmartContext(id,opts={}){
  if(id==='#playChords')return{voicing:$('#playVoicing')?.value||opts.voicing||'close',octave:+($('#playOctave')?.value||opts.octave||3),preset:$('#playSound')?.value||opts.preset||'Studio Grand'};
  const l=session.layers.length?sessionLayer():null;return{voicing:l?.voicing||opts.voicing||'close',octave:l?.octave||opts.octave||3,preset:l?.sound||opts.preset||'Studio Grand'};
}
function v6SmartOptions(values,current){return values.map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${label}</option>`).join('')}
function v6RootOptions(current){return NOTES.map(n=>`<option value="${n}" ${n===current?'selected':''}>${FLAT[n]||n}</option>`).join('')}

function v6RateMs(){const bpm=clamp(+($('#playBpm')?.value||100),40,220);return({'1/4':60000/bpm,'1/8':30000/bpm,'1/16':15000/bpm,'1/8T':20000/bpm})[v6Arp.rate]||30000/bpm}
function v6ArpSequence(target){
  const base=v6ChordNotes(target.chord,target.voicing||'close',target.octave),seq=[];
  for(let o=0;o<v6Arp.octaves;o++)base.forEach(m=>seq.push(m+12*o));
  if(v6Arp.mode==='down')return seq.slice().reverse();
  if(v6Arp.mode==='updown'&&seq.length>2)return[...seq,...seq.slice(1,-1).reverse()];
  return seq;
}
function v6PaintArp(index=-1){$$('.v6-arp-lane').forEach((el,i)=>el.classList.toggle('hot',i===index%8))}
function v6StopArp(force=true){
  if(!force&&v6Arp.latch)return;
  clearTimeout(v6Arp.timer);v6Arp.timer=null;v6Arp.voices.forEach(v=>v.stop());v6Arp.voices=[];
  v6Arp.target?.pad?.classList.remove('arp-active');v6Arp.target=null;v6Arp.index=0;v6PaintArp(-1);
}
function v6ArpTick(){
  if(!v6Arp.enabled||!v6Arp.target)return;
  const seq=v6ArpSequence(v6Arp.target);if(!seq.length)return;
  let midi=v6Arp.mode==='random'?seq[Math.floor(Math.random()*seq.length)]:seq[v6Arp.index%seq.length];
  const step=v6RateMs(),voice=startVoice(midi,v6Arp.target.preset,.74);v6Arp.voices.push(voice);setTimeout(()=>{voice.stop();v6Arp.voices=v6Arp.voices.filter(v=>v!==voice)},Math.max(35,step*v6Arp.gate));
  v6PaintArp(v6Arp.index);v6Arp.index++;v6Arp.nextAt+=step;v6Arp.timer=setTimeout(v6ArpTick,Math.max(5,v6Arp.nextAt-performance.now()));
}
function v6StartArp(target){
  v6StopArp(true);v6Arp.target=target;target.pad?.classList.add('arp-active');v6Arp.index=0;v6Arp.nextAt=performance.now()+10;v6Arp.timer=setTimeout(v6ArpTick,10);
}

const v6BaseRenderChordPads=renderChordPads;
renderChordPads=function(id,opts={}){
  if(id!=='#playChords'&&id!=='#recordChords')return v6BaseRenderChordPads(id,opts);
  const el=$(id);if(!el)return;const set=v6SmartSetFor(id),editing=v6SmartEditMode(id),ctxx=v6SmartContext(id,opts);el.classList.add('v6-smartkeys');
  if(editing){
    el.innerHTML=`<div class="v6-smart-edit-grid">${set.map((c,i)=>`<div class="v6-smart-editor" data-index="${i}"><kbd>${i+1}</kbd><div class="v6-editor-name">${v6ChordLabel(c)}</div><label>Root<select data-smart-root>${v6RootOptions(c.root)}</select></label><label>Chord<select data-smart-type>${v6SmartOptions(V6_CHORD_TYPES,c.type)}</select></label></div>`).join('')}</div>`;
    el.querySelectorAll('.v6-smart-editor').forEach(card=>{const i=+card.dataset.index,root=card.querySelector('[data-smart-root]'),type=card.querySelector('[data-smart-type]'),refresh=()=>{set[i].root=root.value;set[i].type=type.value;set[i].roman='Custom';card.querySelector('.v6-editor-name').textContent=v6ChordLabel(set[i])};root.addEventListener('change',refresh);type.addEventListener('change',refresh)});return;
  }
  el.innerHTML=set.map((c,i)=>`<button class="chord-pad" data-index="${i}" data-root="${c.root}" data-chord-type="${c.type}" type="button"><strong>${v6ChordLabel(c)}</strong><small>${c.roman&&c.roman!=='Custom'?c.roman:v6ChordTypeLabel(c.type)}</small><kbd class="key-map-badge">${i+1}</kbd></button>`).join('');
  el.classList.toggle('mini-chords',!!opts.mini);
  el.querySelectorAll('.chord-pad').forEach(b=>{
    const chord=set[+b.dataset.index];
    b.addEventListener('pointerdown',e=>{e.preventDefault();
      if(id==='#playChords'&&v6Arp.enabled){v6StartArp({chord,pad:b,preset:ctxx.preset,octave:ctxx.octave,voicing:ctxx.voicing});try{b.setPointerCapture(e.pointerId)}catch{};return}
      const vs=v6StartSmartChord(chord,ctxx);chordVoices.set(e.pointerId,vs);b.classList.add('active');try{b.setPointerCapture(e.pointerId)}catch{}
    });
    const end=e=>{if(id==='#playChords'&&v6Arp.enabled){if(!v6Arp.latch)v6StopArp(true);b.classList.remove('active');return}const vs=chordVoices.get(e.pointerId);if(!vs)return;vs.forEach(v=>v.stop());chordVoices.delete(e.pointerId);b.classList.remove('active')};
    b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);b.addEventListener('lostpointercapture',end);
  });
};

/* Keep V5 number-row mapping, but use fully custom Smart Key chord definitions and optional arp. */
v5TriggerNumberChord=function(index){
  if(v5NumberChordVoices.has(index))return true;const c=v5CurrentChordContext(),pad=c?.host?.querySelectorAll('.chord-pad')?.[index];if(!c||!pad)return false;
  const set=v6SmartSetFor(c.host.id==='playChords'?'#playChords':'#recordChords'),chord=set[index];if(!chord)return false;primeAudio();
  if(c.host.id==='playChords'&&v6Arp.enabled){v6StartArp({chord,pad,preset:c.preset,octave:c.octave,voicing:c.voicing});v5NumberChordVoices.set(index,{arp:true,pad});return true}
  const voices=v6StartSmartChord(chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});pad.classList.add('active','keyboard-active');v5NumberChordVoices.set(index,{voices,pad});return true;
};
v5ReleaseNumberChord=function(index){const hit=v5NumberChordVoices.get(index);if(!hit)return;if(hit.arp){if(!v6Arp.latch)v6StopArp(true);hit.pad.classList.remove('keyboard-active');v5NumberChordVoices.delete(index);return}hit.voices?.forEach(v=>v.stop());hit.pad?.classList.remove('active','keyboard-active');v5NumberChordVoices.delete(index)};

function v6SmartToolbar(id){
  const host=$(id);if(!host||host.previousElementSibling?.classList.contains('v6-smart-toolbar'))return;const play=id==='#playChords',toolbar=document.createElement('div');toolbar.className='v6-smart-toolbar';
  toolbar.innerHTML=`<div><button class="v6-edit-smart ${(play?v6Edit.play:v6Edit.record)?'active':''}" type="button">${(play?v6Edit.play:v6Edit.record)?'Done editing':'Edit chords'}</button><button class="v6-reset-smart" type="button">Reset from key</button></div><small>Each pad is independent • keyboard 1–7</small>`;host.before(toolbar);
  toolbar.querySelector('.v6-edit-smart').addEventListener('click',()=>{if(play)v6Edit.play=!v6Edit.play;else v6Edit.record=!v6Edit.record;renderPlayInstrumentIfNeeded(id);if(!play)renderLayerTools()});
  toolbar.querySelector('.v6-reset-smart').addEventListener('click',()=>{if(play){v6PlaySmartKeyPreset=$('#playKey')?.value||'C';v6PlaySmartKeys=v6DefaultSmartKeys(v6PlaySmartKeyPreset);v6Edit.play=false;renderPlayInstrument()}else{const l=sessionLayer();l.smartKeys=v6DefaultSmartKeys(l.key||'C');v6Edit.record=false;renderLayerTools()}});
}
function renderPlayInstrumentIfNeeded(id){if(id==='#playChords')renderPlayInstrument()}
function v6EnhancePlaySmartKeys(){
  const flavor=$('#playChordFlavor');if(flavor)flavor.closest('label')?.classList.add('v6-hidden-control');const key=$('#playKey');if(key){const label=key.closest('label');if(label&&label.firstChild?.nodeType===3)label.firstChild.textContent='Key preset';if(key.dataset.v6!=='1'){key.dataset.v6='1';key.addEventListener('change',()=>{v6PlaySmartKeyPreset=key.value;v6PlaySmartKeys=v6DefaultSmartKeys(key.value);v6Edit.play=false;setTimeout(renderPlayInstrument,0)})}}
  v6SmartToolbar('#playChords');renderChordPads('#playChords',{key:key?.value||'C',voicing:$('#playVoicing')?.value||'close',octave:+($('#playOctave')?.value||3),preset:$('#playSound')?.value||'Studio Grand'});
}
function v6EnhanceRecordSmartKeys(){
  if(currentScreen!=='record'||!session.layers.length||sessionLayer().source!=='chords')return;const flavor=$('#recordChordFlavor');if(flavor)flavor.closest('label')?.classList.add('v6-hidden-control');const key=$('#recordKey'),l=sessionLayer();if(key){const label=key.closest('label');if(label&&label.firstChild?.nodeType===3)label.firstChild.textContent='Key preset';if(key.dataset.v6!=='1'){key.dataset.v6='1';key.addEventListener('change',()=>{l.key=key.value;l.smartKeys=v6DefaultSmartKeys(key.value);v6Edit.record=false;renderLayerTools()})}}
  v6SmartToolbar('#recordChords');renderChordPads('#recordChords',{key:l.key||'C',voicing:l.voicing||'close',octave:l.octave||3,preset:l.sound||'Studio Grand',mini:false});
}

function v6DriveCurve(amount=0){const n=1024,c=new Float32Array(n),k=Math.max(0,amount)*420;for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=amount<.01?x:((3+k)*x*20*Math.PI/180)/(Math.PI+k*Math.abs(x))}return c}
function v6EnsureGuitarGraph(){
  buildAudio();if(v6GuitarNodes)return v6GuitarNodes;const n={};n.input=ctx.createGain();n.analyser=ctx.createAnalyser();n.analyser.fftSize=512;n.hp=ctx.createBiquadFilter();n.hp.type='highpass';n.hp.frequency.value=68;n.drive=ctx.createWaveShaper();n.drive.oversample='4x';n.tone=ctx.createBiquadFilter();n.tone.type='lowpass';n.comp=ctx.createDynamicsCompressor();n.comp.threshold.value=-18;n.comp.ratio.value=3;n.comp.attack.value=.006;n.comp.release.value=.12;n.dry=ctx.createGain();n.chorusDelay=ctx.createDelay(.06);n.chorusWet=ctx.createGain();n.chorusLfo=ctx.createOscillator();n.chorusDepth=ctx.createGain();n.chorusLfo.frequency.value=.7;n.chorusDepth.gain.value=.0045;n.chorusLfo.connect(n.chorusDepth).connect(n.chorusDelay.delayTime);n.chorusLfo.start();n.delay=ctx.createDelay(1.2);n.feedback=ctx.createGain();n.delayWet=ctx.createGain();n.reverb=ctx.createConvolver();n.reverb.buffer=createImpulse();n.reverbWet=ctx.createGain();n.bus=ctx.createGain();n.monitor=ctx.createGain();n.input.connect(n.analyser).connect(n.hp).connect(n.drive).connect(n.tone).connect(n.comp);n.comp.connect(n.dry).connect(n.bus);n.comp.connect(n.chorusDelay).connect(n.chorusWet).connect(n.bus);n.comp.connect(n.delay);n.delay.connect(n.delayWet).connect(n.bus);n.delay.connect(n.feedback).connect(n.delay);n.comp.connect(n.reverb).connect(n.reverbWet).connect(n.bus);n.bus.connect(n.monitor).connect(master);v6GuitarNodes=n;v6ApplyGuitarState();return n;
}
function v6ApplyGuitarState(){
  if(!v6GuitarNodes)return;const n=v6GuitarNodes,s=v6GuitarState;n.input.gain.setTargetAtTime(s.trim,ctx.currentTime,.02);n.tone.frequency.setTargetAtTime(s.tone,ctx.currentTime,.02);n.bus.gain.setTargetAtTime(s.output,ctx.currentTime,.02);n.drive.curve=v6DriveCurve(s.pedals.drive.on?s.pedals.drive.amount:0);n.chorusWet.gain.setTargetAtTime(s.pedals.chorus.on?s.pedals.chorus.amount*.7:0,ctx.currentTime,.02);n.chorusDepth.gain.setTargetAtTime(.001+s.pedals.chorus.amount*.012,ctx.currentTime,.02);n.delay.delayTime.setTargetAtTime(.18+s.pedals.delay.amount*.48,ctx.currentTime,.02);n.feedback.gain.setTargetAtTime(s.pedals.delay.on?Math.min(.62,.12+s.pedals.delay.amount*.55):0,ctx.currentTime,.02);n.delayWet.gain.setTargetAtTime(s.pedals.delay.on?s.pedals.delay.amount*.62:0,ctx.currentTime,.02);n.reverbWet.gain.setTargetAtTime(s.pedals.reverb.on?s.pedals.reverb.amount*.82:0,ctx.currentTime,.02);n.monitor.gain.setTargetAtTime(s.monitor?.9:0,ctx.currentTime,.02)
}
function v6ApplyGuitarPatch(name){const p=V6_GUITAR_PATCHES[name];if(!p)return;v6GuitarState.patch=name;v6GuitarState.trim=p.trim;v6GuitarState.tone=p.tone;v6GuitarState.output=p.output;v6GuitarState.pedals=v6Clone({drive:p.drive,chorus:p.chorus,delay:p.delay,reverb:p.reverb});v6ApplyGuitarState();v6SyncGuitarUIs()}
async function v6ListGuitarDevices(){if(!navigator.mediaDevices?.enumerateDevices)return[];try{return(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput')}catch{return[]}}
async function v6ConnectGuitar(deviceId=''){
  await ensureAudio();v6EnsureGuitarGraph();try{if(v6GuitarMediaSource)try{v6GuitarMediaSource.disconnect()}catch{};if(v6GuitarStream)v6GuitarStream.getTracks().forEach(t=>t.stop());const audio={echoCancellation:false,noiseSuppression:false,autoGainControl:false};if(deviceId)audio.deviceId={exact:deviceId};v6GuitarStream=await navigator.mediaDevices.getUserMedia({audio});v6GuitarMediaSource=ctx.createMediaStreamSource(v6GuitarStream);v6GuitarMediaSource.connect(v6GuitarNodes.input);v6GuitarState.connected=true;v6GuitarState.deviceId=v6GuitarStream.getAudioTracks()[0]?.getSettings()?.deviceId||deviceId||'';await v6PopulateGuitarDeviceMenus();v6StartGuitarMeter();v6SyncGuitarUIs();return true}catch(e){console.warn('Guitar input failed',e);v6GuitarState.connected=false;v6SyncGuitarUIs();return false}
}
async function v6PopulateGuitarDeviceMenus(){const devs=await v6ListGuitarDevices();$$('[data-guitar-device]').forEach(sel=>{const current=v6GuitarState.deviceId||sel.value;sel.innerHTML=`<option value="">Default audio input</option>${devs.map((d,i)=>`<option value="${d.deviceId}" ${d.deviceId===current?'selected':''}>${d.label||`Audio input ${i+1}`}</option>`).join('')}`;if(current)sel.value=current})}
function v6StartGuitarMeter(){cancelAnimationFrame(v6GuitarMeterRAF);if(!v6GuitarNodes)return;const data=new Uint8Array(v6GuitarNodes.analyser.fftSize),tick=()=>{v6GuitarNodes.analyser.getByteTimeDomainData(data);let sum=0,peak=0;for(const v of data){const x=(v-128)/128;sum+=x*x;peak=Math.max(peak,Math.abs(x))}const rms=Math.sqrt(sum/data.length),dbv=rms?20*Math.log10(rms):-60,pct=clamp((dbv+60)/60,0,1)*100;$$('.v6-meter-fill').forEach(e=>e.style.width=`${pct}%`);$$('.v6-meter-db').forEach(e=>e.textContent=`${Math.round(dbv)} dB`);$$('.v6-signal-state').forEach(e=>{e.classList.toggle('live',rms>.012);e.textContent=peak>.94?'Clipping':rms>.03?'Signal good':rms>.012?'Signal detected':'Waiting for signal'});v6GuitarMeterRAF=requestAnimationFrame(tick)};tick()}
function v6PedalMarkup(name){const s=v6GuitarState.pedals[name],title=name==='reverb'?'Space':name[0].toUpperCase()+name.slice(1);return`<div class="v6-pedal ${s.on?'on':''}" data-pedal="${name}"><div class="v6-pedal-head"><strong>${title}</strong><i class="v6-pedal-light"></i></div><input data-pedal-amount type="range" min="0" max="1" step=".01" value="${s.amount}"><button data-pedal-toggle type="button">${s.on?'ON':'BYPASS'}</button></div>`}
function v6GuitarMarkup(context='play'){
  return`<div class="v6-guitar-rig ${context==='record'?'v6-record-guitar':''}" data-guitar-rig="${context}"><div class="v6-guitar-hero"><div><small>CONNECTED GUITAR RIG</small><strong>${v6GuitarState.patch}</strong></div><span class="v6-signal-state ${v6GuitarState.connected?'live':''}">${v6GuitarState.connected?'Waiting for signal':'Input not connected'}</span></div><div class="v6-guitar-connect"><label>Audio input<select data-guitar-device><option value="">Default audio input</option></select></label><button data-guitar-connect type="button">${v6GuitarState.connected?'Reconnect':'Connect guitar'}</button><button data-guitar-monitor class="${v6GuitarState.monitor?'active':''}" type="button">Monitor ${v6GuitarState.monitor?'ON':'OFF'}</button></div><div class="v6-guitar-meter"><span>INPUT</span><div class="v6-meter-track"><div class="v6-meter-fill"></div></div><span class="v6-meter-db">−60 dB</span></div><div class="v6-patch-row"><label>Amp patch<select data-guitar-patch>${Object.keys(V6_GUITAR_PATCHES).map(n=>`<option ${n===v6GuitarState.patch?'selected':''}>${n}</option>`).join('')}</select></label><div class="v6-knob"><span>Input <b>${Math.round(v6GuitarState.trim*100)}%</b></span><input data-guitar-param="trim" type="range" min="0.35" max="1.4" step=".01" value="${v6GuitarState.trim}"></div><div class="v6-knob"><span>Tone <b>${(v6GuitarState.tone/1000).toFixed(1)}k</b></span><input data-guitar-param="tone" type="range" min="1800" max="12000" step="100" value="${v6GuitarState.tone}"></div><div class="v6-knob"><span>Output <b>${Math.round(v6GuitarState.output*100)}%</b></span><input data-guitar-param="output" type="range" min="0" max="1.2" step=".01" value="${v6GuitarState.output}"></div></div><div class="v6-pedalboard">${['drive','chorus','delay','reverb'].map(v6PedalMarkup).join('')}</div></div>`
}
function v6BindGuitarRig(root){if(!root||root.dataset.v6bound==='1')return;root.dataset.v6bound='1';const dev=root.querySelector('[data-guitar-device]');root.querySelector('[data-guitar-connect]')?.addEventListener('click',async()=>{const ok=await v6ConnectGuitar(dev?.value||'');if(!ok)alert('Could not access the guitar input. Check browser microphone/audio permissions and your interface connection.')});root.querySelector('[data-guitar-monitor]')?.addEventListener('click',()=>{v6GuitarState.monitor=!v6GuitarState.monitor;v6ApplyGuitarState();v6SyncGuitarUIs()});root.querySelector('[data-guitar-patch]')?.addEventListener('change',e=>v6ApplyGuitarPatch(e.target.value));root.querySelectorAll('[data-guitar-param]').forEach(inp=>inp.addEventListener('input',()=>{const k=inp.dataset.guitarParam;v6GuitarState[k]=+inp.value;v6ApplyGuitarState();v6SyncGuitarUIs(root)}));root.querySelectorAll('.v6-pedal').forEach(p=>{const name=p.dataset.pedal;p.querySelector('[data-pedal-toggle]').addEventListener('click',()=>{v6GuitarState.pedals[name].on=!v6GuitarState.pedals[name].on;v6ApplyGuitarState();v6SyncGuitarUIs()});p.querySelector('[data-pedal-amount]').addEventListener('input',e=>{v6GuitarState.pedals[name].amount=+e.target.value;v6ApplyGuitarState();v6SyncGuitarUIs(p)})});v6PopulateGuitarDeviceMenus()}
function v6SyncGuitarUIs(skip=null){$$('.v6-guitar-rig').forEach(root=>{if(root===skip)return;const state=root.querySelector('.v6-signal-state');if(state&&!v6GuitarState.connected){state.classList.remove('live');state.textContent='Input not connected'}const patch=root.querySelector('[data-guitar-patch]');if(patch)patch.value=v6GuitarState.patch;const mon=root.querySelector('[data-guitar-monitor]');if(mon){mon.classList.toggle('active',v6GuitarState.monitor);mon.textContent=`Monitor ${v6GuitarState.monitor?'ON':'OFF'}`}root.querySelectorAll('[data-guitar-param]').forEach(inp=>{inp.value=v6GuitarState[inp.dataset.guitarParam];const b=inp.closest('.v6-knob')?.querySelector('b');if(b)b.textContent=inp.dataset.guitarParam==='tone'?`${(v6GuitarState.tone/1000).toFixed(1)}k`:`${Math.round(v6GuitarState[inp.dataset.guitarParam]*100)}%`});root.querySelectorAll('.v6-pedal').forEach(p=>{const s=v6GuitarState.pedals[p.dataset.pedal];p.classList.toggle('on',s.on);p.querySelector('[data-pedal-amount]').value=s.amount;p.querySelector('[data-pedal-toggle]').textContent=s.on?'ON':'BYPASS'})});v6PopulateGuitarDeviceMenus()}

const v6BaseGetLayerBus=typeof getLayerBus==='function'?getLayerBus:null;
if(v6BaseGetLayerBus)getLayerBus=function(layer){if(layer?.source==='guitar'){v6EnsureGuitarGraph();return v6GuitarNodes.bus}return v6BaseGetLayerBus(layer)};

function v6RenderPlayGuitar(){
  const panel=$('#playScreen .instrument-panel');if(!panel)return;panel.classList.remove('v6-smart-mode','v6-bass-mode');panel.classList.add('v6-guitar-mode');panel.querySelector('.panel-head h2').textContent='Guitar rig';panel.querySelector('.panel-kicker').textContent='LIVE INPUT';$$('#playScreen .instrument-tab').forEach(b=>b.classList.toggle('active',b.dataset.instrument==='guitar'));let rig=panel.querySelector('.v6-play-guitar');if(!rig){rig=document.createElement('div');rig.className='v6-play-guitar';panel.querySelector('.instrument-tabs').after(rig)}rig.innerHTML=v6GuitarMarkup('play');v6BindGuitarRig(rig.querySelector('.v6-guitar-rig'));v6SyncGuitarUIs();v6UpdateArpPanelState()
}
const v6BaseRenderPlayInstrument=renderPlayInstrument;
renderPlayInstrument=function(){
  v6StopArp(true);if(playInstrument==='guitar'){v6RenderPlayGuitar();return}
  const out=v6BaseRenderPlayInstrument(),panel=$('#playScreen .instrument-panel');panel?.classList.remove('v6-guitar-mode','v6-smart-mode','v6-bass-mode');if(playInstrument==='chords'){panel?.classList.add('v6-smart-mode');if(panel)panel.querySelector('.panel-head h2').textContent='Smart Keys';v6EnhancePlaySmartKeys()}else if(playInstrument==='bass'){panel?.classList.add('v6-bass-mode');if(panel)panel.querySelector('.panel-head h2').textContent='Bass'}v6UpdateArpPanelState();return out
};

const v6BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){
  const l=session.layers.length?sessionLayer():null;if(l?.source==='guitar'){l.sourceLabel='Guitar';const host=$('#layerSourceTools');host.innerHTML=`<div class="tool-box">${v6GuitarMarkup('record')}<p class="dialog-note">Your amp patch and pedal chain are printed into this layer. Pedal changes you make while recording are captured in the take.</p></div>`;v6BindGuitarRig(host.querySelector('.v6-guitar-rig'));v6SyncGuitarUIs();$('#recordLayerBtn').disabled=false;updateRecordDisplay('READY','—',v6GuitarState.connected?'Guitar ready — record when you are set':'Connect your guitar input, test the meter, then record');return}
  const out=v6BaseRenderLayerTools();if(l?.source==='chords')setTimeout(v6EnhanceRecordSmartKeys,0);return out
};

async function v6CaptureLayer(){const l=sessionLayer();if(l?.source==='guitar'){if(!v6GuitarState.connected){const sel=$('#layerSourceTools [data-guitar-device]');const ok=await v6ConnectGuitar(sel?.value||'');if(!ok){updateRecordDisplay('GUITAR','!','Connect or allow your guitar input first');return}}l.guitarRig=v6Clone(v6GuitarState)}return v4CaptureLayer()}
function v6InstallRecordTransport(){if(typeof v4ReplaceButton!=='function')return;v4ReplaceButton('#recordLayerBtn',v6CaptureLayer);v4ReplaceButton('#redoLayerBtn',()=>{if(recordBusy)return;clearCurrentLayer();v6CaptureLayer()});v4ReplaceButton('#playSessionBtn',v4PlayAligned)}

function v6Waveform(layer,n=70){if(!layer?.buffer)return'';try{const data=layer.buffer.getChannelData(0),step=Math.max(1,Math.floor(data.length/n)),bars=[];for(let i=0;i<n;i++){let peak=0,start=i*step,end=Math.min(data.length,start+step);for(let j=start;j<end;j+=Math.max(1,Math.floor(step/22)))peak=Math.max(peak,Math.abs(data[j]));bars.push(`<i style="height:${Math.max(6,Math.round(peak*100))}%"></i>`)}return bars.join('')}catch{return''}}
function v6SourceIcon(s){return({input:'🎙',guitar:'🎸',chords:'⌨',bass:'♩',beats:'🥁',keys:'⌨'})[s]||'＋'}
function v6RenderTimeline(){
  const panel=$('#v6TimelinePanel');if(!panel||!session.layers?.length)return;panel.hidden=!v6TimelineOpen;const bars=session.bars||4,duration=barSeconds(bars,session.bpm||100);panel.style.setProperty('--loop-duration',`${duration}s`);const ruler=Array.from({length:bars},(_,i)=>`<div class="v6-bar-mark">${i+1}</div>`).join('');panel.querySelector('.v6-timeline').innerHTML=`<div class="v6-ruler-row"><div class="v6-ruler-head">TRACKS</div><div class="v6-ruler" style="grid-template-columns:repeat(${bars},minmax(82px,1fr))">${ruler}</div></div>${session.layers.map((l,i)=>`<div class="v6-track-row" data-track="${i}"><div class="v6-track-header ${i===session.current?'current':''}"><span class="v6-track-icon">${v6SourceIcon(l.source)}</span><span class="v6-track-copy"><strong>${l.name||`Layer ${i+1}`}</strong><small>${l.sourceLabel||'Empty'}${l.muted?' • muted':''}</small></span></div><div class="v6-track-canvas" style="--bars:${bars}">${l.buffer?`<div class="v6-region" data-source="${l.source||''}"><span class="v6-region-label">${l.sourceLabel||`Layer ${i+1}`}</span><span class="v6-waveform">${v6Waveform(l)}</span></div>`:`<div class="v6-empty-region">Empty layer</div>`}</div></div>`).join('')}<div class="v6-playhead"></div>`;panel.querySelectorAll('.v6-track-row').forEach(row=>row.addEventListener('click',()=>{if(recordBusy)return;session.current=+row.dataset.track;renderSession()}));requestAnimationFrame(()=>{const tl=panel.querySelector('.v6-timeline'),head=panel.querySelector('.v6-ruler-head')?.offsetWidth||155;panel.style.setProperty('--playhead-travel',`${Math.max(180,tl.scrollWidth-head-4)}px`)})
}
function v6InstallTimeline(){
  const screen=$('#recordScreen'),stage=screen?.querySelector('.record-stage'),top=screen?.querySelector('.record-topline');if(!screen||!stage||$('#v6TimelinePanel'))return;const toggle=document.createElement('button');toggle.id='v6TimelineToggle';toggle.className='ghost-btn v6-timeline-toggle';toggle.type='button';toggle.textContent='▤ Timeline';top?.insertBefore(toggle,$('#sessionSettingsBtn'));const panel=document.createElement('section');panel.id='v6TimelinePanel';panel.className='v6-timeline-panel';panel.innerHTML=`<div class="v6-timeline-head"><div><span class="v6-timeline-icon">▤</span><div><strong>Tracks</strong><small>Every recorded layer on the musical grid</small></div></div><div class="v6-timeline-legend"><span>Click a region to open that layer</span><span>${session.bars||4} bars</span></div></div><div class="v6-timeline"></div>`;stage.after(panel);toggle.addEventListener('click',()=>{v6TimelineOpen=!v6TimelineOpen;panel.hidden=!v6TimelineOpen;toggle.classList.toggle('active',v6TimelineOpen)});v6RenderTimeline()
}
function v6SetTimelinePlaying(on){const p=$('#v6TimelinePanel');if(p)p.classList.toggle('playing',!!on)}
if(typeof setSessionPlayingUI==='function'){const v6BaseSetSessionPlayingUI=setSessionPlayingUI;setSessionPlayingUI=function(on){const r=v6BaseSetSessionPlayingUI(on);v6SetTimelinePlaying(on);return r}}

function v6InstallArpLab(){
  $('#performancePadPanel')?.remove();const workspace=$('#playScreen .play-workspace');if(!workspace||$('#v6ArpPanel'))return;const panel=document.createElement('section');panel.id='v6ArpPanel';panel.className='panel v6-arp-panel';panel.innerHTML=`<div class="panel-head"><div><span class="panel-kicker">PATTERN ENGINE</span><h2>Arp Lab</h2><p>Turn any Smart Key into a moving pattern locked to your BPM.</p></div><button class="v6-arp-power" type="button"><i></i><span>ARP OFF</span></button></div><div class="v6-arp-body"><div class="v6-arp-visual"><span class="v6-arp-label">LIVE STEP</span><div class="v6-arp-lanes">${Array.from({length:8},()=>'<i class="v6-arp-lane"></i>').join('')}</div></div><div class="v6-arp-controls"><label>Direction<select data-arp="mode"><option value="up">Up</option><option value="down">Down</option><option value="updown">Up / Down</option><option value="random">Random</option></select></label><label>Rate<select data-arp="rate"><option>1/4</option><option selected>1/8</option><option>1/16</option><option value="1/8T">1/8 Triplet</option></select></label><label>Octaves<select data-arp="octaves"><option>1</option><option>2</option><option>3</option></select></label><label>Gate<input data-arp="gate" type="range" min="0.15" max=".98" step=".01" value="${v6Arp.gate}"></label><div class="v6-arp-toggle-row"><button data-arp-toggle="latch" type="button">Latch</button><button data-arp-action="panic" type="button">Stop</button></div><div class="v6-arp-note">Enable it, then hold a Smart Key with <kbd>1–7</kbd> or touch a chord pad. Your on-screen piano remains playable at the same time.</div></div></div>`;workspace.appendChild(panel);panel.querySelector('.v6-arp-power').addEventListener('click',()=>{v6Arp.enabled=!v6Arp.enabled;if(!v6Arp.enabled)v6StopArp(true);v6SyncArpUI()});panel.querySelectorAll('[data-arp]').forEach(el=>el.addEventListener('input',()=>{const k=el.dataset.arp;v6Arp[k]=k==='octaves'?+el.value:k==='gate'?+el.value:el.value}));panel.querySelector('[data-arp-toggle="latch"]').addEventListener('click',()=>{v6Arp.latch=!v6Arp.latch;v6SyncArpUI()});panel.querySelector('[data-arp-action="panic"]').addEventListener('click',()=>v6StopArp(true));v6SyncArpUI()
}
function v6SyncArpUI(){const p=$('#v6ArpPanel');if(!p)return;const power=p.querySelector('.v6-arp-power');power.classList.toggle('active',v6Arp.enabled);power.querySelector('span').textContent=v6Arp.enabled?'ARP ON':'ARP OFF';const latch=p.querySelector('[data-arp-toggle="latch"]');latch.classList.toggle('active',v6Arp.latch);latch.textContent=v6Arp.latch?'Latch ON':'Latch'}
function v6UpdateArpPanelState(){const p=$('#v6ArpPanel');if(!p)return;p.classList.toggle('disabled',playInstrument!=='chords');if(playInstrument!=='chords')v6StopArp(true)}

function v6PatchLabels(){
  const tabs=$$('#playScreen .instrument-tab');if(tabs[0]){tabs[0].dataset.instrument='guitar';tabs[0].textContent='Guitar'}if(tabs[1])tabs[1].textContent='Smart Keys';const panel=$('#playScreen .instrument-panel');if(panel)panel.querySelector('.panel-head h2').textContent=playInstrument==='chords'?'Smart Keys':'Performance';const playCopy=$('#playScreen .mode-header p');if(playCopy)playCopy.textContent='Pick a groove, then play guitar, Smart Keys or bass over it.';
  const chooser=$('#sourceChooser'),keys=chooser?.querySelector('[data-source="keys"]'),chords=chooser?.querySelector('[data-source="chords"]'),input=chooser?.querySelector('[data-source="input"]');if(keys){keys.dataset.source='guitar';keys.querySelector('span').textContent='🎸';keys.querySelector('strong').textContent='Guitar';keys.querySelector('small').textContent='Connected guitar • amps & pedals';if(keys.dataset.v6source!=='1'){keys.dataset.v6source='1';keys.addEventListener('click',()=>setTimeout(()=>{if(!session.layers.length)return;const l=sessionLayer();if(l.source!=='guitar'){l.source='guitar';l.sourceLabel='Guitar';renderSession()}},0))}}if(chords){chords.querySelector('strong').textContent='Smart Keys';chords.querySelector('small').textContent='Editable one-touch chords + keys'}if(input)input.querySelector('small').textContent='Mic, vocals or connected source';
  const home=$('.home-feature-row');if(home){const spans=home.querySelectorAll('span');if(spans[1])spans[1].textContent='Smart Keys';if(spans[4])spans[4].textContent='Guitar FX'}
}
function v6MigrateSession(){session.layers?.forEach(l=>{if(l.source==='keys'){l.source='chords';l.sourceLabel='Smart Keys';l.smartKeys=l.smartKeys||v6DefaultSmartKeys(l.key||'C')}if(l.source==='chords')l.sourceLabel='Smart Keys';if(l.source==='guitar')l.sourceLabel='Guitar'})}

const v6BaseRenderSession=renderSession;
renderSession=function(){v6MigrateSession();const out=v6BaseRenderSession();v6PatchLabels();setTimeout(()=>{v6EnhanceRecordSmartKeys();v6RenderTimeline()},0);return out};

function v6Init(){
  v6PatchLabels();v6MigrateSession();v6InstallArpLab();v6InstallTimeline();v6InstallRecordTransport();v6PlaySmartKeys=v6DefaultSmartKeys($('#playKey')?.value||'C');
  playInstrument='chords';$$('#playScreen .instrument-tab').forEach(b=>b.classList.toggle('active',b.dataset.instrument==='chords'));renderPlayInstrument();
  $$('#playScreen .instrument-tab').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>{v6PatchLabels();v6UpdateArpPanelState()},0)));
  $('#homeBtn')?.addEventListener('click',()=>v6StopArp(true));$$('.back-home').forEach(b=>b.addEventListener('click',()=>v6StopArp(true)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)v6StopArp(true)});window.addEventListener('blur',()=>v6StopArp(true));
  v6RenderTimeline();
}
v6Init();