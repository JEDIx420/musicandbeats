/* Music & Beats V15 — persistent beat genres + Bass Arp in Play and Record. */
const V15_BEAT_FEELS={
  Worship:{tag:'Open & spacious',accent:'violet'},
  Pop:{tag:'Punchy & bright',accent:'pink'},
  Rock:{tag:'Driving backbeat',accent:'orange'},
  Funk:{tag:'Syncopated pocket',accent:'lime'},
  House:{tag:'Four-on-the-floor',accent:'cyan'},
  Trap:{tag:'Half-time & rolls',accent:'purple'},
  Reggaeton:{tag:'Dembow groove',accent:'amber'},
  'Lo-Fi':{tag:'Lazy & dusty',accent:'blue'}
};

Object.assign(BEAT_PRESETS,{
  Worship:{kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14]},
  Pop:{kick:[0,3,7,8,11,14],snare:[4,12],hat:[0,2,4,6,8,10,12,14,15]},
  Rock:{kick:[0,3,7,8,10,14],snare:[4,12],hat:[0,2,4,6,8,10,12,14]},
  Funk:{kick:[0,3,6,10,14],snare:[4,7,12,15],hat:[0,2,3,5,6,8,9,11,13,14,15]},
  House:{kick:[0,4,8,12],snare:[4,12],hat:[2,6,10,14]},
  Trap:{kick:[0,7,10,14],snare:[4,12],hat:[0,2,4,6,8,9,10,11,12,13,14,15]},
  Reggaeton:{kick:[0,3,8,11],snare:[4,7,12,15],hat:[0,2,4,6,8,10,12,14]},
  'Lo-Fi':{kick:[0,7,10],snare:[4,12],hat:[0,3,6,9,12,15]}
});

loadBeat=function(style='Worship',energy=3,variation=false){
  const chosen=BEAT_PRESETS[style]?style:'Worship',base=BEAT_PRESETS[chosen],p=emptyPattern(),e=clamp(+energy||3,1,5);
  ['kick','snare','hat'].forEach(l=>base[l].forEach(i=>p[l][i]=true));
  if(!variation)return p;
  const chance={kick:.02+e*.018,snare:.012+e*.01,hat:.025+e*.028};
  ['kick','snare','hat'].forEach(l=>{for(let i=0;i<16;i++)if(Math.random()<chance[l])p[l][i]=!p[l][i]});
  if(chosen==='House'){[0,4,8,12].forEach(i=>p.kick[i]=true);[2,6,10,14].forEach(i=>p.hat[i]=true)}
  else if(chosen==='Reggaeton'){[0,3,8,11].forEach(i=>p.kick[i]=true);[4,7,12,15].forEach(i=>p.snare[i]=true)}
  else if(chosen==='Trap'){p.snare[4]=true;p.snare[12]=true;if(e>=3){p.hat[9]=true;p.hat[11]=true;p.hat[13]=true;p.hat[15]=true}}
  else if(chosen==='Funk'){p.kick[0]=true;p.snare[4]=true;p.snare[12]=true;if(e>=4)p.snare[15]=true}
  else if(chosen==='Rock'){p.kick[0]=true;p.kick[8]=true;p.snare[4]=true;p.snare[12]=true}
  else if(chosen==='Pop'){p.snare[4]=true;p.snare[12]=true;p.kick[0]=true}
  else if(chosen==='Lo-Fi'){p.snare[4]=true;p.snare[12]=true;p.hat[3]=true;p.hat[9]=true}
  else {p.snare[4]=true;p.snare[12]=true;p.kick[0]=true;p.kick[8]=true}
  if(e===1){[1,5,9,13,15].forEach(i=>{if(Math.random()>.35)p.hat[i]=false})}
  if(e>=5){p.hat[15]=true;if(chosen!=='House')p.kick[14]=true}
  return p;
};

