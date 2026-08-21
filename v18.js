/* Music & Beats V18 — explicit global latch, wave-deck arp UI and hardware groove box. */

/* --------------------------------------------------------------------------
   Global LATCH — one explicit switch for Smart Keys and one for Bass.
   -------------------------------------------------------------------------- */
function v18ReadLatch(kind){try{return localStorage.getItem(`musicandbeats:v18:latch:${kind}`)==='1'}catch{return false}}
function v18WriteLatch(kind,on){try{localStorage.setItem(`musicandbeats:v18:latch:${kind}`,on?'1':'0')}catch{}}
const V18_LATCH={smart:v18ReadLatch('smart'),bass:v18ReadLatch('bass')};
let v18BassHeld=null;

function v18CurrentLatchKind(){
  if(currentScreen==='play')return playInstrument==='chords'?'smart':playInstrument==='bass'?'bass':null;
  if(currentScreen==='record'&&session.layers?.length)return sessionLayer().source==='chords'?'smart':sessionLayer().source==='bass'?'bass':null;
  return null;
}
function v18LatchOn(kind){return !!V18_LATCH[kind]}
function v18ReleaseBassHeld(hard=false){
  if(v18BassHeld){try{hard&&typeof v18BassHeld.voice?.hardStop==='function'?v18BassHeld.voice.hardStop():v18BassHeld.voice?.stop?.()}catch{}v18BassHeld.key?.classList.remove('active','v18-latched');v18BassHeld=null}
  if(v6Arp?.target?.kind==='bass'){try{v15HardStopArp()}catch{}}
}
function v18ReleaseSmartHeld(hard=false){try{v14ReleaseLatch(hard)}catch{}}
function v18ReleaseHeld(kind,hard=false){kind==='smart'?v18ReleaseSmartHeld(hard):v18ReleaseBassHeld(hard)}
function v18SetLatch(kind,on){
  if(!['smart','bass'].includes(kind))return;V18_LATCH[kind]=!!on;v18WriteLatch(kind,!!on);
  if(!on)v18ReleaseHeld(kind,true);
  if(v18CurrentLatchKind()===kind)v6Arp.latch=!!on;
  v18SyncLatchUI();
}
function v18LatchButton(kind){return `<button class="v18-latch-switch ${v18LatchOn(kind)?'active':''}" data-v18-latch="${kind}" type="button" aria-pressed="${v18LatchOn(kind)}"><i></i><span>LATCH</span></button>`}
function v18SyncLatchUI(){
  document.querySelectorAll('[data-v18-latch]').forEach(b=>{const on=v18LatchOn(b.dataset.v18Latch);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on))});
}
function v18InstallLatchControls(){
  document.querySelectorAll('.v6-smart-toolbar').forEach(toolbar=>{
    const row=toolbar.firstElementChild;if(!row||row.querySelector('[data-v18-latch="smart"]'))return;
    row.querySelector('.v6-reset-smart')?.insertAdjacentHTML('afterend',v18LatchButton('smart'));
    const note=toolbar.querySelector('small');if(note)note.textContent='Tap / 1–7 to play · LATCH holds the last chord';
  });
  if(currentScreen==='play'&&playInstrument==='bass'){
    const row=$('#playScreen .instrument-panel .select-row');if(row&&!row.querySelector('[data-v18-latch="bass"]'))row.insertAdjacentHTML('beforeend',`<div class="v18-latch-dock"><small>HOLD MODE</small>${v18LatchButton('bass')}</div>`);
  }
  if(currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='bass'){
    const row=$('#layerSourceTools .tool-box .tool-row');if(row&&!row.querySelector('[data-v18-latch="bass"]'))row.insertAdjacentHTML('beforeend',`<div class="v18-latch-dock compact"><small>HOLD</small>${v18LatchButton('bass')}</div>`);
  }
  v18SyncLatchUI();
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-v18-latch]');if(!b)return;e.preventDefault();e.stopPropagation();v18SetLatch(b.dataset.v18Latch,!v18LatchOn(b.dataset.v18Latch))},true);

/* V18 global latch replaces arp-specific latch state. */
const v18BaseApplyArpState=typeof v17ApplyArpState==='function'?v17ApplyArpState:null;
if(v18BaseApplyArpState)v17ApplyArpState=function(s){const out=v18BaseApplyArpState(s);const kind=v18CurrentLatchKind();v6Arp.latch=kind?v18LatchOn(kind):false;return out};

