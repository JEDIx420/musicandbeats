/* Music & Beats V34 — mobile-first backing looper.
 * Core principle: Beats, Keys and Bass are musical/event loops locked to one
 * Web Audio master clock. Generated instruments are never captured through
 * MediaRecorder, removing the old timer/recording drift from the core flow.
 */
(()=>{
  if(window.MB_V34_LOOPER)return;

  const STORE='musicandbeats:v34:looper';
  const V34_KEY_SOUNDS=['Studio Grand','Soft Grand','Velvet EP','Tonewheel Organ','Dream Pad','Harmonium','Tanpura Drone','Bansuri Air','Sitar Pluck'];
  const V34_BASS_SOUNDS=['Acoustic Bass','Finger Bass','Pick Bass','Fretless Bass','Slap Bass 1','Slap Bass 2','Synth Bass 1','Synth Bass 2','Sub Bass','Deep Club Sub','Reese Bass','Acid Bass','FM House Bass','Pluck Bass','Future Growl','Warm Analog'];
  const TRACKS={
    beats:{muted:false},
    keys:{muted:false,events:[],sound:'Harmonium',key:'C'},
    bass:{muted:false,events:[],sound:'Sub Bass',key:'C'}
  };
  const state={
    bpm:100,bars:4,running:false,timer:null,nextStepTime:0,absoluteStep:0,
    pendingLane:null,pendingStartAbs:0,recordingLane:null,recordStartAbs:0,
    recordStartTime:0,recordEndAbs:0,recordStartStep:0,activeLane:'beats',
    beatStyle:'Worship',energy:3,beatPattern:null,liveHolds:new Map(),countInSteps:0,playbackBus:null,beatBus:null,starting:false,captureGrace:null
  };

  Object.assign(SOUND_PRESETS,{
    'Harmonium':{oscs:[['square',0,.31],['sine',12,.26],['square',12,.08],['sine',19,.08]],attack:.025,decay:.12,sustain:.84,release:.24,filter:4300,q:.8,gain:.58},
    'Tanpura Drone':{oscs:[['sawtooth',-12,.16],['triangle',0,.34],['sine',7,.22],['sine',12,.16]],attack:.11,decay:.2,sustain:.86,release:1.35,filter:3100,q:.9,gain:.46},
    'Bansuri Air':{oscs:[['sine',0,.62],['triangle',12,.12],['sine',19,.05]],attack:.075,decay:.14,sustain:.72,release:.55,filter:5100,q:.55,gain:.56},
    'Sitar Pluck':{oscs:[['sawtooth',0,.18],['triangle',12,.34],['sine',24,.12],['sine',31,.05]],attack:.002,decay:.16,sustain:.10,release:.42,filter:6700,q:1.8,gain:.62}
  });
  Object.assign(BEAT_PRESETS,{
    'Keherwa':{kick:[0,8],snare:[4,12],hat:[0,2,4,6,8,10,12,14]},
    'Dadra':{kick:[0,6,12],snare:[3,9,15],hat:[0,3,6,9,12,15]}
  });

  function totalSteps(){return Math.max(16,state.bars*16)}
  function stepSeconds(){return 60/state.bpm/4}
  function loopSeconds(){return totalSteps()*stepSeconds()}
  function wrapStep(v){const n=totalSteps();return ((v%n)+n)%n}
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  function hydrate(){
    try{
      const x=JSON.parse(localStorage.getItem(STORE)||'null');if(!x)return;
      state.bpm=clamp(+x.bpm||100,40,220);state.bars=[1,2,4,8].includes(+x.bars)?+x.bars:4;
      state.beatStyle=BEAT_PRESETS[x.beatStyle]?x.beatStyle:'Worship';state.energy=clamp(+x.energy||3,1,5);
      if(x.beatPattern?.kick?.length===16)state.beatPattern=x.beatPattern;
      ['keys','bass'].forEach(k=>{
        if(Array.isArray(x[k]?.events))TRACKS[k].events=x[k].events.filter(e=>Array.isArray(e.midis)&&Number.isFinite(e.step)).map(e=>({...e,step:wrapStep(e.step),durationSteps:Math.max(1,+e.durationSteps||1)}));
        if(x[k]?.sound&&SOUND_PRESETS[x[k].sound])TRACKS[k].sound=x[k].sound;
        if(x[k]?.key&&NOTES.includes(x[k].key))TRACKS[k].key=x[k].key;
        TRACKS[k].muted=!!x[k]?.muted;
      });
      TRACKS.beats.muted=!!x.beats?.muted;
    }catch(e){console.warn('V34 state restore skipped',e)}
  }
  function persist(){
    try{localStorage.setItem(STORE,JSON.stringify({
      bpm:state.bpm,bars:state.bars,beatStyle:state.beatStyle,energy:state.energy,beatPattern:state.beatPattern,
      beats:{muted:TRACKS.beats.muted},
      keys:{muted:TRACKS.keys.muted,events:TRACKS.keys.events,sound:TRACKS.keys.sound,key:TRACKS.keys.key},
      bass:{muted:TRACKS.bass.muted,events:TRACKS.bass.events,sound:TRACKS.bass.sound,key:TRACKS.bass.key}
    }))}catch{}
  }

  function rebuildBeat(variation=false){state.beatPattern=loadBeat(state.beatStyle,state.energy,variation);persist();renderBeatEditor();renderTracks()}

  function installHome(){
    const home=document.querySelector('#homeScreen');if(!home)return;
    home.innerHTML=`<div class="v34-home-card">
      <span class="v34-kicker">MOBILE LOOP WORKSTATION</span>
      <h1>Build a backing track.<br><span>Play over it.</span></h1>
      <p>Beats, chords and bass — one synced loop, without a recording workflow getting in the way.</p>
      <button id="v34Enter" class="v34-enter" type="button"><span>▶</span><strong>Play</strong></button>
      <div class="v34-home-chips"><span>🥁 Beats</span><span>🎹 Keys</span><span>♩ Bass</span></div>
      <small>Bar-quantized looping · Web Audio clock · Local-first</small>
    </div>`;
    document.querySelector('#v34Enter')?.addEventListener('click',async()=>{await ensureAudio();openLooper()});
  }

  function installLooper(){
    if(document.querySelector('#v34LooperScreen'))return;
    const main=document.querySelector('main');if(!main)return;
    const s=document.createElement('section');s.id='v34LooperScreen';s.className='screen v34-looper-screen';
    s.innerHTML=`
      <div class="v34-shell">
        <header class="v34-titlebar"><div><span class="v34-kicker">LIVE BACKING LOOPER</span><h1>Looper</h1></div><span id="v34SyncBadge" class="v34-sync-badge">BAR SYNC</span></header>
        <section class="v34-transport">
          <button id="v34Transport" class="v34-main-play" type="button"><span>▶</span><strong>Play</strong></button>
          <div class="v34-tempo"><button id="v34BpmDown" type="button">−</button><label><small>BPM</small><input id="v34Bpm" type="number" min="40" max="220" inputmode="numeric"></label><button id="v34BpmUp" type="button">+</button></div>
          <div class="v34-bars"><small>LOOP</small><div id="v34BarChoices">${[1,2,4,8].map(n=>`<button data-bars="${n}" type="button">${n}</button>`).join('')}</div></div>
          <div class="v34-clock"><div class="v34-clock-ring" id="v34ClockRing"><span id="v34ClockText">1.1</span></div><div><strong id="v34ClockStatus">Ready</strong><small id="v34ClockHint">Tap Play, or record a Keys/Bass loop.</small></div></div>
        </section>
        <section id="v34Tracks" class="v34-tracks"></section>
        <section id="v34Workspace" class="v34-workspace"></section>
      </div>`;
    main.appendChild(s);
    bindGlobalControls();
  }

  function openLooper(){
    stopScheduler();stopSession();playBeatRunning=false;panic();
    document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
    document.querySelector('#v34LooperScreen')?.classList.add('active');
    try{currentScreen='v34-looper'}catch{}
    state.activeLane='beats';renderAll();window.scrollTo({top:0,behavior:'instant'});
  }

  function bindGlobalControls(){
    const bpm=document.querySelector('#v34Bpm');bpm.value=state.bpm;
    document.querySelector('#v34Transport').addEventListener('click',()=>state.running?stopTransport():startTransport(false));
    document.querySelector('#v34BpmDown').addEventListener('click',()=>setBpm(state.bpm-1));
    document.querySelector('#v34BpmUp').addEventListener('click',()=>setBpm(state.bpm+1));
    bpm.addEventListener('change',()=>setBpm(+bpm.value||100));
    document.querySelector('#v34BarChoices').addEventListener('click',e=>{const b=e.target.closest('button[data-bars]');if(b)setBars(+b.dataset.bars)});
  }

  function setBpm(v){
    const was=state.running;state.bpm=clamp(v,40,220);document.querySelector('#v34Bpm').value=state.bpm;persist();
    if(was){stopTransport();startTransport(false)}renderTransport();
  }
  function setBars(v){
    if(![1,2,4,8].includes(v))return;
    const was=state.running;state.bars=v;
    ['keys','bass'].forEach(k=>TRACKS[k].events=TRACKS[k].events.filter(e=>e.step<totalSteps()).map(e=>({...e,step:wrapStep(e.step)})));
    persist();if(was){stopTransport();startTransport(false)}renderAll();
  }

  async function startTransport(withCountIn=false){
    if(state.running||state.starting)return;state.starting=true;try{await ensureAudio()}catch(e){state.starting=false;throw e}state.starting=false;stopScheduler();stopSession();playBeatRunning=false;
    state.playbackBus=ctx.createGain();state.playbackBus.gain.value=1;state.playbackBus.connect(synthBus);
    state.beatBus=ctx.createGain();state.beatBus.gain.value=1;state.beatBus.connect(drumBus);
    state.running=true;state.absoluteStep=0;state.nextStepTime=ctx.currentTime+.08;state.countInSteps=withCountIn?16:0;
    renderTransport();
    state.timer=setInterval(schedulerTick,25);schedulerTick();
  }
  function stopTransport({keepPending=false}={}){
    if(state.timer)clearInterval(state.timer);state.timer=null;state.running=false;state.countInSteps=0;
    if(!keepPending)state.pendingLane=null;
    if(state.recordingLane)finishRecording(true);
    try{if(state.playbackBus){state.playbackBus.gain.setValueAtTime(0,ctx.currentTime);state.playbackBus.disconnect()}}catch{}state.playbackBus=null;
    try{if(state.beatBus){state.beatBus.gain.setValueAtTime(0,ctx.currentTime);state.beatBus.disconnect()}}catch{}state.beatBus=null;
    state.absoluteStep=0;panic();renderTransport();updateClock(0,'Ready','Tap Play, or record a Keys/Bass loop.');
  }
  function schedulerTick(){
    if(!state.running||!ctx)return;
    while(state.nextStepTime<ctx.currentTime+.12){
      if(state.countInSteps>0){
        const left=state.countInSteps;if(left%4===0)click(state.nextStepTime,left===16);
        const beat=5-Math.ceil(left/4);scheduleUi(state.nextStepTime,()=>updateClock(0,'Count in',`Recording starts in ${Math.max(1,beat)}…`));
        state.countInSteps--;state.nextStepTime+=stepSeconds();
        if(state.countInSteps===0){state.absoluteStep=0;if(state.pendingLane)state.pendingStartAbs=0}
        continue;
      }
      const abs=state.absoluteStep,step=abs%totalSteps();
      if(state.recordingLane&&abs>=state.recordEndAbs)finishRecording(false,state.nextStepTime);
      if(state.pendingLane&&abs>=state.pendingStartAbs&&step===0&&!state.recordingLane)beginRecording(state.pendingLane,abs,state.nextStepTime);
      scheduleStep(step,state.nextStepTime);
      scheduleUi(state.nextStepTime,()=>{
        const bar=Math.floor(step/16)+1,beat=Math.floor((step%16)/4)+1;
        updateClock((step+1)/totalSteps(),state.recordingLane?`Recording ${titleLane(state.recordingLane)}`:'Playing',`${bar}.${beat} · ${state.bars} bar loop`,step);
        renderTracksLight();
        updateRecordButtons(bar);
      });
      state.absoluteStep++;state.nextStepTime+=stepSeconds();
    }
  }
  function scheduleUi(t,fn){setTimeout(()=>{if(!state.running)return;fn()},Math.max(0,(t-ctx.currentTime)*1000))}
  function scheduleStep(step,t){
    if(!TRACKS.beats.muted&&state.beatPattern){const s=step%16;if(state.beatPattern.kick[s])kick(t,state.beatBus||drumBus);if(state.beatPattern.snare[s])snare(t,state.beatBus||drumBus);if(state.beatPattern.hat[s])hat(t,state.beatBus||drumBus)}
    ['keys','bass'].forEach(lane=>{
      if(TRACKS[lane].muted||state.recordingLane===lane)return;
      TRACKS[lane].events.forEach(e=>{if(wrapStep(e.step)===step)v34ScheduleEvent(e,t)});
    });
  }
  function v34ScheduleEvent(e,t){
    const dur=Math.max(stepSeconds(),(+e.durationSteps||1)*stepSeconds());
    (e.midis||[]).forEach((m,i)=>v34ScheduleVoice(+m,e.preset||'Studio Grand',Math.max(.38,.76-i*.025),t,dur));
  }
  function v34ScheduleVoice(m,p,v,start,dur){
    if(window.MB_V39?.sampleManager && window.MB_V38?.SAMPLE_VOICES?.[p]){
      const sm=window.MB_V39.sampleManager;
      const spec=window.MB_V38.SAMPLE_VOICES[p];
      const prog=window[spec?.variable];
      const z=sm.zoneFor(prog,m);
      const b=sm.decodedBuffers?.get?.(z);
      if(b && ctx){
        const src=ctx.createBufferSource(),g=ctx.createGain();
        const base=(+z.originalPitch||6000)/100+(+z.coarseTune||0)+(+z.fineTune||0)/100;
        src.buffer=b;
        if(+z.loopStart>=0&&+z.loopEnd>+z.loopStart){
          src.loop=true;src.loopStart=z.loopStart/(z.sampleRate||b.sampleRate);src.loopEnd=z.loopEnd/(z.sampleRate||b.sampleRate);
        }
        g.gain.setValueAtTime(.0001,start);
        g.gain.exponentialRampToValueAtTime(Math.max(.001,v*.88),start+.008);
        g.gain.setValueAtTime(Math.max(.001,v*.88),Math.max(start+.008,start+dur-.05));
        g.gain.exponentialRampToValueAtTime(.0001,start+dur);
        const targetBus=(state.playbackBus?.context===ctx?state.playbackBus:(synthBus?.context===ctx?synthBus:ctx.destination));
        src.connect(g).connect(targetBus);
        const r=Math.pow(2,(m-base)/12);
        try{src.playbackRate.setValueAtTime(r,start)}catch{}
        src.start(start,Math.max(0,+z.delay||0));
        src.stop(start+dur+.1);
        return;
      }
    }
    const targetBus=(state.playbackBus?.context===ctx?state.playbackBus:(synthBus?.context===ctx?synthBus:ctx.destination));
    const s=SOUND_PRESETS[p]||SOUND_PRESETS['Studio Grand'],g=ctx.createGain(),f=ctx.createBiquadFilter();f.type='lowpass';
    const baseCut=s.filter||2000;
    f.frequency.setValueAtTime(baseCut,start);
    f.Q.value=s.q||.3;
    const envMul=s.v17?.filterEnv||(s.filterEnv??1);
    if(envMul!==1){
      f.frequency.setValueAtTime(Math.min(16000,baseCut*envMul),start);
      f.frequency.exponentialRampToValueAtTime(Math.max(80,baseCut),start+Math.max(.04,(s.decay||.2)*.75));
    }
    const attack=Math.min(Math.max(.003,s.attack||.004),dur*.22),decay=Math.min(Math.max(.015,s.decay||.2),dur*.28),rel=Math.min(Math.max(.04,s.release||.3),dur*.45);
    const attackEnd=start+attack,decayEnd=Math.min(start+dur*.58,attackEnd+decay),releaseAt=Math.max(decayEnd,start+dur-rel);
    g.gain.setValueAtTime(.0001,start);g.gain.exponentialRampToValueAtTime(Math.max(.001,s.gain*v),attackEnd);g.gain.exponentialRampToValueAtTime(Math.max(.001,s.gain*s.sustain*v),decayEnd);
    g.gain.setValueAtTime(Math.max(.001,s.gain*s.sustain*v),releaseAt);g.gain.exponentialRampToValueAtTime(.0001,start+dur);
    f.connect(g).connect(targetBus);
    s.oscs.forEach(def=>{
      const [type,semi,lev,cents=0]=def;
      const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;
      o.frequency.setValueAtTime(midiToFreq(m+semi),start);
      if(cents)try{o.detune.setValueAtTime(cents,start)}catch{}
      og.gain.value=lev;o.connect(og).connect(f);o.start(start);o.stop(start+dur+.03);
    });
  }

  function armLane(lane){
    if(!['keys','bass'].includes(lane))return;
    if(state.recordingLane===lane){finishRecording(false);return}
    if(state.pendingLane===lane){
      state.pendingLane=null;state.pendingStartAbs=0;
      renderTracks();renderWorkspace();updateRecordButtons();
      if(state.running){
        const step=state.absoluteStep%totalSteps(),bar=Math.floor(step/16)+1,beat=Math.floor((step%16)/4)+1;
        updateClock((step+1)/totalSteps(),'Playing',`${bar}.${beat} · ${state.bars} bar loop`,step);
      } else {
        updateClock(0,'Ready','Tap Play, or record a Keys/Bass loop.');
      }
      return;
    }
    state.pendingLane=lane;
    if(!state.running){
      startTransport(true);state.pendingStartAbs=0;
    } else {
      const tot=totalSteps();
      state.pendingStartAbs=Math.ceil((state.absoluteStep+1)/tot)*tot;
    }
    renderTracks();renderWorkspace();updateRecordButtons();
    updateClock(0,'Armed',`${titleLane(lane)} recording starts at 1.1`);
  }
  function beginRecording(lane,abs,t){
    state.pendingLane=null;state.recordingLane=lane;state.recordStartAbs=abs;state.recordEndAbs=abs+totalSteps();state.recordStartTime=t;state.recordStartStep=abs%totalSteps();
    TRACKS[lane].events=[];persist();renderAll();updateRecordButtons();
    for(const h of state.liveHolds.values())if(h.lane===lane){
      h.captured=false;h.startedAt=t;h.captureMeta={lane,startTime:t,startStep:0,boundary:t+totalSteps()*stepSeconds()};
    }
    window.MB_V39?.carryForwardRecord?.(lane,t);
  }
  function updateRecordButtons(bar){
    const currentBar=bar||Math.floor((state.absoluteStep%totalSteps())/16)+1;
    const kb=document.querySelector('#v34KeysRecord');
    if(kb){
      if(state.recordingLane==='keys'){
        kb.className='v34-accent v34-rec-recording';
        kb.textContent=`● Recording chord loop (${currentBar}/${state.bars})`;
      }else if(state.pendingLane==='keys'){
        kb.className='v34-accent v34-rec-armed';
        kb.textContent='● Armed · starts at 1.1';
      }else{
        kb.className='v34-accent';
        kb.textContent='● Record chord loop';
      }
    }
    const bb=document.querySelector('#v34BassRecord');
    if(bb){
      if(state.recordingLane==='bass'){
        bb.className='v34-accent v34-rec-recording';
        bb.textContent=`● Recording bass loop (${currentBar}/${state.bars})`;
      }else if(state.pendingLane==='bass'){
        bb.className='v34-accent v34-rec-armed';
        bb.textContent='● Armed · starts at 1.1';
      }else{
        bb.className='v34-accent';
        bb.textContent='● Record bass loop';
      }
    }
  }
  function normalizeTrackEvents(events, totSteps, isLatched=false){
    if(!Array.isArray(events)||!events.length)return [];
    const clean=events.filter(e=>e&&Number.isFinite(e.step)&&Number.isFinite(e.durationSteps)&&e.midis?.length)
      .map(e=>({
        step:((Math.round(e.step)%totSteps)+totSteps)%totSteps,
        durationSteps:Math.max(1,Math.min(totSteps,Math.round(e.durationSteps))),
        midis:[...e.midis],
        preset:e.preset
      }))
      .sort((a,b)=>a.step-b.step);
    if(!clean.length)return [];
    const deduped=[];
    for(let i=0;i<clean.length;i++){
      if(i<clean.length-1&&clean[i].step===clean[i+1].step)continue;
      deduped.push(clean[i]);
    }
    for(let i=0;i<deduped.length;i++){
      const curr=deduped[i];
      if(i<deduped.length-1){
        const next=deduped[i+1];
        const gap=next.step-(curr.step+curr.durationSteps);
        if(isLatched){
          curr.durationSteps=Math.max(1,next.step-curr.step);
        }else{
          if(gap>0&&gap<=1){
            curr.durationSteps=next.step-curr.step;
          }else if(gap<0){
            curr.durationSteps=Math.max(1,next.step-curr.step);
          }
        }
      }else{
        const gapToEnd=totSteps-(curr.step+curr.durationSteps);
        if(isLatched||gapToEnd<=1||gapToEnd<0){
          curr.durationSteps=totSteps-curr.step;
        }
      }
    }
    return deduped;
  }
  function finishRecording(cancelled=false,endTime=null){
    const lane=state.recordingLane;if(!lane)return;
    const boundary=endTime??ctx?.currentTime??0;
    const meta={lane,startTime:state.recordStartTime,startStep:state.recordStartStep,boundary};
    if(!cancelled&&ctx&&boundary>ctx.currentTime){state.captureGrace=meta;setTimeout(()=>{if(state.captureGrace===meta)state.captureGrace=null},Math.max(0,(boundary-ctx.currentTime)*1000)+24)}else state.captureGrace=null;
    for(const h of state.liveHolds.values())if(h.lane===lane){h.captureMeta=h.captureMeta||meta;captureHold(h,boundary,true)}
    window.MB_V39?.onFinishRecording?.(lane,boundary,cancelled);
    const latchOn=window.MB_V35?.extra?.[lane==='keys'?'latchKeys':'latchBass']||false;
    TRACKS[lane].events=normalizeTrackEvents(TRACKS[lane].events,totalSteps(),latchOn);
    state.recordingLane=null;persist();renderAll();updateRecordButtons();
    if(!cancelled)updateClock(1,`${titleLane(lane)} loop ready`,'Locked to the master grid');
  }
  function captureHold(h,endTime,forced=false){
    const meta=h.captureMeta||(state.recordingLane===h.lane?{lane:h.lane,startTime:state.recordStartTime,startStep:state.recordStartStep,boundary:Infinity}:null);if(!meta||meta.lane!==h.lane)return;
    const cappedEnd=Math.min(endTime,meta.boundary??endTime),relStart=(h.startedAt-meta.startTime)/stepSeconds(),relEnd=(cappedEnd-meta.startTime)/stepSeconds();
    let a=Math.round(relStart),b=Math.round(relEnd);a=clamp(a,0,totalSteps()-1);b=Math.max(a+1,b);
    const step=wrapStep(meta.startStep+a),durationSteps=Math.max(1,Math.min(totalSteps(),b-a));
    TRACKS[h.lane].events.push({step,durationSteps,midis:h.midis,preset:h.preset});
    if(!forced)persist();
  }

  function titleLane(l){return l==='keys'?'Keys':l==='bass'?'Bass':'Beats'}
  function trackStatus(lane){
    if(lane==='beats')return TRACKS.beats.muted?'Muted':'Pattern ready';
    if(state.recordingLane===lane)return 'Recording…';if(state.pendingLane===lane)return 'Armed';
    const n=TRACKS[lane].events.length;return n?`${n} event${n===1?'':'s'} loop`:'Empty';
  }

  function renderTracks(){
    const host=document.querySelector('#v34Tracks');if(!host)return;
    host.innerHTML=['beats','keys','bass'].map(lane=>{
      const active=state.activeLane===lane,has=lane==='beats'||TRACKS[lane].events.length>0,rec=state.recordingLane===lane,pending=state.pendingLane===lane;
      return `<article class="v34-track ${active?'active':''} ${rec?'recording':''}" data-lane="${lane}">
        <button class="v34-track-select" data-select="${lane}" type="button"><span class="v34-track-icon">${lane==='beats'?'🥁':lane==='keys'?'🎹':'♩'}</span><span><strong>${titleLane(lane)}</strong><small>${trackStatus(lane)}</small></span><i class="v34-track-led ${has&&!TRACKS[lane].muted?'on':''}"></i></button>
        <div class="v34-track-actions">
          ${lane==='beats'?'<button data-action="variation" type="button">Variation</button>':`<button class="v34-rec-action ${pending?'armed':''} ${rec?'live':''}" data-action="record" type="button">${rec?'Finish':pending?'Cancel':'● Loop'}</button><button data-action="clear" type="button" ${has?'':'disabled'}>Clear</button>`}
          <button data-action="mute" type="button">${TRACKS[lane].muted?'Unmute':'Mute'}</button>
        </div>
      </article>`;
    }).join('');
    host.onclick=e=>{
      const card=e.target.closest('.v34-track');if(!card)return;const lane=card.dataset.lane,action=e.target.closest('button')?.dataset.action,select=e.target.closest('button')?.dataset.select;
      if(select){state.activeLane=lane;renderTracks();renderWorkspace();return}
      if(action==='mute'){TRACKS[lane].muted=!TRACKS[lane].muted;persist();renderTracks();return}
      if(action==='clear'&&lane!=='beats'){TRACKS[lane].events=[];persist();renderTracks();return}
      if(action==='record')armLane(lane);
      if(action==='variation')rebuildBeat(true);
    };
  }
  function renderTracksLight(){
    document.querySelectorAll('.v34-track').forEach(el=>{
      const lane=el.dataset.lane;el.classList.toggle('recording',state.recordingLane===lane);
      const small=el.querySelector('.v34-track-select small');if(small)small.textContent=trackStatus(lane);
    });
  }

  function renderWorkspace(){
    const h=document.querySelector('#v34Workspace');if(!h)return;
    if(state.activeLane==='beats'){renderBeatWorkspace(h);return}
    if(state.activeLane==='keys'){renderKeysWorkspace(h);window.MB_V39?.decorateCore?.();return}
    renderBassWorkspace(h);
    window.MB_V39?.decorateCore?.();
  }
  function renderBeatWorkspace(h){
    h.innerHTML=`<div class="v34-work-head"><div><span class="v34-kicker">BEAT</span><h2>Groove</h2></div><small>Pattern stays locked to every bar.</small></div>
      <div class="v34-control-grid"><label>Style<select id="v34BeatStyle">${Object.keys(BEAT_PRESETS).map(x=>`<option ${x===state.beatStyle?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Energy<input id="v34Energy" type="range" min="1" max="5" value="${state.energy}"></label><button id="v34Variation" class="v34-accent" type="button">Generate variation</button></div>
      <div id="v34BeatEditor" class="v34-beat-editor"></div>`;
    h.querySelector('#v34BeatStyle').addEventListener('change',e=>{state.beatStyle=e.target.value;rebuildBeat(false)});
    h.querySelector('#v34Energy').addEventListener('input',e=>{state.energy=+e.target.value;persist()});
    h.querySelector('#v34Variation').addEventListener('click',()=>rebuildBeat(true));renderBeatEditor();
  }
  function renderBeatEditor(){
    const el=document.querySelector('#v34BeatEditor');if(!el||!state.beatPattern)return;
    const lanes=[['kick','KICK'],['snare','SNARE'],['hat','HAT']];el.innerHTML=lanes.map(([k,n])=>`<span>${n}</span><div>${state.beatPattern[k].map((on,i)=>`<button class="${on?'on':''}" data-lane="${k}" data-step="${i}" type="button"></button>`).join('')}</div>`).join('');
    el.onclick=e=>{const b=e.target.closest('button[data-lane]');if(!b)return;const k=b.dataset.lane,i=+b.dataset.step;state.beatPattern[k][i]=!state.beatPattern[k][i];b.classList.toggle('on',state.beatPattern[k][i]);persist()};
  }

  function renderKeysWorkspace(h){
    const t=TRACKS.keys,currentBar=Math.floor((state.absoluteStep%totalSteps())/16)+1;
    h.innerHTML=`<div class="v34-work-head"><div><span class="v34-kicker">KEYS</span><h2>Chord loop</h2></div><small>Tap ● Loop, then play these pads. Starts are quantized to 1/16.</small></div>
      <div class="v34-control-grid"><label>Voice<select id="v34KeysSound">${V34_KEY_SOUNDS.filter(x=>SOUND_PRESETS[x]).map(x=>`<option ${x===t.sound?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Key<select id="v34KeysKey">${NOTES.map(x=>`<option ${x===t.key?'selected':''}>${x}</option>`).join('')}</select></label><button id="v34KeysRecord" class="v34-accent ${state.recordingLane==='keys'?'v34-rec-recording':state.pendingLane==='keys'?'v34-rec-armed':''}" type="button">${state.recordingLane==='keys'?`● Recording chord loop (${currentBar}/${state.bars})`:state.pendingLane==='keys'?'● Armed · starts at 1.1':'● Record chord loop'}</button></div>
      <div id="v34ChordPads" class="v34-pad-grid"></div>`;
    h.querySelector('#v34KeysSound').addEventListener('change',e=>{t.sound=e.target.value;persist()});h.querySelector('#v34KeysKey').addEventListener('change',e=>{t.key=e.target.value;persist();renderKeysWorkspace(h)});h.querySelector('#v34KeysRecord').addEventListener('click',()=>armLane('keys'));renderChordSurface();
  }
  function renderChordSurface(){
    const el=document.querySelector('#v34ChordPads');if(!el)return;const t=TRACKS.keys;
    el.innerHTML=chordData(t.key).map((c,i)=>`<button class="v34-performance-pad" data-index="${i}" data-root="${c.name}" data-quality="${c.quality}" type="button"><strong>${FLAT[c.name]||c.name}${c.quality==='minor'?'m':c.quality==='dim'?'°':''}</strong><small>${c.roman}</small></button>`).join('');
    bindPads(el,'keys',b=>{
      const root=b.dataset.root,quality=b.dataset.quality,base=noteMidi(root,3),preset=TRACKS.keys.sound;
      const midis=preset==='Tanpura Drone'?[base-12,base,base+7,base+12]:voiced(chordIntervals('triad',quality),'open').map(x=>base+x);
      return{midis,preset};
    });
  }
  function renderBassWorkspace(h){
    const t=TRACKS.bass,currentBar=Math.floor((state.absoluteStep%totalSteps())/16)+1;
    h.innerHTML=`<div class="v34-work-head"><div><span class="v34-kicker">BASS</span><h2>Bass loop</h2></div><small>One octave of scale tones, locked to the same master grid.</small></div>
      <div class="v34-control-grid"><label>Voice<select id="v34BassSound">${V34_BASS_SOUNDS.filter(x=>SOUND_PRESETS[x]||window.MB_V38?.SAMPLE_VOICES?.[x]).map(x=>`<option ${x===t.sound?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Key<select id="v34BassKey">${NOTES.map(x=>`<option ${x===t.key?'selected':''}>${x}</option>`).join('')}</select></label><button id="v34BassRecord" class="v34-accent ${state.recordingLane==='bass'?'v34-rec-recording':state.pendingLane==='bass'?'v34-rec-armed':''}" type="button">${state.recordingLane==='bass'?`● Recording bass loop (${currentBar}/${state.bars})`:state.pendingLane==='bass'?'● Armed · starts at 1.1':'● Record bass loop'}</button></div>
      <div id="v34BassPads" class="v34-pad-grid v34-bass-grid"></div>`;
    h.querySelector('#v34BassSound').addEventListener('change',e=>{
      t.sound=e.target.value;persist();
      if(window.MB_V39?.sampleManager&&window.MB_V38?.SAMPLE_VOICES?.[e.target.value]){
        window.MB_V39.sampleManager.preloadVoice(e.target.value,24,60);
      }
    });h.querySelector('#v34BassKey').addEventListener('change',e=>{t.key=e.target.value;persist();renderBassWorkspace(h)});h.querySelector('#v34BassRecord').addEventListener('click',()=>armLane('bass'));renderBassSurface();
  }
  function renderBassSurface(){
    const el=document.querySelector('#v34BassPads');if(!el)return;const root=NOTES.indexOf(TRACKS.bass.key),scale=[0,2,4,5,7,9,11,12];
    el.innerHTML=scale.map((semi,i)=>{const m=noteMidi('C',2)+root+semi;return`<button class="v34-performance-pad v34-bass-pad" data-midi="${m}" type="button"><strong>${midiLabel(m)}</strong><small>${i+1}</small></button>`}).join('');
    bindPads(el,'bass',b=>({midis:[+b.dataset.midi],preset:TRACKS.bass.sound}));
  }
  function bindPads(el,lane,resolver){
    const end=(e,b)=>{const h=state.liveHolds.get(e.pointerId);if(!h)return;h.voices.forEach(v=>v.stop());captureHold(h,ctx?.currentTime||h.startedAt+.1);state.liveHolds.delete(e.pointerId);b?.classList.remove('active')};
    el.querySelectorAll('.v34-performance-pad').forEach(b=>{
      b.addEventListener('pointerdown',e=>{e.preventDefault();primeAudio();const r=resolver(b),voices=r.midis.map((m,i)=>startVoice(m,r.preset,.78-Math.min(i*.04,.2))),now=ctx.currentTime,grace=state.captureGrace&&state.captureGrace.lane===lane&&now<=state.captureGrace.boundary?state.captureGrace:null,captureMeta=state.recordingLane===lane?{lane,startTime:state.recordStartTime,startStep:state.recordStartStep,boundary:state.recordStartTime+loopSeconds()}:grace;state.liveHolds.set(e.pointerId,{lane,midis:r.midis,preset:r.preset,voices,startedAt:now,captureMeta});b.classList.add('active');try{b.setPointerCapture(e.pointerId)}catch{}});
      b.addEventListener('pointerup',e=>end(e,b));b.addEventListener('pointercancel',e=>end(e,b));b.addEventListener('lostpointercapture',e=>end(e,b));
    });
  }

  function renderTransport(){
    const b=document.querySelector('#v34Transport');if(b){b.classList.toggle('active',state.running);b.innerHTML=state.running?'<span>■</span><strong>Stop</strong>':'<span>▶</span><strong>Play</strong>'}
    const bpm=document.querySelector('#v34Bpm');if(bpm)bpm.value=state.bpm;
    document.querySelectorAll('#v34BarChoices button').forEach(x=>x.classList.toggle('active',+x.dataset.bars===state.bars));
  }
  function updateClock(progress,status,hint,forcedStep=null){
    const ring=document.querySelector('#v34ClockRing');if(ring)ring.style.setProperty('--progress',`${Math.max(0,Math.min(1,progress))*360}deg`);
    const step=forcedStep===null?(state.countInSteps?0:(state.absoluteStep%totalSteps())):forcedStep,bar=Math.floor(step/16)+1,beat=Math.floor((step%16)/4)+1;
    const text=document.querySelector('#v34ClockText');if(text)text.textContent=`${bar}.${beat}`;
    const st=document.querySelector('#v34ClockStatus');if(st)st.textContent=status;const hi=document.querySelector('#v34ClockHint');if(hi)hi.textContent=hint;
  }
  function renderAll(){renderTransport();renderTracks();renderWorkspace();updateClock(state.running?(state.absoluteStep%totalSteps())/totalSteps():0,state.running?'Playing':'Ready',state.running?`${state.bars} bar master loop`:'Tap Play, or record a Keys/Bass loop.')}

  function init(){
    document.documentElement.classList.add('mb-v34');document.body.classList.add('mb-v34');
    hydrate();if(!state.beatPattern)state.beatPattern=loadBeat(state.beatStyle,state.energy,false);
    installHome();installLooper();renderAll();
    document.querySelector('#homeBtn')?.addEventListener('click',()=>{if(state.running)stopTransport()},{capture:true});
    const save=document.querySelector('#saveBtn');if(save)save.hidden=true;
    const engine=document.querySelector('#engineBadge');if(engine)engine.hidden=true;
    window.addEventListener('pagehide',()=>{persist();if(state.running)stopTransport()});
    window.MB_V34_LOOPER={state,tracks:TRACKS,start:startTransport,stop:stopTransport,open:openLooper,normalizeTrackEvents,version:'v34'};
  }
  init();
})();