function v15BeatState(layer){
  if(!layer)return{style:'Worship',energy:3};
  if(!V15_BEAT_FEELS[layer.beatStyle])layer.beatStyle='Worship';
  layer.beatEnergy=clamp(+(layer.beatEnergy??3),1,5);
  return{style:layer.beatStyle,energy:layer.beatEnergy};
}
function v15BeatFeelMarkup(style){const f=V15_BEAT_FEELS[style]||V15_BEAT_FEELS.Worship;return`<span class="v15-beat-feel" data-feel="${f.accent}"><i></i>${f.tag}</span>`}
function v15EnhanceRecordBeat(){
  if(currentScreen!=='record'||!session.layers?.length)return;const l=sessionLayer();if(l.source!=='beats')return;
  const style=$('#recordBeatStyle'),energy=$('#recordEnergy'),box=$('#layerSourceTools .tool-box');if(!style||!energy||!box)return;
  const s=v15BeatState(l);style.value=s.style;energy.value=s.energy;
  const styleLabel=style.closest('label');if(styleLabel&&styleLabel.firstChild?.nodeType===3)styleLabel.firstChild.textContent='Genre';
  let feel=box.querySelector('.v15-beat-feel');if(!feel){styleLabel?.insertAdjacentHTML('beforeend',v15BeatFeelMarkup(s.style));feel=box.querySelector('.v15-beat-feel')}
  const refreshFeel=()=>{const f=V15_BEAT_FEELS[l.beatStyle]||V15_BEAT_FEELS.Worship;if(feel){feel.dataset.feel=f.accent;feel.lastChild.textContent=f.tag}}
  style.onchange=()=>{l.beatStyle=style.value;refreshFeel()};
  energy.oninput=()=>{l.beatEnergy=+energy.value};
  const old=$('#generateRecordBeat');if(old&&!old.dataset.v15){const fresh=old.cloneNode(true);fresh.dataset.v15='1';old.replaceWith(fresh);fresh.addEventListener('click',()=>{l.beatStyle=style.value;l.beatEnergy=+energy.value;l.pattern=loadBeat(l.beatStyle,l.beatEnergy,true);renderLayerTools()})}
}

const v15BassPointers=new Map();
function v15BassTargetFromKey(key,context){
  if(!key)return null;const record=context==='record',layer=record?sessionLayer():null;
  return{kind:'bass',rootMidi:+key.dataset.midi,pad:key,preset:record?(layer?.sound||'Finger Bass'):($('#playBassSound')?.value||'Finger Bass'),context,bpm:record?(session.bpm||100):clamp(+($('#playBpm')?.value||100),40,220)};
}
const v15BaseArpSequence=v6ArpSequence;
v6ArpSequence=function(target){
  if(target?.kind!=='bass')return v15BaseArpSequence(target);
  const root=target.rootMidi,base=[root,root+7,root+12],seq=[];
  for(let o=0;o<Math.max(1,v6Arp.octaves||1);o++)base.forEach((m,i)=>{const n=m+o*12;if(!seq.includes(n)&&(i<2||o===0||v6Arp.octaves>1))seq.push(n)});
  if(v6Arp.mode==='down')return seq.slice().reverse();
  if(v6Arp.mode==='updown'&&seq.length>2)return[...seq,...seq.slice(1,-1).reverse()];
  return seq;
};
v6RateMs=function(){
  const bpm=v6Arp.target?.bpm||clamp(+($('#playBpm')?.value||session.bpm||100),40,220);
  return({'1/4':60000/bpm,'1/8':30000/bpm,'1/16':15000/bpm,'1/8T':20000/bpm})[v6Arp.rate]||30000/bpm;
};
function v15HardStopArp(){try{if(typeof v7HardStopArp==='function')v7HardStopArp();else v6StopArp('immediate')}catch{}}
function v15StartBassArp(key,context){const target=v15BassTargetFromKey(key,context);if(!target)return;v6Arp.enabled=true;v6StartArp(target);key.classList.add('arp-active')}
function v15ReleaseBassArp(key){key?.classList.remove('arp-active');if(v6Arp.latch)return;v15HardStopArp()}
function v15BindBassKeyboard(host,context){
  if(!host||host.dataset.v15BassArp===context)return;host.dataset.v15BassArp=context;
  host.addEventListener('pointerdown',e=>{
    if(!v6Arp.enabled)return;const key=e.target.closest('.piano-key');if(!key||!host.contains(key))return;
    e.preventDefault();e.stopImmediatePropagation();v15StartBassArp(key,context);v15BassPointers.set(e.pointerId,{host,key,context});try{host.setPointerCapture(e.pointerId)}catch{}
  },true);
  host.addEventListener('pointermove',e=>{
    const hit=v15BassPointers.get(e.pointerId);if(!hit||hit.host!==host||!v6Arp.enabled)return;
    const key=document.elementFromPoint(e.clientX,e.clientY)?.closest('.piano-key');if(!key||!host.contains(key)||key===hit.key)return;
    hit.key.classList.remove('arp-active');v15StartBassArp(key,context);hit.key=key;
  },true);
  const end=e=>{const hit=v15BassPointers.get(e.pointerId);if(!hit||hit.host!==host)return;e.preventDefault();e.stopImmediatePropagation();v15BassPointers.delete(e.pointerId);v15ReleaseBassArp(hit.key)};
  host.addEventListener('pointerup',end,true);host.addEventListener('pointercancel',end,true);host.addEventListener('lostpointercapture',end,true);
}