function v18PrepareSmartArp(id){
  if(id==='#playChords'){
    if(typeof v17ApplyArpState==='function')v17ApplyArpState(V17_PLAY_ARP);
    v6Arp.enabled=!!V17_PLAY_ARP.enabled;v6Arp.latch=v18LatchOn('smart');return v6Arp.enabled;
  }
  const l=session.layers?.length?sessionLayer():null;if(!l)return false;
  const state=v17LayerArp(l,'smart');v17ApplyArpState(state);v6Arp.latch=v18LatchOn('smart');return !!state.enabled;
}
function v18PrepareBassArp(context){
  if(context==='play'){v17ApplyArpState(V17_PLAY_ARP);v6Arp.enabled=!!V17_PLAY_ARP.enabled;v6Arp.latch=v18LatchOn('bass');return v6Arp.enabled}
  const l=session.layers?.length?sessionLayer():null;if(!l)return false;const state=v17LayerArp(l,'bass');v17ApplyArpState(state);v6Arp.latch=v18LatchOn('bass');return !!state.enabled;
}
function v18LatchSmartPad(pad){
  const c=v14PadContext(pad);if(!c)return false;const arp=v18PrepareSmartArp(c.id);
  v18ReleaseSmartHeld(false);primeAudio();
  if(arp){
    const target={chord:c.chord,pad:c.pad,preset:c.preset,octave:c.octave,voicing:c.voicing,index:c.index,context:c.id==='#recordChords'?'record':'play',bpm:c.id==='#recordChords'?session.bpm:clamp(+($('#playBpm')?.value||100),40,220)};
    v6Arp.latch=true;v6StartArp(target);v14Latch={...c,arp:true,voices:[]};
  }else{
    const voices=v6StartSmartChord(c.chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});v14Latch={...c,arp:false,voices};
  }
  pad.classList.add('v14-latched','v18-latched');pad.setAttribute('aria-pressed','true');return true;
}

/* Capture Smart Key taps only while explicit LATCH is ON. Normal taps keep the existing momentary handlers. */
document.addEventListener('pointerdown',e=>{
  const pad=e.target.closest?.('.chord-pad');if(!pad||!v18LatchOn('smart')||pad.closest('.v6-smart-edit-grid'))return;
  const host=pad.closest('#playChords,#recordChords');if(!host)return;
  e.preventDefault();e.stopImmediatePropagation();v18LatchSmartPad(pad);
},true);

/* Bass latch: with ARP on, let the existing Bass-Arp pointer engine run but tell it
   not to release. With ARP off, hold a single synth voice until the next note. */
document.addEventListener('pointerdown',e=>{
  const key=e.target.closest?.('.piano-key');if(!key||!v18LatchOn('bass'))return;
  const play=key.closest('#playKeyboard')&&currentScreen==='play'&&playInstrument==='bass';
  const record=key.closest('#recordKeyboard')&&currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='bass';
  if(!play&&!record)return;const context=play?'play':'record',arp=v18PrepareBassArp(context);
  if(arp){v6Arp.latch=true;return}
  e.preventDefault();e.stopImmediatePropagation();v18ReleaseBassHeld(false);primeAudio();
  const preset=record?(sessionLayer().sound||'Finger Bass'):($('#playBassSound')?.value||'Finger Bass'),voice=startVoice(+key.dataset.midi,preset,.82);
  key.classList.add('active','v18-latched');v18BassHeld={key,voice,context};
},true);

/* Number row: no double-press semantics. Global Smart LATCH is the only hold mechanism. */
v5TriggerNumberChord=function(index){
  if(v5NumberChordVoices.has(index))return true;
  const c=v5CurrentChordContext(),pad=c?.host?.querySelectorAll('.chord-pad')?.[index];if(!c||!pad)return false;
  const id=c.host.id==='playChords'?'#playChords':'#recordChords',set=v6SmartSetFor(id),chord=set?.[index];if(!chord)return false;
  if(v18LatchOn('smart'))return v18LatchSmartPad(pad);
  primeAudio();const arp=v18PrepareSmartArp(id);
  if(arp){
    const target={chord,pad,preset:c.preset,octave:c.octave,voicing:c.voicing,index,context:id==='#recordChords'?'record':'play',bpm:id==='#recordChords'?session.bpm:clamp(+($('#playBpm')?.value||100),40,220)};
    v6StartArp(target);pad.classList.add('keyboard-active');v5NumberChordVoices.set(index,{arp:true,pad,target,v18:true});return true;
  }
  const voices=v6StartSmartChord(chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});pad.classList.add('active','keyboard-active');v5NumberChordVoices.set(index,{voices,pad});return true;
};
v5ReleaseNumberChord=function(index){
  const hit=v5NumberChordVoices.get(index);if(!hit)return;v5NumberChordVoices.delete(index);
  if(hit.arp){
    hit.pad?.classList.remove('keyboard-active','active');
    const remaining=[...v5NumberChordVoices.values()].filter(x=>x.arp&&x.target);
    if(remaining.length)v6StartArp(remaining[remaining.length-1].target);else v6StopArp(true);
    return;
  }
  hit.voices?.forEach(v=>v.stop());hit.pad?.classList.remove('active','keyboard-active');
};

/* --------------------------------------------------------------------------
   Arp Lab — rectangular disco waveform + flat hardware control deck.
   -------------------------------------------------------------------------- */
