/* Music & Beats V5 — readable controls, keyboard mappings, performance pad and expandable layer mixer. */
const V5_KEY_PRESETS=()=>Object.keys(SOUND_PRESETS).filter(n=>!V4_BASS_PRESETS.includes(n));
let v5ExpandedLayer=null;
let v5SoloLayer=null;
const v5NumberChordVoices=new Map();

function v5FilterSoundSelect(select,fallback='Studio Grand'){
  if(!select)return;
  const allowed=V5_KEY_PRESETS(),current=allowed.includes(select.value)?select.value:fallback;
  select.innerHTML=allowed.map(n=>`<option ${n===current?'selected':''}>${n}</option>`).join('');
  select.value=current;
}
function v5NormalizeSoundMenus(){
  v5FilterSoundSelect($('#playSound'));
  const l=currentScreen==='record'&&session.layers.length?sessionLayer():null;
  const record=$('#recordSound');
  if(record&&l&&l.source!=='bass'){
    if(!V5_KEY_PRESETS().includes(l.sound))l.sound='Studio Grand';
    v5FilterSoundSelect(record,l.sound);
    record.value=l.sound;
  }
}
const v5BaseRenderKeyboard=renderKeyboard;
renderKeyboard=function(id,opts={}){
  const next={...opts};
  if(id==='#recordKeyboard')next.mini=false;
  return v5BaseRenderKeyboard(id,next);
};

function v5CurrentChordContext(){
  if(currentScreen==='play'&&playInstrument==='chords'){
    return {host:$('#playChords'),flavor:$('#playChordFlavor')?.value||'triad',voicing:$('#playVoicing')?.value||'close',octave:+($('#playOctave')?.value||3),preset:$('#playSound')?.value||'Studio Grand'};
  }
  if(currentScreen==='record'&&session.layers.length){
    const l=sessionLayer();
    if(l.source==='chords')return {host:$('#recordChords'),flavor:l.flavor||'triad',voicing:l.voicing||'close',octave:l.octave||3,preset:l.sound||'Studio Grand'};
  }
  return null;
}
function v5ChordIndexFromKey(e){return /^[1-7]$/.test(e.key)?+e.key-1:-1}
function v5TriggerNumberChord(index){
  if(v5NumberChordVoices.has(index))return true;
  const c=v5CurrentChordContext(),pad=c?.host?.querySelectorAll('.chord-pad')?.[index];
  if(!c||!pad)return false;
  primeAudio();
  const base=noteMidi(pad.dataset.root,c.octave);
  const voices=voiced(chordIntervals(c.flavor,pad.dataset.quality),c.voicing).map((semi,i)=>startVoice(base+semi,c.preset,.78-Math.min(i*.035,.2)));
  pad.classList.add('active','keyboard-active');
  v5NumberChordVoices.set(index,{voices,pad});
  return true;
}
function v5ReleaseNumberChord(index){const hit=v5NumberChordVoices.get(index);if(!hit)return;hit.voices.forEach(v=>v.stop());hit.pad.classList.remove('active','keyboard-active');v5NumberChordVoices.delete(index)}
function v5ReleaseAllNumberChords(){[...v5NumberChordVoices.keys()].forEach(v5ReleaseNumberChord)}
document.addEventListener('keydown',e=>{const tag=document.activeElement?.tagName;if(['INPUT','SELECT','TEXTAREA'].includes(tag)||document.activeElement?.isContentEditable||e.metaKey||e.ctrlKey||e.altKey)return;const i=v5ChordIndexFromKey(e);if(i<0||e.repeat)return;if(v5TriggerNumberChord(i))e.preventDefault()});
document.addEventListener('keyup',e=>{const i=v5ChordIndexFromKey(e);if(i>=0)v5ReleaseNumberChord(i)});
window.addEventListener('blur',v5ReleaseAllNumberChords);
document.addEventListener('visibilitychange',()=>{if(document.hidden)v5ReleaseAllNumberChords()});

function v5AnnotateChordPads(){
  ['#playChords','#recordChords'].forEach(sel=>{const host=$(sel);if(!host)return;[...host.querySelectorAll('.chord-pad')].forEach((pad,i)=>{if(i>6)return;let badge=pad.querySelector('.key-map-badge');if(!badge){badge=document.createElement('kbd');badge.className='key-map-badge';pad.appendChild(badge)}badge.textContent=String(i+1);pad.setAttribute('aria-keyshortcuts',String(i+1))})});
}

