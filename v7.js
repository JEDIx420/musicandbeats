/* Music & Beats V7 — ascending Smart Keys, legato arpeggiator and named project library. */
const V7_SCALE_DEGREES=[0,2,4,5,7,9,11];
let v7ArpReleaseTimer=null;
let v7ActiveProjectId=null;
let v7ActiveProjectName='';
const V7_PROJECT_INDEX='project:index:v7';

/* ---------- Smart Keys: preserve ascending scale register ---------- */
const v7LegacyDefaultSmartKeys=v6DefaultSmartKeys;
v6DefaultSmartKeys=function(key='C'){
  return chordData(key).map((c,i)=>({
    root:c.name,
    type:c.quality==='minor'?'minor':c.quality==='dim'?'dim':'major',
    roman:c.roman,
    _tonic:key,
    _degree:V7_SCALE_DEGREES[i],
    _slot:i
  }));
};
function v7LooksLikePreset(set,key){
  if(!Array.isArray(set)||set.length!==7)return false;
  const expected=chordData(key);
  return set.every((c,i)=>c&&c.roman!=='Custom'&&c.root===expected[i].name);
}
function v7NormalizeAscendingSet(set,key='C'){
  if(!v7LooksLikePreset(set,key))return set;
  set.forEach((c,i)=>{c._tonic=key;c._degree=V7_SCALE_DEGREES[i];c._slot=i});
  return set;
}
const v7LegacySmartSetFor=v6SmartSetFor;
v6SmartSetFor=function(id){
  const set=v7LegacySmartSetFor(id);
  const key=id==='#playChords'?(v6PlaySmartKeyPreset||$('#playKey')?.value||'C'):(session.layers.length?(sessionLayer().key||'C'):'C');
  return v7NormalizeAscendingSet(set,key);
};
v6ChordNotes=function(chord,voicing='close',octave=3){
  let base;
  if(Number.isFinite(chord?._degree)&&chord?._tonic){
    base=noteMidi(chord._tonic,octave)+chord._degree;
  }else{
    base=noteMidi(chord.root,octave)+(Number.isFinite(chord?._octaveLift)?chord._octaveLift*12:0);
  }
  const ints=voiced(V6_CHORD_INTERVALS[chord.type]||V6_CHORD_INTERVALS.major,voicing);
  return ints.map(i=>base+i);
};
const v7LegacyRenderChordPads=renderChordPads;
renderChordPads=function(id,opts={}){
  const result=v7LegacyRenderChordPads(id,opts);
  if(id!=='#playChords'&&id!=='#recordChords')return result;
  const set=v6SmartSetFor(id),host=$(id);
  if(v6SmartEditMode(id)&&host){
    host.querySelectorAll('.v6-smart-editor').forEach(card=>{
      const i=+card.dataset.index;
      card.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{
        const c=set[i];if(!c)return;
        delete c._tonic;delete c._degree;delete c._slot;c._octaveLift=0;
      }));
    });
  }
  return result;
};