function v18ArpWaveMarkup(label='MOTION'){return `<div class="v18-arp-wave" aria-hidden="true"><div class="v18-wave-grid"></div><svg viewBox="0 0 720 110" preserveAspectRatio="none"><g class="v18-wave-track"><path d="M-360 55 C-330 6 -300 6 -270 55 S-210 104 -180 55 S-120 6 -90 55 S-30 104 0 55 S60 6 90 55 S150 104 180 55 S240 6 270 55 S330 104 360 55 S420 6 450 55 S510 104 540 55 S600 6 630 55 S690 104 720 55 S780 6 810 55 S870 104 900 55 S960 6 990 55 S1050 104 1080 55"/></g></svg><span>${label}</span><i class="v18-wave-scan"></i></div>`}
function v18FlattenPlayArp(){
  const p=$('#v6ArpPanel');if(!p)return;
  try{v17UpgradePlayArp?.()}catch{}
  p.classList.add('v18-arp-machine');
  const visual=p.querySelector('.v6-arp-visual');if(visual&&!visual.querySelector('.v18-arp-wave'))visual.innerHTML=v18ArpWaveMarkup(playInstrument==='bass'?'BASS MOTION':'CHORD MOTION');
  p.querySelector('[data-arp-toggle="latch"]')?.remove();p.querySelector('.v6-arp-note')?.remove();
  const controls=p.querySelector('.v6-arp-controls');if(controls){
    controls.classList.add('v18-arp-deck');
    const adv=p.querySelector('.v17-arp-advanced'),grid=adv?.querySelector('.v17-arp-advanced-grid');
    if(grid){[...grid.children].forEach(node=>controls.appendChild(node));adv.remove()}
    const row=controls.querySelector('.v6-arp-toggle-row');if(row){const stop=row.querySelector('[data-arp-action="panic"]');if(stop){stop.classList.add('v18-arp-stop');controls.appendChild(stop)}row.remove()}
  }
  const title=p.querySelector('.panel-head h2'),kicker=p.querySelector('.panel-kicker'),desc=p.querySelector('.panel-head p'),power=p.querySelector('.v6-arp-power');
  if(title)title.textContent=playInstrument==='bass'?'Bass Arp':'Arp Lab';if(kicker)kicker.textContent='MOTION SEQUENCER';if(desc)desc.textContent='BPM-locked pattern motion with performance controls.';
  if(power){power.classList.add('v18-arp-rocker');const s=power.querySelector('span');if(s)s.textContent='ARP'}
  v18SyncArpPresentation();
}
function v18SyncArpPresentation(){const p=$('#v6ArpPanel');if(!p)return;const on=!!v6Arp.enabled;p.classList.toggle('active',on);const power=p.querySelector('.v6-arp-power');if(power){power.classList.toggle('active',on);const s=power.querySelector('span');if(s)s.textContent='ARP'}const wave=p.querySelector('.v18-arp-wave');wave?.classList.toggle('running',on)}
const v18BaseSyncArpUI=v6SyncArpUI;
v6SyncArpUI=function(){try{v18BaseSyncArpUI?.()}catch{}v6Arp.latch=!!(v18CurrentLatchKind()&&v18LatchOn(v18CurrentLatchKind()));v18SyncArpPresentation()};
v6PaintArp=function(index=-1){const wave=$('#v6ArpPanel .v18-arp-wave');if(wave)wave.dataset.step=index<0?'':String(index%8)};