function v15UpdatePlayArpPanel(){
  const p=$('#v6ArpPanel');if(!p)return;const supported=playInstrument==='chords'||playInstrument==='bass';
  p.classList.toggle('disabled',!supported);p.classList.toggle('v15-bass-arp',playInstrument==='bass');
  const title=p.querySelector('.panel-head h2'),kicker=p.querySelector('.panel-kicker'),desc=p.querySelector('.panel-head p'),note=p.querySelector('.v6-arp-note');
  if(playInstrument==='bass'){
    if(title)title.textContent='Bass Arp';if(kicker)kicker.textContent='LOW-END PATTERN ENGINE';if(desc)desc.textContent='Turn a bass note into a locked root–fifth–octave pattern.';
    if(note)note.innerHTML='Enable it, then hold or glide across the bass keyboard. Direction, rate, range, gate and latch work exactly like Smart Keys.';
  }else{
    if(title)title.textContent='Arp Lab';if(kicker)kicker.textContent='PATTERN ENGINE';if(desc)desc.textContent='Turn any Smart Key into a moving pattern locked to your BPM.';
    if(note&&!note.querySelector('.v7-arp-legato'))note.innerHTML='Hold <kbd>1–7</kbd> or a Smart Key and move straight into the next chord. <span class="v7-arp-legato">Legato handoff</span> keeps the arp clock running.';
  }
  if(!supported)v15HardStopArp();v6SyncArpUI?.();
}
v6UpdateArpPanelState=function(){v15UpdatePlayArpPanel()};