function v5SyncExpressionUI(){const strip=$('#playExpression');if(!strip)return;const pairs={tone:V4_PLAY_EXPR.tone,space:Math.round(V4_PLAY_EXPR.space*100)};Object.entries(pairs).forEach(([k,val])=>{const input=strip.querySelector(`[data-expr="${k}"]`);if(!input)return;input.value=val;input.dispatchEvent(new Event('input',{bubbles:true}))})}
function v5SetFx(tone,space){V4_PLAY_EXPR.tone=clamp(tone,700,12000);V4_PLAY_EXPR.space=clamp(space,0,.65);if(reverbWet&&ctx)reverbWet.gain.setTargetAtTime(V4_PLAY_EXPR.space,ctx.currentTime,.025);v5SyncExpressionUI();v5PaintFluxPad()}
function v5PaintFluxPad(){const pad=$('#fluxPad'),orb=$('#fluxOrb');if(!pad||!orb)return;const x=(V4_PLAY_EXPR.tone-700)/(12000-700),y=1-(V4_PLAY_EXPR.space/.65);orb.style.left=`${clamp(x,0,1)*100}%`;orb.style.top=`${clamp(y,0,1)*100}%`;$('#fluxTone').textContent=`${(V4_PLAY_EXPR.tone/1000).toFixed(1)}k`;$('#fluxSpace').textContent=`${Math.round(V4_PLAY_EXPR.space*100)}%`}
function v5InstallFluxPad(){
  const workspace=$('#playScreen .play-workspace');if(!workspace||$('#performancePadPanel'))return;
  const panel=document.createElement('section');panel.id='performancePadPanel';panel.className='panel performance-pad-panel';
  panel.innerHTML=`<div class="panel-head"><div><span class="panel-kicker">LIVE FX</span><h2>Flux Pad</h2><p>Drag while you play — left/right shapes tone, up/down adds space.</p></div><span class="flux-hint">TRACKPAD + TOUCH</span></div><div class="flux-body"><div id="fluxPad" class="flux-pad" role="slider" aria-label="Tone and space performance pad" tabindex="0"><div class="flux-grid"></div><span class="flux-axis flux-axis-x">DARK <b>TONE</b> BRIGHT</span><span class="flux-axis flux-axis-y">WET <b>SPACE</b> DRY</span><i id="fluxOrb" class="flux-orb"></i></div><div class="flux-side"><div class="flux-readout"><span>TONE<strong id="fluxTone">7.0k</strong></span><span>SPACE<strong id="fluxSpace">18%</strong></span></div><div class="flux-scenes"><button data-tone="9800" data-space=".04" type="button">Tight</button><button data-tone="4300" data-space=".18" type="button">Warm</button><button data-tone="7200" data-space=".52" type="button">Dream</button></div><small>Tip: hold a chord with <kbd>1–7</kbd> and move the pad with the trackpad at the same time.</small></div></div>`;
  workspace.appendChild(panel);
  const pad=$('#fluxPad');const move=e=>{const r=pad.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);v5SetFx(700+x*(12000-700),(1-y)*.65)};
  pad.addEventListener('pointerdown',e=>{e.preventDefault();pad.setPointerCapture?.(e.pointerId);move(e)});pad.addEventListener('pointermove',e=>{if(pad.hasPointerCapture?.(e.pointerId)){e.preventDefault();move(e)}});
  pad.addEventListener('keydown',e=>{const toneStep=400,spaceStep=.035;if(e.key==='ArrowLeft')v5SetFx(V4_PLAY_EXPR.tone-toneStep,V4_PLAY_EXPR.space);else if(e.key==='ArrowRight')v5SetFx(V4_PLAY_EXPR.tone+toneStep,V4_PLAY_EXPR.space);else if(e.key==='ArrowUp')v5SetFx(V4_PLAY_EXPR.tone,V4_PLAY_EXPR.space+spaceStep);else if(e.key==='ArrowDown')v5SetFx(V4_PLAY_EXPR.tone,V4_PLAY_EXPR.space-spaceStep);else return;e.preventDefault()});
  panel.querySelectorAll('.flux-scenes button').forEach(b=>b.addEventListener('click',()=>v5SetFx(+b.dataset.tone,+b.dataset.space)));v5PaintFluxPad();
}