function v18Option(value,current,label=value){return `<option value="${value}" ${String(value)===String(current)?'selected':''}>${label}</option>`}
function v18RecordArpMarkup(kind,state){
  const name=kind==='bass'?'BASS ARP':'SMART KEYS ARP';
  return `<section class="v17-record-arp v18-record-arp ${state.enabled?'active':''}" data-v17-record-arp="${kind}" data-v18-record-arp="${kind}"><div class="v17-record-arp-head"><div><small>MOTION SEQUENCER</small><strong>${name}</strong></div><button class="v17-arp-rocker v18-arp-rocker ${state.enabled?'active':''}" data-v17-power type="button"><i></i><span>ARP</span></button></div>${v18ArpWaveMarkup(kind==='bass'?'BASS MOTION':'CHORD MOTION')}<div class="v18-record-arp-deck"><label>Direction<select data-v18-arp="mode">${v18Option('up',state.mode,'Up')}${v18Option('down',state.mode,'Down')}${v18Option('updown',state.mode,'Up / Down')}${v18Option('downup',state.mode,'Down / Up')}${v18Option('random',state.mode,'Random')}${v18Option('chord',state.mode,'Chord Pulse')}</select></label><label>Rate<select data-v18-arp="rate">${v18Option('1/4',state.rate)}${v18Option('1/8',state.rate)}${v18Option('1/16',state.rate)}${v18Option('1/32',state.rate)}${v18Option('1/8T',state.rate,'1/8 Triplet')}</select></label><label>Range<select data-v18-arp="octaves">${[1,2,3,4].map(v=>v18Option(v,state.octaves,v+' oct')).join('')}</select></label><label>Gate<input data-v18-arp="gate" type="range" min=".08" max="1.5" step=".01" value="${state.gate}"></label><label>Swing<input data-v18-arp="swing" type="range" min="0" max="70" value="${state.swing||0}"></label><label>Ratchet<select data-v18-arp="ratchet">${[1,2,3,4].map(v=>v18Option(v,state.ratchet,'×'+v)).join('')}</select></label><label>Motion<select data-v18-arp="motion">${v18Option('none',state.motion,'Static')}${v18Option('up',state.motion,'Climb')}${v18Option('down',state.motion,'Dive')}${v18Option('pendulum',state.motion,'Pendulum')}</select></label><label>Steps<select data-v18-arp="steps">${[0,1,2,3,4].map(v=>v18Option(v,state.steps)).join('')}</select></label><label>Distance<select data-v18-arp="distance">${v18Option(2,state.distance,'2 st')}${v18Option(5,state.distance,'5 st')}${v18Option(7,state.distance,'7 st')}${v18Option(12,state.distance,'Octave')}</select></label><label>Velocity<select data-v18-arp="velocityMode">${v18Option('flat',state.velocityMode,'Flat')}${v18Option('accent',state.velocityMode,'Accent')}${v18Option('pulse',state.velocityMode,'Pulse')}${v18Option('rampup',state.velocityMode,'Ramp ↑')}${v18Option('rampdown',state.velocityMode,'Ramp ↓')}</select></label><label>Retrigger<select data-v18-arp="retrigger">${v18Option('note',state.retrigger,'New note')}${v18Option('beat',state.retrigger,'Every bar')}${v18Option('free',state.retrigger,'Free run')}</select></label><div class="v18-arp-pattern"><span>RHYTHM</span>${(state.pattern||V17_ARP_DEFAULTS.pattern).map((on,i)=>`<button type="button" data-v18-step="${i}" class="${on?'on':''}"><i></i></button>`).join('')}</div><button class="v18-arp-stop" data-v17-stop type="button">STOP</button></div></section>`;
}
v17CompactArpMarkup=function(kind,state){return v18RecordArpMarkup(kind,state)};
v17BindRecordArp=function(panel,layer,kind){
  if(!panel||panel.dataset.v18Bound==='1')return;panel.dataset.v18Bound='1';const state=v17LayerArp(layer,kind);
  const sync=()=>{panel.classList.toggle('active',!!state.enabled);panel.querySelector('[data-v17-power]')?.classList.toggle('active',!!state.enabled);panel.querySelector('.v18-arp-wave')?.classList.toggle('running',!!state.enabled)};
  panel.querySelector('[data-v17-power]')?.addEventListener('click',()=>{state.enabled=!state.enabled;if(!state.enabled){v15HardStopArp();v18ReleaseHeld(kind==='smart'?'smart':'bass',true)}v17ApplyArpState(state);sync()});
  panel.querySelector('[data-v17-stop]')?.addEventListener('click',()=>{v15HardStopArp();v18ReleaseHeld(kind==='smart'?'smart':'bass',true)});
  panel.querySelectorAll('[data-v18-arp]').forEach(el=>{const k=el.dataset.v18Arp;const apply=()=>{state[k]=['octaves','gate','swing','ratchet','steps','distance'].includes(k)?+el.value:el.value;v17ApplyArpState(state)};el.addEventListener('input',apply);el.addEventListener('change',apply)});
  panel.querySelectorAll('[data-v18-step]').forEach(b=>b.addEventListener('click',()=>{const i=+b.dataset.v18Step;state.pattern[i]=!state.pattern[i];b.classList.toggle('on',state.pattern[i]);v17ApplyArpState(state)}));
  sync();
};
function v18UpgradeRecordArp(){
  if(currentScreen!=='record'||!session.layers?.length)return;const l=sessionLayer(),kind=l.source==='chords'?'smart':l.source==='bass'?'bass':null;if(!kind)return;
  const old=$('#layerSourceTools [data-v17-record-arp]');
  if(old&&!old.matches('.v18-record-arp')){const shell=document.createElement('div');shell.innerHTML=v18RecordArpMarkup(kind,v17LayerArp(l,kind));const fresh=shell.firstElementChild;old.replaceWith(fresh);v17BindRecordArp(fresh,l,kind)}
  else if(old)v17BindRecordArp(old,l,kind);
}

/* --------------------------------------------------------------------------
   Groove Box — richer generated beats + hardware drum synthesis.
   -------------------------------------------------------------------------- */