/* ---------- Arp: legato retargeting instead of restart-on-every-chord ---------- */
const v7ImmediateStopArp=v6StopArp;
function v7HardStopArp(){
  clearTimeout(v7ArpReleaseTimer);v7ArpReleaseTimer=null;
  v7ImmediateStopArp(true);
}
v6StartArp=function(target){
  clearTimeout(v7ArpReleaseTimer);v7ArpReleaseTimer=null;
  if(!v6Arp.enabled)return;
  const previous=v6Arp.target;
  previous?.pad?.classList.remove('arp-active');
  v6Arp.target=target;
  target.pad?.classList.add('arp-active');
  /* Keep the clock alive. Only create it when no arp is already running. */
  if(!v6Arp.timer){
    v6Arp.index=0;
    v6Arp.nextAt=performance.now()+8;
    v6Arp.timer=setTimeout(v6ArpTick,8);
  }else if(previous?.chord!==target.chord){
    /* Start the new harmony at its first note on the next already-scheduled tick. */
    v6Arp.index=0;
  }
};
v6StopArp=function(force=true){
  const panicButton=document.activeElement?.matches?.('[data-arp-action="panic"]');
  const immediate=force==='immediate'||!v6Arp.enabled||playInstrument!=='chords'||document.hidden||panicButton;
  if(immediate){v7HardStopArp();return}
  clearTimeout(v7ArpReleaseTimer);
  /* A short musical grace period lets 1 -> 2 -> 3 hand off without dropping the arp clock. */
  v7ArpReleaseTimer=setTimeout(()=>{v7ArpReleaseTimer=null;v7ImmediateStopArp(true)},175);
};
v5TriggerNumberChord=function(index){
  if(v5NumberChordVoices.has(index))return true;
  const c=v5CurrentChordContext(),pad=c?.host?.querySelectorAll('.chord-pad')?.[index];
  if(!c||!pad)return false;
  const id=c.host.id==='playChords'?'#playChords':'#recordChords',set=v6SmartSetFor(id),chord=set[index];
  if(!chord)return false;primeAudio();
  if(c.host.id==='playChords'&&v6Arp.enabled){
    const target={chord,pad,preset:c.preset,octave:c.octave,voicing:c.voicing,index};
    v6StartArp(target);pad.classList.add('keyboard-active');v5NumberChordVoices.set(index,{arp:true,pad,target});return true;
  }
  const voices=v6StartSmartChord(chord,{voicing:c.voicing,octave:c.octave,preset:c.preset,velocity:.78});
  pad.classList.add('active','keyboard-active');v5NumberChordVoices.set(index,{voices,pad});return true;
};
v5ReleaseNumberChord=function(index){
  const hit=v5NumberChordVoices.get(index);if(!hit)return;
  v5NumberChordVoices.delete(index);
  if(hit.arp){
    hit.pad?.classList.remove('keyboard-active','active');
    const remaining=[...v5NumberChordVoices.values()].filter(x=>x.arp&&x.target);
    if(remaining.length){
      clearTimeout(v7ArpReleaseTimer);v7ArpReleaseTimer=null;
      const latest=remaining[remaining.length-1];v6StartArp(latest.target);
    }else{
      v6StopArp(true);
    }
    return;
  }
  hit.voices?.forEach(v=>v.stop());hit.pad?.classList.remove('active','keyboard-active');
};
window.addEventListener('blur',v7HardStopArp);
document.addEventListener('visibilitychange',()=>{if(document.hidden)v7HardStopArp()});
function v7AnnotateArp(){
  const note=$('#v6ArpPanel .v6-arp-note');
  if(note&&!note.dataset.v7){note.dataset.v7='1';note.innerHTML='Hold <kbd>1–7</kbd> or a Smart Key and move straight into the next chord. <span class="v7-arp-legato">Legato handoff</span> keeps the arp clock running.'}
}

