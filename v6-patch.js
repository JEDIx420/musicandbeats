/* V6 integration hardening — persistence, labels and dynamic Record-mode controls. */

/* The legacy Record renderer calls this control #recordFlavor. Hide it because every Smart Key now owns its own chord type. */
v6EnhanceRecordSmartKeys=function(){
  if(currentScreen!=='record'||!session.layers.length||sessionLayer().source!=='chords')return;
  const flavor=$('#recordFlavor');
  if(flavor)flavor.closest('label')?.classList.add('v6-hidden-control');
  const key=$('#recordKey'),l=sessionLayer();
  if(key){
    const label=key.closest('label');
    if(label&&label.firstChild?.nodeType===3)label.firstChild.textContent='Key preset';
    if(key.dataset.v6!=='1'){
      key.dataset.v6='1';
      key.addEventListener('change',()=>{
        l.key=key.value;
        l.smartKeys=v6DefaultSmartKeys(key.value);
        v6Edit.record=false;
        renderLayerTools();
      });
    }
  }
  v6SmartToolbar('#recordChords');
  renderChordPads('#recordChords',{key:l.key||'C',voicing:l.voicing||'close',octave:l.octave||3,preset:l.sound||'Studio Grand',mini:false});
};

/* Teach the base session model the new first-class source names. */
const v6OriginalSourceLabel=typeof sourceLabel==='function'?sourceLabel:null;
if(v6OriginalSourceLabel){
  sourceLabel=function(s){
    if(s==='guitar')return'Guitar';
    if(s==='chords'||s==='keys')return'Smart Keys';
    return v6OriginalSourceLabel(s);
  };
}

/* Avoid re-enumerating hardware on every knob/pedal movement; just mirror the current rig state into mounted controls. */
v6SyncGuitarUIs=function(){
  $$('.v6-guitar-rig').forEach(root=>{
    const state=root.querySelector('.v6-signal-state'),hero=root.querySelector('.v6-guitar-hero strong'),connect=root.querySelector('[data-guitar-connect]');
    if(hero)hero.textContent=v6GuitarState.patch;
    if(connect)connect.textContent=v6GuitarState.connected?'Reconnect':'Connect guitar';
    if(state&&!v6GuitarState.connected){state.classList.remove('live');state.textContent='Input not connected'}
    const patch=root.querySelector('[data-guitar-patch]');if(patch)patch.value=v6GuitarState.patch;
    const mon=root.querySelector('[data-guitar-monitor]');if(mon){mon.classList.toggle('active',v6GuitarState.monitor);mon.textContent=`Monitor ${v6GuitarState.monitor?'ON':'OFF'}`}
    root.querySelectorAll('[data-guitar-param]').forEach(inp=>{
      inp.value=v6GuitarState[inp.dataset.guitarParam];
      const b=inp.closest('.v6-knob')?.querySelector('b');
      if(b)b.textContent=inp.dataset.guitarParam==='tone'?`${(v6GuitarState.tone/1000).toFixed(1)}k`:`${Math.round(v6GuitarState[inp.dataset.guitarParam]*100)}%`;
    });
    root.querySelectorAll('.v6-pedal').forEach(p=>{
      const st=v6GuitarState.pedals[p.dataset.pedal];
      p.classList.toggle('on',st.on);
      p.querySelector('[data-pedal-amount]').value=st.amount;
      p.querySelector('[data-pedal-toggle]').textContent=st.on?'ON':'BYPASS';
    });
  });
};

/* Keep Timeline metadata in sync when bars/settings change. */
const v6OriginalRenderTimeline=v6RenderTimeline;
v6RenderTimeline=function(){
  v6OriginalRenderTimeline();
  const panel=$('#v6TimelinePanel');
  if(!panel)return;
  const legend=panel.querySelector('.v6-timeline-legend span:last-child');
  if(legend)legend.textContent=`${session.bars} bar${session.bars===1?'':'s'}`;
  $('#v6TimelineToggle')?.classList.toggle('active',v6TimelineOpen);
};

/* Persist custom Smart Keys, expression settings and guitar-rig state with the project. */
async function v6SaveProject(){
  if(!db)await openDB();
  const data={
    session:{
      bpm:session.bpm,bars:session.bars,countIn:session.countIn,current:session.current,
      layers:session.layers.map(l=>({
        id:l.id,name:l.name,source:l.source,sourceLabel:l.sourceLabel,blob:l.blob,volume:l.volume,muted:l.muted,
        recordedBpm:l.recordedBpm,recordedBars:l.recordedBars,pattern:l.pattern,sound:l.sound,key:l.key,flavor:l.flavor,
        voicing:l.voicing,octave:l.octave,smartKeys:l.smartKeys,expression:l.expression,guitarRig:l.guitarRig
      }))
    },
    playPattern,
    playSmartKeys:v6PlaySmartKeys,
    playSmartKeyPreset:v6PlaySmartKeyPreset,
    guitarState:{...v6Clone(v6GuitarState),connected:false,monitor:false}
  };
  await new Promise((res,rej)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(data,'last');tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
  const b=$('#saveBtn');if(b){b.textContent='Saved ✓';setTimeout(()=>b.textContent='Save',1200)}
}
function v6InstallPersistentSave(){
  const old=$('#saveBtn');if(!old||old.dataset.v6save==='1')return;
  const fresh=old.cloneNode(true);fresh.dataset.v6save='1';old.replaceWith(fresh);fresh.addEventListener('click',v6SaveProject);
}
async function v6RestoreExtras(){
  try{
    if(!db)await openDB();
    const d=await new Promise(res=>{const tx=db.transaction('projects'),r=tx.objectStore('projects').get('last');r.onsuccess=()=>res(r.result);r.onerror=()=>res(null)});
    if(!d)return;
    if(d.playSmartKeys){v6PlaySmartKeys=d.playSmartKeys;v6PlaySmartKeyPreset=d.playSmartKeyPreset||'C'}
    if(d.guitarState){
      const g=d.guitarState;v6GuitarState.patch=g.patch||v6GuitarState.patch;v6GuitarState.trim=g.trim??v6GuitarState.trim;
      v6GuitarState.tone=g.tone??v6GuitarState.tone;v6GuitarState.output=g.output??v6GuitarState.output;
      v6GuitarState.pedals=g.pedals||v6GuitarState.pedals;v6GuitarState.connected=false;v6GuitarState.monitor=false;
    }
    v6MigrateSession();
    if(currentScreen==='play')renderPlayInstrument();
    if(currentScreen==='record')renderSession();
  }catch(e){console.warn('Could not restore V6 project extras',e)}
}

v6InstallPersistentSave();
setTimeout(v6RestoreExtras,450);