Object.assign(BEAT_PRESETS,{
  Techno:{kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14]},
  'Drum & Bass':{kick:[0,7,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14,15]},
  'UK Garage':{kick:[0,6,10,14],snare:[4,12],hat:[1,3,6,9,11,14]},
  Disco:{kick:[0,4,8,12],snare:[4,12],hat:[0,2,4,6,8,10,12,14]},
  Synthwave:{kick:[0,8,10],snare:[4,12],hat:[0,2,4,6,8,10,12,14]},
  'Afro House':{kick:[0,4,8,12],snare:[4,12],hat:[2,5,7,10,13,15]}
});
Object.assign(V15_BEAT_FEELS,{
  Techno:{tag:'Driving warehouse pulse',accent:'cyan'},'Drum & Bass':{tag:'Fast broken pressure',accent:'lime'},'UK Garage':{tag:'Shuffled two-step',accent:'purple'},Disco:{tag:'Four-floor shimmer',accent:'pink'},Synthwave:{tag:'Retro machine groove',accent:'orange'},'Afro House':{tag:'Rolling percussive pulse',accent:'amber'}
});
const V18_BEAT_STYLES=['Worship','Pop','Rock','Funk','House','Trap','Reggaeton','Lo-Fi','Techno','Drum & Bass','UK Garage','Disco','Synthwave','Afro House'];
const V18_KITS={
  Studio:{kick:[145,48,.31,.95],snare:[1200,.17,.52],hat:[6500,.05,.21]},
  Club:{kick:[118,42,.42,1.04],snare:[1850,.15,.62],hat:[7600,.045,.25]},
  Analog:{kick:[172,50,.25,.90],snare:[900,.13,.49],hat:[5800,.042,.20]},
  'Lo-Fi':{kick:[102,44,.34,.74],snare:[720,.19,.39],hat:[4300,.065,.15]},
  Punch:{kick:[165,47,.23,1.08],snare:[1550,.12,.68],hat:[7000,.038,.27]}
};
const V18_BEAT_DEFAULT={style:'Worship',kit:'Studio',energy:3,density:3,syncopation:28,swing:0,humanize:0,punch:62,fill:'Off'};
function v18LoadPlayBeatState(){try{return{...V18_BEAT_DEFAULT,...JSON.parse(localStorage.getItem('musicandbeats:v18:playbeat')||'{}')}}catch{return{...V18_BEAT_DEFAULT}}}
const V18_PLAY_BEAT=v18LoadPlayBeatState();
function v18SavePlayBeat(){try{localStorage.setItem('musicandbeats:v18:playbeat',JSON.stringify(V18_PLAY_BEAT))}catch{}}
function v18LayerBeatState(layer){
  if(!layer.beatMachine)layer.beatMachine={...V18_BEAT_DEFAULT,style:layer.beatStyle||'Worship',energy:clamp(+(layer.beatEnergy??3),1,5)};
  Object.assign(layer.beatMachine,{style:layer.beatMachine.style||layer.beatStyle||'Worship',energy:clamp(+layer.beatMachine.energy||3,1,5),density:clamp(+layer.beatMachine.density||3,1,5),syncopation:clamp(+layer.beatMachine.syncopation||0,0,100),swing:clamp(+layer.beatMachine.swing||0,0,65),humanize:clamp(+layer.beatMachine.humanize||0,0,30),punch:clamp(+layer.beatMachine.punch||62,0,100),fill:layer.beatMachine.fill||'Off',kit:V18_KITS[layer.beatMachine.kit]?layer.beatMachine.kit:'Studio'});
  layer.beatStyle=layer.beatMachine.style;layer.beatEnergy=layer.beatMachine.energy;return layer.beatMachine;
}
const V18_ANCHORS={
  Worship:{kick:[0,8],snare:[4,12]},Pop:{kick:[0],snare:[4,12]},Rock:{kick:[0,8],snare:[4,12]},Funk:{kick:[0],snare:[4,12]},House:{kick:[0,4,8,12],snare:[4,12]},Trap:{kick:[0],snare:[4,12]},Reggaeton:{kick:[0,3,8,11],snare:[4,7,12,15]},'Lo-Fi':{kick:[0],snare:[4,12]},Techno:{kick:[0,4,8,12],snare:[4,12]},'Drum & Bass':{kick:[0,10],snare:[4,12]},'UK Garage':{kick:[0,6,10],snare:[4,12]},Disco:{kick:[0,4,8,12],snare:[4,12]},Synthwave:{kick:[0,8],snare:[4,12]},'Afro House':{kick:[0,4,8,12],snare:[4,12]}
};
function v18IsAnchor(style,lane,i){return(V18_ANCHORS[style]?.[lane]||[]).includes(i)}
function v18GenerateBeat(state,variation=true){
  const p=loadBeat(state.style,state.energy,variation),density=clamp(+state.density||3,1,5),sync=clamp(+state.syncopation||0,0,100)/100;
  if(density<3){const remove=(3-density)*.20;['kick','snare','hat'].forEach(l=>{for(let i=0;i<16;i++)if(p[l][i]&&!v18IsAnchor(state.style,l,i)&&Math.random()<remove)p[l][i]=false})}
  if(density>3){const add=(density-3)*.10;for(let i=0;i<16;i++){if(!p.hat[i]&&Math.random()<add*1.8)p.hat[i]=true;if(i%2===1&&!p.kick[i]&&Math.random()<add*.58)p.kick[i]=true}}
  [1,3,5,7,9,11,13,15].forEach(i=>{if(Math.random()<sync*.18)p.kick[i]=true;if(Math.random()<sync*.12)p.hat[i]=true});
  [3,7,11,15].forEach(i=>{if(Math.random()<sync*.08)p.snare[i]=true});
  const fill=state.fill||'Off';
  if(fill==='Light'){p.hat[14]=p.hat[15]=true;if(Math.random()>.45)p.snare[15]=true}
  if(fill==='Roll'){[12,13,14,15].forEach(i=>p.hat[i]=true);p.snare[14]=p.snare[15]=true}
  if(fill==='Lift'){[9,10,11,12,13,14,15].forEach(i=>p.hat[i]=true);p.kick[14]=true}
  if(fill==='Break'){p.kick[12]=p.kick[13]=p.kick[14]=false;p.hat[12]=p.hat[13]=false;p.snare[15]=true}
  (V18_ANCHORS[state.style]?.kick||[]).forEach(i=>p.kick[i]=true);(V18_ANCHORS[state.style]?.snare||[]).forEach(i=>p.snare[i]=true);
  return p;
}
function v18BeatStateForMode(mode){if(mode==='play')return V18_PLAY_BEAT;if(currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='beats')return v18LayerBeatState(sessionLayer());return V18_PLAY_BEAT}
function v18Noise(t,{highpass=1200,lowpass=18000,duration=.16,gain=.5}={}){const len=Math.max(64,Math.floor(ctx.sampleRate*duration)),buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;const s=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),lp=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=buf;hp.type='highpass';hp.frequency.value=highpass;lp.type='lowpass';lp.frequency.value=lowpass;g.gain.setValueAtTime(Math.max(.001,gain),t);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(hp).connect(lp).connect(g).connect(drumBus);s.start(t);s.stop(t+duration+.02)}
function v18Kick(t,state){const k=V18_KITS[state.kit]||V18_KITS.Studio,[start,end,dur,baseGain]=k.kick,punch=.72+clamp(+state.punch||62,0,100)/100*.48,o=ctx.createOscillator(),g=ctx.createGain();o.type=state.kit==='Analog'?'triangle':'sine';o.frequency.setValueAtTime(start,t);o.frequency.exponentialRampToValueAtTime(end,t+Math.min(.16,dur*.55));g.gain.setValueAtTime(baseGain*punch,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g).connect(drumBus);o.start(t);o.stop(t+dur+.03)}
function v18Snare(t,state){const k=V18_KITS[state.kit]||V18_KITS.Studio,[hp,dur,gain]=k.snare,punch=.78+clamp(+state.punch||62,0,100)/100*.4;v18Noise(t,{highpass:hp,lowpass:state.kit==='Lo-Fi'?5200:15000,duration:dur,gain:gain*punch})}
function v18Hat(t,state){const k=V18_KITS[state.kit]||V18_KITS.Studio,[hp,dur,gain]=k.hat;v18Noise(t,{highpass:hp,lowpass:state.kit==='Lo-Fi'?7600:19000,duration:dur,gain})}
function v18HitPattern(pattern,step,t,state){if(pattern.kick[step])v18Kick(t,state);if(pattern.snare[step])v18Snare(t,state);if(pattern.hat[step])v18Hat(t,state)}
function v18HitTime(gridTime,step,base,state){const swing=clamp(+state.swing||0,0,65)/100*base*.48,jitter=(Math.random()*2-1)*(clamp(+state.humanize||0,0,30)/1000);return Math.max(ctx.currentTime+.001,gridTime+(step%2?swing:0)+jitter)}