/* ---------- Project library ---------- */
function v7DbRequest(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function v7StoreGet(key){if(!db)await openDB();return v7DbRequest(db.transaction('projects').objectStore('projects').get(key))}
async function v7StorePut(key,value){if(!db)await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function v7StoreDelete(key){if(!db)await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function v7ProjectIndex(){return(await v7StoreGet(V7_PROJECT_INDEX))||[]}
async function v7WriteIndex(index){await v7StorePut(V7_PROJECT_INDEX,index)}
function v7ProjectId(){return`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`}
function v7ProjectPayload(name,id){
  const now=Date.now();
  return{
    meta:{id,name:name||'Untitled Session',createdAt:now,updatedAt:now,bpm:session.bpm,bars:session.bars,layers:session.layers.length,recorded:session.layers.filter(l=>l.buffer||l.blob).length,screen:currentScreen},
    session:{
      bpm:session.bpm,bars:session.bars,countIn:session.countIn,current:session.current,
      layers:session.layers.map(l=>({id:l.id,name:l.name,source:l.source,sourceLabel:l.sourceLabel,blob:l.blob,volume:l.volume,muted:l.muted,recordedBpm:l.recordedBpm,recordedBars:l.recordedBars,pattern:l.pattern,sound:l.sound,key:l.key,flavor:l.flavor,voicing:l.voicing,octave:l.octave,smartKeys:l.smartKeys,expression:l.expression,guitarRig:l.guitarRig}))
    },
    playPattern,
    playSmartKeys:v6PlaySmartKeys,
    playSmartKeyPreset:v6PlaySmartKeyPreset,
    guitarState:{...v6Clone(v6GuitarState),connected:false,monitor:false}
  };
}
async function v7SaveNamedProject(name,id=v7ActiveProjectId){
  if(!id)id=v7ProjectId();
  const old=await v7StoreGet(`project:${id}`),payload=v7ProjectPayload(name||old?.meta?.name||v7ActiveProjectName||'Untitled Session',id);
  if(old?.meta?.createdAt)payload.meta.createdAt=old.meta.createdAt;
  payload.meta.id=id;payload.meta.updatedAt=Date.now();
  await v7StorePut(`project:${id}`,payload);
  /* Keep the old 'last' key fresh for backward-compatible quick restore. */
  await v7StorePut('last',payload);
  let index=await v7ProjectIndex();index=index.filter(x=>x.id!==id);index.unshift(payload.meta);await v7WriteIndex(index);
  v7ActiveProjectId=id;v7ActiveProjectName=payload.meta.name;v7Toast(`Saved “${payload.meta.name}”`);v7UpdateSaveButton();
  return payload;
}
async function v7DeleteProject(id){
  await v7StoreDelete(`project:${id}`);let index=await v7ProjectIndex();index=index.filter(x=>x.id!==id);await v7WriteIndex(index);
  if(v7ActiveProjectId===id){v7ActiveProjectId=null;v7ActiveProjectName='';v7UpdateSaveButton()}
  await v7RenderProjects();
}
function v7ApplyGuitarState(g){
  if(!g)return;v6GuitarState.patch=g.patch||v6GuitarState.patch;v6GuitarState.trim=g.trim??v6GuitarState.trim;v6GuitarState.tone=g.tone??v6GuitarState.tone;v6GuitarState.output=g.output??v6GuitarState.output;v6GuitarState.pedals=g.pedals||v6GuitarState.pedals;v6GuitarState.connected=false;v6GuitarState.monitor=false;
}
async function v7OpenProject(id){
  const d=await v7StoreGet(`project:${id}`);if(!d)return;
  stopScheduler();stopSession();panic();v7HardStopArp();
  if(d.playPattern)playPattern=d.playPattern;
  if(d.playSmartKeys){v6PlaySmartKeys=d.playSmartKeys;v6PlaySmartKeyPreset=d.playSmartKeyPreset||'C';v7NormalizeAscendingSet(v6PlaySmartKeys,v6PlaySmartKeyPreset)}
  v7ApplyGuitarState(d.guitarState);
  if(d.session){
    session.bpm=d.session.bpm||100;session.bars=d.session.bars||4;session.countIn=d.session.countIn??1;session.current=Math.min(d.session.current||0,Math.max(0,(d.session.layers?.length||1)-1));
    session.layers=(d.session.layers||[]).map((x,i)=>Object.assign(newLayer(i),x,{gain:null,buffer:null,playingSource:null}));session.layerCount=session.layers.length||4;
    session.layers.forEach(l=>{if(l.smartKeys)v7NormalizeAscendingSet(l.smartKeys,l.key||'C')});
    if(ctx)session.layers.forEach(ensureLayerGain);
  }
  v7ActiveProjectId=id;v7ActiveProjectName=d.meta?.name||'Untitled Session';v7UpdateSaveButton();
  const screen=d.meta?.screen==='play'?'play':'record';setScreen(screen);
  if(screen==='play'){renderPlayInstrument();renderSequencer('#playSequencer',playPattern);v6UpdateArpPanelState?.()}
  else{renderSession();v6RenderTimeline?.()}
  $('#v7ProjectsDialog')?.close();v7Toast(`Opened “${v7ActiveProjectName}”`);
}
function v7FmtDate(ts){try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(ts))}catch{return new Date(ts).toLocaleString()}}
function v7ProjectDialog(){
  let dlg=$('#v7ProjectsDialog');if(dlg)return dlg;
  dlg=document.createElement('dialog');dlg.id='v7ProjectsDialog';dlg.className='v7-project-dialog';dlg.innerHTML=`<div class="v7-project-shell"><div class="v7-project-head"><div><small>LOCAL PROJECT LIBRARY</small><h2>Your projects</h2><p>Sessions stay on this device and can include recorded audio, Smart Keys and instrument settings.</p></div><button data-project-close type="button">×</button></div><div class="v7-project-actions"><div><button class="v7-new-save" data-project-save-new type="button">＋ Save current as new</button><button data-project-refresh type="button">Refresh</button></div><span class="v7-project-count">0 projects</span></div><div class="v7-project-list"></div><div class="v7-save-row" hidden><input data-project-name maxlength="60" placeholder="Project name"><button data-project-confirm type="button">Save project</button></div></div>`;document.body.appendChild(dlg);
  dlg.querySelector('[data-project-close]').addEventListener('click',()=>dlg.close());
  dlg.querySelector('[data-project-refresh]').addEventListener('click',v7RenderProjects);
  dlg.querySelector('[data-project-save-new]').addEventListener('click',()=>v7ShowSaveRow(true));
  dlg.querySelector('[data-project-confirm]').addEventListener('click',async()=>{const input=dlg.querySelector('[data-project-name]'),name=input.value.trim()||`Session ${new Date().toLocaleDateString()}`;await v7SaveNamedProject(name,null);v7ShowSaveRow(false);await v7RenderProjects()});
  dlg.querySelector('[data-project-name]').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dlg.querySelector('[data-project-confirm]').click()}});
  return dlg;
}
function v7ShowSaveRow(show){const dlg=v7ProjectDialog(),row=dlg.querySelector('.v7-save-row'),input=dlg.querySelector('[data-project-name]');row.hidden=!show;if(show){input.value=v7ActiveProjectName?`${v7ActiveProjectName} Copy`:`Session ${new Date().toLocaleDateString()}`;setTimeout(()=>{input.focus();input.select()},20)}}
async function v7RenderProjects(){
  const dlg=v7ProjectDialog(),list=dlg.querySelector('.v7-project-list');let index=await v7ProjectIndex();
  index=index.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));dlg.querySelector('.v7-project-count').textContent=`${index.length} project${index.length===1?'':'s'}`;
  if(!index.length){list.innerHTML='<div class="v7-project-empty"><strong>No saved projects yet</strong>Build a loop, then save it here so you can come back later.</div>';return}
  list.innerHTML=index.map(m=>`<article class="v7-project-card ${m.id===v7ActiveProjectId?'active':''}" data-project-id="${m.id}"><div class="v7-project-main"><div class="v7-project-title-row"><strong>${v7Escape(m.name||'Untitled Session')}</strong>${m.id===v7ActiveProjectId?'<span class="v7-project-current">OPEN</span>':''}</div><div class="v7-project-meta"><span>♩ ${m.bpm||100} BPM</span><span>▥ ${m.bars||4} bars</span><span>◫ ${m.recorded||0}/${m.layers||0} recorded</span><span>${v7FmtDate(m.updatedAt||m.createdAt)}</span></div></div><div class="v7-project-actions-row"><button class="v7-open" data-project-open type="button">Open</button><button data-project-rename type="button">Rename</button><button class="v7-delete" data-project-delete type="button">Delete</button></div></article>`).join('');
  list.querySelectorAll('.v7-project-card').forEach(card=>{const id=card.dataset.projectId;card.querySelector('[data-project-open]').addEventListener('click',()=>v7OpenProject(id));card.querySelector('[data-project-delete]').addEventListener('click',async()=>{const title=card.querySelector('strong')?.textContent||'this project';if(confirm(`Delete “${title}”?`))await v7DeleteProject(id)});card.querySelector('[data-project-rename]').addEventListener('click',async()=>{const d=await v7StoreGet(`project:${id}`);if(!d)return;const next=prompt('Rename project',d.meta?.name||'Untitled Session');if(!next?.trim())return;d.meta.name=next.trim();d.meta.updatedAt=Date.now();await v7StorePut(`project:${id}`,d);let ix=await v7ProjectIndex();ix=ix.map(x=>x.id===id?{...x,name:d.meta.name,updatedAt:d.meta.updatedAt}:x);await v7WriteIndex(ix);if(v7ActiveProjectId===id){v7ActiveProjectName=d.meta.name;v7UpdateSaveButton()}await v7RenderProjects()})});
}
function v7Escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function v7Toast(text){let t=$('#v7ProjectToast');if(!t){t=document.createElement('div');t.id='v7ProjectToast';t.className='v7-project-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1700)}
function v7UpdateSaveButton(){const b=$('#saveBtn');if(!b)return;b.textContent=v7ActiveProjectId?'Save':'Save';b.title=v7ActiveProjectId?`Save changes to ${v7ActiveProjectName}`:'Save this session as a project'}
function v7InstallProjectUI(){
  const actions=$('.top-actions');if(actions&&!$('#v7ProjectsBtn')){const b=document.createElement('button');b.id='v7ProjectsBtn';b.className='ghost-btn v7-projects-btn';b.type='button';b.textContent='Projects';const save=$('#saveBtn');actions.insertBefore(b,save);b.addEventListener('click',async()=>{const dlg=v7ProjectDialog();await v7RenderProjects();dlg.showModal()})}
  const old=$('#saveBtn');if(old&&old.dataset.v7save!=='1'){const fresh=old.cloneNode(true);fresh.dataset.v7save='1';old.replaceWith(fresh);fresh.addEventListener('click',async()=>{if(v7ActiveProjectId){await v7SaveNamedProject(v7ActiveProjectName,v7ActiveProjectId)}else{const dlg=v7ProjectDialog();await v7RenderProjects();dlg.showModal();v7ShowSaveRow(true)}})}
  v7UpdateSaveButton();
}
async function v7MigrateLegacyProject(){
  try{let index=await v7ProjectIndex();if(index.length)return;const legacy=await v7StoreGet('last');if(!legacy?.session)return;const id=v7ProjectId(),name='Recovered Session';legacy.meta={id,name,createdAt:Date.now(),updatedAt:Date.now(),bpm:legacy.session.bpm||100,bars:legacy.session.bars||4,layers:legacy.session.layers?.length||0,recorded:legacy.session.layers?.filter(l=>l.blob).length||0,screen:'record'};await v7StorePut(`project:${id}`,legacy);await v7WriteIndex([legacy.meta])}catch(e){console.warn('Could not migrate legacy project',e)}}

function v7Init(){
  /* Ensure currently restored presets are upgraded to monotonic register metadata. */
  if(v6PlaySmartKeys)v7NormalizeAscendingSet(v6PlaySmartKeys,v6PlaySmartKeyPreset||'C');
  session.layers?.forEach(l=>{if(l.smartKeys)v7NormalizeAscendingSet(l.smartKeys,l.key||'C')});
  v7AnnotateArp();v7InstallProjectUI();
  setTimeout(()=>{v7AnnotateArp();v7MigrateLegacyProject()},650);
}
v7Init();