function v5ApplyLayerMix(){if(!ctx)return;session.layers.forEach(l=>{ensureLayerGain(l);const audible=!l.muted&&(v5SoloLayer===null||v5SoloLayer===l.id),level=audible?(l.volume??.9):0;try{l.gain.gain.setTargetAtTime(level,ctx.currentTime,.018)}catch{l.gain.gain.value=level}})}
function v5ClearLayer(l){stopLayerSource(l);l.blob=null;l.buffer=null;l.recordedBpm=null;l.recordedBars=null;if(sessionPlaying)stopSession();renderSession()}
function v5EnhanceLayerRail(){
  const rail=$('#layerRail'),stage=$('.record-stage');if(!rail||!session.layers?.length)return;stage?.classList.toggle('v5-rail-expanded',v5ExpandedLayer!==null);
  rail.innerHTML=session.layers.map((l,i)=>{const expanded=v5ExpandedLayer===l.id,done=!!l.buffer,current=i===session.current,solo=v5SoloLayer===l.id;return `<article class="v5-layer-card ${current?'current':''} ${done?'done':''} ${expanded?'expanded':''}" data-layer="${i}"><div class="v5-layer-row"><button class="v5-layer-select" type="button"><span class="rail-number">${String(i+1).padStart(2,'0')}</span><span class="v5-layer-copy"><strong>${l.name}</strong><small>${l.sourceLabel||'Empty'}${done?' • recorded':''}</small></span><span class="v5-layer-state">${solo?'SOLO':l.muted?'MUTED':current?'NOW':done?'READY':'—'}</span></button><button class="v5-layer-expand" type="button" aria-expanded="${expanded}" aria-label="${expanded?'Collapse':'Expand'} layer ${i+1}">${expanded?'−':'+'}</button></div><div class="v5-layer-mixer" ${expanded?'':'hidden'}><label class="v5-level"><span>Volume <b>${Math.round((l.volume??.9)*100)}%</b></span><input type="range" min="0" max="1" step=".01" value="${l.volume??.9}" data-mix="volume"></label><div class="v5-mix-actions"><button class="${l.muted?'active':''}" data-mix="mute" type="button">${l.muted?'Unmute':'Mute'}</button><button class="${solo?'solo-active':''}" data-mix="solo" type="button">${solo?'Unsolo':'Solo'}</button><button data-mix="edit" type="button">Open</button><button class="danger" data-mix="clear" type="button" ${done?'':'disabled'}>Clear</button></div></div></article>`}).join('');
  rail.querySelectorAll('.v5-layer-card').forEach(card=>{const i=+card.dataset.layer,l=session.layers[i];card.querySelector('.v5-layer-select').addEventListener('click',()=>{if(recordBusy)return;session.current=i;renderSession()});card.querySelector('.v5-layer-expand').addEventListener('click',e=>{e.stopPropagation();if(recordBusy)return;v5ExpandedLayer=v5ExpandedLayer===l.id?null:l.id;v5EnhanceLayerRail()});const vol=card.querySelector('[data-mix="volume"]');if(vol)vol.addEventListener('input',e=>{l.volume=+e.target.value;card.querySelector('.v5-level b').textContent=`${Math.round(l.volume*100)}%`;v5ApplyLayerMix()});card.querySelector('[data-mix="mute"]')?.addEventListener('click',()=>{l.muted=!l.muted;v5ApplyLayerMix();v5EnhanceLayerRail()});card.querySelector('[data-mix="solo"]')?.addEventListener('click',()=>{v5SoloLayer=v5SoloLayer===l.id?null:l.id;v5ApplyLayerMix();v5EnhanceLayerRail()});card.querySelector('[data-mix="edit"]')?.addEventListener('click',()=>{session.current=i;v5ExpandedLayer=null;renderSession()});card.querySelector('[data-mix="clear"]')?.addEventListener('click',()=>v5ClearLayer(l))});
}
const v5BaseRenderSession=renderSession;
renderSession=function(){const out=v5BaseRenderSession();v5EnhanceLayerRail();v5NormalizeSoundMenus();v5AnnotateChordPads();setTimeout(()=>{v5NormalizeSoundMenus();v5AnnotateChordPads();v5EnhanceRecordTools()},0);return out};
function v5EnhanceRecordTools(){if(currentScreen!=='record'||!session.layers.length)return;const l=sessionLayer();v5NormalizeSoundMenus();if(['keys','chords','bass'].includes(l.source)){const key=$('#recordKeyboard');if(key){key.classList.add('v5-full-record-keyboard');const preset=l.source==='bass'?(l.sound||'Finger Bass'):(l.sound||'Studio Grand');renderKeyboard('#recordKeyboard',{octave:l.source==='bass'?Math.max(1,(l.octave||3)-1):(l.octave||3),bass:l.source==='bass',mini:false,preset})}}v5AnnotateChordPads()}
const v5BaseRenderLayerTools=renderLayerTools;
renderLayerTools=function(){const out=v5BaseRenderLayerTools();setTimeout(v5EnhanceRecordTools,0);return out};
const v5BaseRenderPlayInstrument=renderPlayInstrument;
renderPlayInstrument=function(){const out=v5BaseRenderPlayInstrument();v5NormalizeSoundMenus();setTimeout(()=>{v5NormalizeSoundMenus();v5AnnotateChordPads();if(typeof v4RefreshPlayInstrument==='function')v4RefreshPlayInstrument();v5PaintFluxPad()},0);return out};
function v5Init(){v5NormalizeSoundMenus();v5InstallFluxPad();v5AnnotateChordPads();if(currentScreen==='record')v5EnhanceLayerRail();const chordObserver=new MutationObserver(()=>{v5NormalizeSoundMenus();v5AnnotateChordPads()});['playChords','layerSourceTools'].forEach(id=>{const el=$('#'+id);if(el)chordObserver.observe(el,{childList:true,subtree:true})});$('#playSound')?.addEventListener('change',()=>setTimeout(v5NormalizeSoundMenus,0));window.addEventListener('resize',()=>{if(currentScreen==='record')setTimeout(v5EnhanceRecordTools,0)})}
v5Init();