startScheduler=function({mode,pattern,bpm,metronome=false}){
  stopScheduler();schedulerMode=mode;schedulerPattern=pattern;schedulerBpm=bpm;schedulerMetronome=metronome;currentStep=0;nextStepTime=ctx.currentTime+.05;
  scheduler=setInterval(()=>{while(nextStepTime<ctx.currentTime+.12){const state=v18BeatStateForMode(mode),base=60/schedulerBpm/4,hitTime=v18HitTime(nextStepTime,currentStep,base,state);v18HitPattern(schedulerPattern,currentStep,hitTime,state);if(schedulerMetronome&&currentStep%4===0)click(nextStepTime,currentStep===0);const step=currentStep,set=Math.max(0,(hitTime-ctx.currentTime)*1000);setTimeout(()=>highlightStep(step),set);nextStepTime+=base;currentStep=(currentStep+1)%16}},25);
};
scheduleBeatWindow=function(pattern,start,bars,bpm){const state=currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='beats'?v18LayerBeatState(sessionLayer()):V18_PLAY_BEAT,base=60/bpm/4;for(let bar=0;bar<bars;bar++)for(let i=0;i<16;i++){const grid=start+(bar*16+i)*base,t=v18HitTime(grid,i,base,state);v18HitPattern(pattern,i,t,state)}};