function v15RecordArpState(layer){if(!layer.bassArp)layer.bassArp={enabled:false,mode:'up',rate:'1/8',octaves:1,gate:.62,latch:false};return layer.bassArp}
function v15ApplyRecordArpState(layer){const s=v15RecordArpState(layer);v6Arp.enabled=!!s.enabled;v6Arp.mode=s.mode;v6Arp.rate=s.rate;v6Arp.octaves=+s.octaves;v6Arp.gate=+s.gate;v6Arp.latch=!!s.latch}
function v15RecordBassArpMarkup(layer){const s=v15RecordArpState(layer);return`<section class="v15-record-arp ${s.enabled?'active':''}" data-v15-record-arp><div class="v15-record-arp-head"><div><span>BASS ARP</span><strong>Pattern assist</strong></div><button data-v15-arp-power type="button">${s.enabled?'ON':'OFF'}</button></div><div class="v15-record-arp-controls"><label>Direction<select data-v15-arp="mode"><option value="up" ${s.mode==='up'?'selected':''}>Up</option><option value="down" ${s.mode==='down'?'selected':''}>Down</option><option value="updown" ${s.mode==='updown'?'selected':''}>Up / Down</option><option value="random" ${s.mode==='random'?'selected':''}>Random</option></select></label><label>Rate<select data-v15-arp="rate"><option ${s.rate==='1/4'?'selected':''}>1/4</option><option ${s.rate==='1/8'?'selected':''}>1/8</option><option ${s.rate==='1/16'?'selected':''}>1/16</option><option value="1/8T" ${s.rate==='1/8T'?'selected':''}>1/8 Triplet</option></select></label><label>Range<select data-v15-arp="octaves"><option ${+s.octaves===1?'selected':''}>1</option><option ${+s.octaves===2?'selected':''}>2</option><option ${+s.octaves===3?'selected':''}>3</option></select></label><label class="v15-gate">Gate<input data-v15-arp="gate" type="range" min=".15" max=".98" step=".01" value="${s.gate}"></label><button class="v15-latch ${s.latch?'active':''}" data-v15-latch type="button">${s.latch?'Latch ON':'Latch'}</button><button class="v15-stop" data-v15-stop type="button">Stop</button></div></section>`}
function v15EnhanceRecordBass(){
  if(currentScreen!=='record'||!session.layers?.length)return;const l=sessionLayer();if(l.source!=='bass')return;const host=$('#recordKeyboard'),box=$('#layerSourceTools .tool-box');if(!host||!box)return;
  let panel=box.querySelector('[data-v15-record-arp]');if(!panel){host.insertAdjacentHTML('beforebegin',v15RecordBassArpMarkup(l));panel=box.querySelector('[data-v15-record-arp]')}
  v15ApplyRecordArpState(l);v15BindBassKeyboard(host,'record');
  const power=panel.querySelector('[data-v15-arp-power]');power.onclick=()=>{const s=v15RecordArpState(l);s.enabled=!s.enabled;if(!s.enabled)v15HardStopArp();v15ApplyRecordArpState(l);renderLayerTools()};
  panel.querySelectorAll('[data-v15-arp]').forEach(el=>el.oninput=()=>{const s=v15RecordArpState(l),k=el.dataset.v15Arp;s[k]=k==='octaves'?+el.value:k==='gate'?+el.value:el.value;v15ApplyRecordArpState(l)});
  panel.querySelector('[data-v15-latch]').onclick=()=>{const s=v15RecordArpState(l);s.latch=!s.latch;v15ApplyRecordArpState(l);panel.querySelector('[data-v15-latch]').classList.toggle('active',s.latch);panel.querySelector('[data-v15-latch]').textContent=s.latch?'Latch ON':'Latch'};
  panel.querySelector('[data-v15-stop]').onclick=()=>v15HardStopArp();
}
function v15EnhancePlayBass(){if(currentScreen!=='play'||playInstrument!=='bass')return;const host=$('#playKeyboard');if(!host)return;v15BindBassKeyboard(host,'play');v15UpdatePlayArpPanel()}

const v15BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){const out=v15BaseRenderLayerTools();setTimeout(()=>{v15EnhanceRecordBeat();v15EnhanceRecordBass()},0);return out};
const v15BaseRenderPlayInstrument=renderPlayInstrument;
renderPlayInstrument=function(){const out=v15BaseRenderPlayInstrument();setTimeout(()=>{v15EnhancePlayBass();v15UpdatePlayArpPanel()},0);return out};

if(typeof v7ProjectPayload==='function'){
  const v15BaseProjectPayload=v7ProjectPayload;
  v7ProjectPayload=function(name,id){const p=v15BaseProjectPayload(name,id);p.session.layers.forEach((saved,i)=>{const live=session.layers[i];if(!live)return;if(live.beatStyle)saved.beatStyle=live.beatStyle;if(live.beatEnergy!=null)saved.beatEnergy=live.beatEnergy;if(live.bassArp)saved.bassArp={...live.bassArp}});return p};
}
document.addEventListener('click',e=>{if(e.target.closest('.instrument-tab,.source-card,.v5-layer-select,.back-home,#homeBtn'))setTimeout(()=>{const bassPlay=currentScreen==='play'&&playInstrument==='bass',bassRecord=currentScreen==='record'&&session.layers?.length&&sessionLayer().source==='bass';if(!bassPlay&&!bassRecord&&v6Arp.target?.kind==='bass')v15HardStopArp()},0)},true);

function v15Init(){session.layers?.forEach(l=>{if(l.source==='beats')v15BeatState(l)});v15EnhanceRecordBeat();v15EnhanceRecordBass();v15EnhancePlayBass();v15UpdatePlayArpPanel()}
v15Init();