function v18BeatStylesMarkup(current){return V18_BEAT_STYLES.map(s=>v18Option(s,current)).join('')}
function v18BeatKnob(key,label,value,readout){return `<div class="v18-beat-knob-cell"><span>${label}</span><div class="v17-hw-knob v18-beat-knob" data-v18-beat-knob="${key}" data-value="${value}"><span class="v17-knob-cap"><i></i></span></div><b data-v18-beat-out="${key}">${readout}</b></div>`}
function v18BeatMarkup(context,state){
  const play=context==='play',seqId=play?'playSequencer':'recordSequencer',styleId=play?'playBeatStyle':'recordBeatStyle',energyId=play?'playEnergy':'recordEnergy',genId=play?'generatePlayBeat':'generateRecordBeat',clearId=play?'clearPlayBeat':'clearRecordBeat',feel=V15_BEAT_FEELS[state.style]||V15_BEAT_FEELS.Worship;
  return `<div class="v18-groovebox" data-v18-groovebox="${context}"><div class="v18-groove-face"><span class="v18-screw tl"></span><span class="v18-screw tr"></span><div><small>RHYTHM HARDWARE</small><strong>M&B GROOVE BOX</strong><em><i></i>${feel.tag}</em></div><label>GENRE<select id="${styleId}">${v18BeatStylesMarkup(state.style)}</select></label><label>KIT<select data-v18-beat="kit">${Object.keys(V18_KITS).map(k=>v18Option(k,state.kit)).join('')}</select></label></div><div class="v18-groove-knobs">${v18BeatKnob('energy','ENERGY',state.energy,String(state.energy))}${v18BeatKnob('density','DENSITY',state.density,String(state.density))}${v18BeatKnob('syncopation','SYNC',state.syncopation,Math.round(state.syncopation)+'%')}${v18BeatKnob('swing','SWING',state.swing,Math.round(state.swing)+'%')}${v18BeatKnob('humanize','HUMAN',state.humanize,Math.round(state.humanize)+'ms')}${v18BeatKnob('punch','PUNCH',state.punch,Math.round(state.punch)+'%')}</div><input id="${energyId}" class="v18-hidden-source" type="range" min="1" max="5" value="${state.energy}"><span id="${play?'playEnergyValue':'recordEnergyValue'}" class="v18-hidden-source">${state.energy}</span><div class="v18-groove-actions"><label>FILL<select data-v18-beat="fill">${['Off','Light','Roll','Lift','Break'].map(v=>v18Option(v,state.fill)).join('')}</select></label><button id="${genId}" class="v18-generate-push" type="button"><i></i><span>GENERATE</span></button><button id="${clearId}" class="v18-clear-push" type="button">CLEAR</button></div><div class="v18-seq-frame"><div class="v18-seq-label"><span>16 STEP PROGRAMMER</span><small>Tap pads to edit after generation</small></div><div id="${seqId}" class="sequencer v18-sequencer"></div></div></div>`;
}
function v18BeatKnobDef(key,state){return({energy:[1,5,1,v=>String(Math.round(v))],density:[1,5,1,v=>String(Math.round(v))],syncopation:[0,100,1,v=>`${Math.round(v)}%`],swing:[0,65,1,v=>`${Math.round(v)}%`],humanize:[0,30,1,v=>`${Math.round(v)}ms`],punch:[0,100,1,v=>`${Math.round(v)}%`]}[key])}
function v18BindGrooveBox(root,state,context){
  if(!root||root.dataset.bound==='1')return;root.dataset.bound='1';const play=context==='play';
  const style=root.querySelector(play?'#playBeatStyle':'#recordBeatStyle'),energy=root.querySelector(play?'#playEnergy':'#recordEnergy'),seq=play?'#playSequencer':'#recordSequencer';
  style?.addEventListener('change',()=>{state.style=style.value;if(!play){const l=sessionLayer();l.beatStyle=state.style}else v18SavePlayBeat();const feel=V15_BEAT_FEELS[state.style]||V15_BEAT_FEELS.Worship;const em=root.querySelector('.v18-groove-face em');if(em)em.innerHTML=`<i></i>${feel.tag}`;const p=v18GenerateBeat(state,false);if(play){playPattern=p;if(playBeatRunning)schedulerPattern=playPattern}else sessionLayer().pattern=p;renderSequencer(seq,p)});
  root.querySelector('[data-v18-beat="kit"]')?.addEventListener('change',e=>{state.kit=e.target.value;if(play)v18SavePlayBeat()});
  root.querySelector('[data-v18-beat="fill"]')?.addEventListener('change',e=>{state.fill=e.target.value;if(play)v18SavePlayBeat()});
  root.querySelectorAll('[data-v18-beat-knob]').forEach(knob=>{const key=knob.dataset.v18BeatKnob,def=v18BeatKnobDef(key,state);if(!def)return;const[min,max,step,format]=def;v17BindValueKnob(knob,min,max,step,+state[key],v=>{state[key]=v;const out=root.querySelector(`[data-v18-beat-out="${key}"]`);if(out)out.textContent=format(v);if(key==='energy'&&energy){energy.value=String(v);if(!play)sessionLayer().beatEnergy=v}if(play)v18SavePlayBeat()})});
  root.querySelector(play?'#generatePlayBeat':'#generateRecordBeat')?.addEventListener('click',e=>{const p=v18GenerateBeat(state,true);e.currentTarget.classList.add('fired');setTimeout(()=>e.currentTarget?.classList.remove('fired'),180);if(play){playPattern=p;if(playBeatRunning)schedulerPattern=playPattern;v18SavePlayBeat()}else{const l=sessionLayer();l.pattern=p;l.beatStyle=state.style;l.beatEnergy=state.energy}renderSequencer(seq,p)});
  root.querySelector(play?'#clearPlayBeat':'#clearRecordBeat')?.addEventListener('click',()=>{const p=play?playPattern:sessionLayer().pattern;clearPattern(p);if(play&&playBeatRunning)schedulerPattern=playPattern;renderSequencer(seq,p)});
}
function v18InstallPlayGrooveBox(){
  const panel=$('#playScreen .beat-panel');if(!panel)return;if(panel.dataset.v18==='1'){v18BindGrooveBox(panel.querySelector('[data-v18-groovebox]'),V18_PLAY_BEAT,'play');return}
  V18_PLAY_BEAT.style=V18_BEAT_STYLES.includes(V18_PLAY_BEAT.style)?V18_PLAY_BEAT.style:'Worship';panel.dataset.v18='1';panel.innerHTML=v18BeatMarkup('play',V18_PLAY_BEAT);renderSequencer('#playSequencer',playPattern);v18BindGrooveBox(panel.querySelector('[data-v18-groovebox]'),V18_PLAY_BEAT,'play');
}
v15EnhanceRecordBeat=function(){
  if(currentScreen!=='record'||!session.layers?.length)return;const l=sessionLayer();if(l.source!=='beats')return;const box=$('#layerSourceTools .tool-box');if(!box)return;const state=v18LayerBeatState(l);
  if(!box.querySelector('[data-v18-groovebox="record"]')){box.innerHTML=v18BeatMarkup('record',state);renderSequencer('#recordSequencer',l.pattern)}
  v18BindGrooveBox(box.querySelector('[data-v18-groovebox="record"]'),state,'record');
};

/* Persist V18 beat-machine configuration in named projects. */
if(typeof v7ProjectPayload==='function'){
  const v18BaseProjectPayload=v7ProjectPayload;v7ProjectPayload=function(name,id){const p=v18BaseProjectPayload(name,id);p.v18PlayBeat={...V18_PLAY_BEAT};p.session.layers.forEach((saved,i)=>{const live=session.layers[i];if(live?.beatMachine)saved.beatMachine={...live.beatMachine}});return p};
}
if(typeof v7OpenProject==='function'&&typeof v7StoreGet==='function'){
  const v18BaseOpenProject=v7OpenProject;v7OpenProject=async function(id){let data=null;try{data=await v7StoreGet(`project:${id}`)}catch{}const out=await v18BaseOpenProject(id);if(data?.v18PlayBeat)Object.assign(V18_PLAY_BEAT,V18_BEAT_DEFAULT,data.v18PlayBeat);requestAnimationFrame(()=>{v18InstallPlayGrooveBox();v18RefreshUI()});return out};
}

/* --------------------------------------------------------------------------
   Physical-device surface pass + render integration.
   -------------------------------------------------------------------------- */
function v18HardwareizeSurfaces(){
  document.documentElement.classList.add('v18-hardware-ui');
  document.querySelectorAll('.panel,.transport-card,.tool-box,.current-layer-panel,.layer-rail,.record-console,.v17-fx-rack').forEach(el=>el.classList.add('v18-hardware-surface'));
}
function v18RefreshUI(){
  v18InstallLatchControls();v18FlattenPlayArp();v18UpgradeRecordArp();v18InstallPlayGrooveBox();v18HardwareizeSurfaces();v18SyncLatchUI();
  const kind=v18CurrentLatchKind();if(kind)v6Arp.latch=v18LatchOn(kind);
}
const v18BaseRenderPlayInstrument=renderPlayInstrument;
renderPlayInstrument=function(){const out=v18BaseRenderPlayInstrument.apply(this,arguments);requestAnimationFrame(v18RefreshUI);return out};
const v18BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){const out=v18BaseRenderLayerTools.apply(this,arguments);requestAnimationFrame(v18RefreshUI);return out};

/* Instrument/source navigation hard-stops held notes, but the LATCH switch remains armed. */
document.addEventListener('click',e=>{if(e.target.closest?.('.instrument-tab,.source-card,.back-home,#homeBtn')){v18ReleaseSmartHeld(true);v18ReleaseBassHeld(true)}},true);
const v18BaseStopSession=stopSession;stopSession=function(){v18ReleaseBassHeld(true);return v18BaseStopSession.apply(this,arguments)};
const v18BasePanic=panic;panic=function(){v18ReleaseBassHeld(true);return v18BasePanic.apply(this,arguments)};

/* Retire old helper copy that mentioned hold/double-tap/EDM labels. */
if(typeof v7AnnotateArp==='function')v7AnnotateArp=function(){};
requestAnimationFrame(v18RefreshUI);
