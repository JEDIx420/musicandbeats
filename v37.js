/* Music & Beats V37 — exclusive-latch follow-up, live lead lane and backing mixer. */
(()=>{
  const V=window.MB_V35;
  const api=window.MB_V34_LOOPER;
  if(!V||!api||window.MB_V37)return;

  const {state,tracks}=api;
  const SETTINGS_KEY='musicandbeats:v37:settings';
  const PROJECTS_KEY='musicandbeats:v35:projects';
  const DEFAULTS={
    mix:{beats:.86,keys:.80,bass:.84,lead:1.10},
    lead:{voice:'Bansuri Lead',key:'C',scale:'Major Pentatonic',octave:4}
  };
  const LEAD_VOICES=['Bansuri Lead','Sitar Lead','Fusion Lead','Glass Lead'];
  const SCALES={
    'Major Pentatonic':[0,2,4,7,9,12,14,16],
    'Minor Pentatonic':[0,3,5,7,10,12,15,17],
    'Major':[0,2,4,5,7,9,11,12],
    'Natural Minor':[0,2,3,5,7,8,10,12]
  };
  const local={
    mix:{...DEFAULTS.mix},lead:{...DEFAULTS.lead},leadSelected:false,leadHold:null,
    leadInput:null,leadCompressor:null,presetBase:new Map(),scaled:{keys:new Set(),bass:new Set()},scanQueued:false
  };

  try{
    const saved=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');
    if(saved?.mix)Object.assign(local.mix,saved.mix);
    if(saved?.lead)Object.assign(local.lead,saved.lead);
  }catch{}
  for(const lane of Object.keys(local.mix)){
    const max=lane==='lead'?1.4:1.2;
    local.mix[lane]=Math.max(0,Math.min(max,Number(local.mix[lane])||DEFAULTS.mix[lane]));
  }
  local.lead.octave=[3,4,5].includes(Number(local.lead.octave))?Number(local.lead.octave):4;

  for(const [name,preset] of Object.entries(SOUND_PRESETS)){
    if(Number.isFinite(preset?.gain))local.presetBase.set(name,preset.gain);
  }
  Object.assign(SOUND_PRESETS,{
    'Bansuri Lead':{oscs:[['sine',0,.72],['triangle',12,.13],['sine',19,.04]],attack:.035,decay:.12,sustain:.82,release:.20,filter:7600,q:.8,gain:.63},
    'Sitar Lead':{oscs:[['sawtooth',0,.20],['triangle',12,.38],['sine',24,.10],['sine',31,.04]],attack:.002,decay:.12,sustain:.34,release:.24,filter:8500,q:2.1,gain:.66},
    'Fusion Lead':{oscs:[['sawtooth',0,.28],['square',12,.08],['sine',12,.18]],attack:.008,decay:.10,sustain:.70,release:.18,filter:6900,q:1.0,gain:.56},
    'Glass Lead':{oscs:[['triangle',0,.48],['sine',12,.30],['sine',24,.08]],attack:.012,decay:.16,sustain:.68,release:.34,filter:9200,q:.55,gain:.58}
  });

  const clone=value=>JSON.parse(JSON.stringify(value));
  const hasAudio=()=>typeof ctx!=='undefined'&&ctx;

  function saveLocal(){
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify({mix:local.mix,lead:local.lead}))}catch{}
    applyMix();
    syncMixer();
  }
  function baseGain(name){
    const preset=SOUND_PRESETS[name];
    if(!preset)return 1;
    if(!local.presetBase.has(name)&&Number.isFinite(preset.gain))local.presetBase.set(name,preset.gain);
    return local.presetBase.get(name)||preset.gain||1;
  }
  function applyLaneLevel(lane){
    const names=new Set([tracks[lane]?.sound,...(tracks[lane]?.events||[]).map(e=>e?.preset)].filter(name=>name&&SOUND_PRESETS[name]));
    for(const oldName of local.scaled[lane]){
      if(!names.has(oldName)&&local.presetBase.has(oldName)&&SOUND_PRESETS[oldName])SOUND_PRESETS[oldName].gain=local.presetBase.get(oldName);
    }
    for(const name of names)SOUND_PRESETS[name].gain=baseGain(name)*local.mix[lane];
    local.scaled[lane]=names;
  }
  function applyMix(){
    applyLaneLevel('keys');
    applyLaneLevel('bass');
    if(!hasAudio())return;
    const leadPlaying=!!local.leadHold;
    const backingDuck=leadPlaying?0.90:1;
    const beatDuck=leadPlaying?0.88:1;
    try{
      if(state.playbackBus?.gain){
        state.playbackBus.gain.cancelScheduledValues(ctx.currentTime);
        state.playbackBus.gain.setTargetAtTime(backingDuck,ctx.currentTime,.025);
      }
      if(state.beatBus?.gain){
        state.beatBus.gain.cancelScheduledValues(ctx.currentTime);
        state.beatBus.gain.setTargetAtTime(local.mix.beats*beatDuck,ctx.currentTime,.025);
      }
      if(local.leadInput?.gain){
        local.leadInput.gain.cancelScheduledValues(ctx.currentTime);
        local.leadInput.gain.setTargetAtTime(local.mix.lead,ctx.currentTime,.02);
      }
    }catch{}
  }

  function ensureLeadBus(){
    if(!hasAudio())return null;
    if(local.leadInput&&local.leadInput.context===ctx)return local.leadInput;
    try{local.leadInput?.disconnect()}catch{}
    const input=ctx.createGain();
    const highpass=ctx.createBiquadFilter();
    const presence=ctx.createBiquadFilter();
    const compressor=ctx.createDynamicsCompressor();
    input.gain.value=local.mix.lead;
    highpass.type='highpass';highpass.frequency.value=115;
    presence.type='peaking';presence.frequency.value=2600;presence.Q.value=.75;presence.gain.value=3.2;
    compressor.threshold.value=-18;compressor.knee.value=12;compressor.ratio.value=3;compressor.attack.value=.004;compressor.release.value=.12;
    input.connect(highpass).connect(presence).connect(compressor).connect(synthBus);
    local.leadInput=input;local.leadCompressor=compressor;
    return input;
  }
  function startLeadVoice(midi,presetName,velocity=.92){
    const preset=SOUND_PRESETS[presetName]||SOUND_PRESETS['Bansuri Lead'];
    const output=ensureLeadBus();
    if(!output||!hasAudio())return null;
    const filter=ctx.createBiquadFilter();
    const envelope=ctx.createGain();
    const now=ctx.currentTime;
    filter.type='lowpass';filter.frequency.value=preset.filter||7600;filter.Q.value=preset.q||.7;
    const peak=Math.max(.001,(preset.gain||.6)*velocity);
    const attack=Math.max(.002,preset.attack||.01);
    const decay=Math.max(.02,preset.decay||.12);
    envelope.gain.setValueAtTime(.0001,now);
    envelope.gain.exponentialRampToValueAtTime(peak,now+attack);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.001,peak*(preset.sustain??.72)),now+attack+decay);
    filter.connect(envelope).connect(output);
    const oscillators=(preset.oscs||[['sine',0,1]]).map(([type,semi,level])=>{
      const oscillator=ctx.createOscillator();
      const oscillatorGain=ctx.createGain();
      oscillator.type=type;oscillator.frequency.setValueAtTime(midiToFreq(midi+semi),now);oscillatorGain.gain.value=level;
      oscillator.connect(oscillatorGain).connect(filter);oscillator.start(now);return oscillator;
    });
    let stopped=false;
    return {stop(){
      if(stopped||!hasAudio())return;stopped=true;
      const at=ctx.currentTime;
      const release=Math.max(.05,Math.min(.45,preset.release||.18));
      try{
        envelope.gain.cancelScheduledValues(at);
        envelope.gain.setValueAtTime(Math.max(.001,envelope.gain.value||.01),at);
        envelope.gain.exponentialRampToValueAtTime(.0001,at+release);
      }catch{}
      for(const oscillator of oscillators){try{oscillator.stop(at+release+.03)}catch{}}
    }};
  }
  function stopLead(){
    const hold=local.leadHold;if(!hold)return;
    for(const voice of hold.voices||[])voice?.stop?.();
    hold.pad?.classList.remove('active');
    local.leadHold=null;applyMix();
  }
  function leadMidis(){
    const intervals=SCALES[local.lead.scale]||SCALES['Major Pentatonic'];
    const root=Math.max(0,NOTES.indexOf(local.lead.key));
    const base=noteMidi('C',local.lead.octave)+root;
    return intervals.map(interval=>base+interval);
  }
  function renderLeadPads(){
    const host=document.querySelector('#v37LeadPads');if(!host)return;
    host.innerHTML=leadMidis().map((midi,index)=>`<button class="v34-performance-pad v37-lead-pad" data-midi="${midi}" type="button"><strong>${midiLabel(midi)}</strong><small>${index+1}</small></button>`).join('');
    for(const pad of host.querySelectorAll('button')){
      pad.addEventListener('pointerdown',async event=>{
        event.preventDefault();await ensureAudio();primeAudio();stopLead();
        const voice=startLeadVoice(Number(pad.dataset.midi),local.lead.voice);
        if(!voice)return;
        pad.classList.add('active');local.leadHold={pointerId:event.pointerId,pad,voices:[voice]};
        try{pad.setPointerCapture(event.pointerId)}catch{}
        applyMix();
      });
      const end=event=>{if(local.leadHold?.pointerId===event.pointerId)stopLead()};
      pad.addEventListener('pointerup',end);pad.addEventListener('pointercancel',end);pad.addEventListener('lostpointercapture',end);
    }
  }
  function renderLeadWorkspace(){
    const workspace=document.querySelector('#v34Workspace');if(!workspace)return;
    workspace.innerHTML=`<div class="v34-work-head"><div><span class="v34-kicker">LEAD</span><h2>Play over your loop</h2></div><small>Live only. Lead Focus gives the solo extra presence and gently ducks the backing while you play.</small></div><div class="v34-control-grid v37-lead-controls"><label>Voice<select id="v37LeadVoice">${LEAD_VOICES.map(name=>`<option ${name===local.lead.voice?'selected':''}>${name}</option>`).join('')}</select></label><label>Key<select id="v37LeadKey">${NOTES.map(name=>`<option ${name===local.lead.key?'selected':''}>${name}</option>`).join('')}</select></label><label>Scale<select id="v37LeadScale">${Object.keys(SCALES).map(name=>`<option ${name===local.lead.scale?'selected':''}>${name}</option>`).join('')}</select></label><label>Octave<select id="v37LeadOctave">${[3,4,5].map(value=>`<option value="${value}" ${value===local.lead.octave?'selected':''}>${value}</option>`).join('')}</select></label></div><div class="v37-lead-tip"><strong>Lead Focus</strong><span>Presence EQ · light compression · automatic backing ducking</span></div><div id="v37LeadPads" class="v34-pad-grid v37-lead-grid"></div>`;
    workspace.querySelector('#v37LeadVoice').onchange=event=>{local.lead.voice=event.target.value;saveLocal()};
    workspace.querySelector('#v37LeadKey').onchange=event=>{local.lead.key=event.target.value;saveLocal();renderLeadPads()};
    workspace.querySelector('#v37LeadScale').onchange=event=>{local.lead.scale=event.target.value;saveLocal();renderLeadPads()};
    workspace.querySelector('#v37LeadOctave').onchange=event=>{local.lead.octave=Number(event.target.value);saveLocal();renderLeadPads()};
    renderLeadPads();
  }

  function backingReady(){return tracks.keys.events.length>0&&tracks.bass.events.length>0}
  function syncLeadCard(){
    const card=document.querySelector('#v37LeadTrack');if(!card)return;
    card.classList.toggle('active',local.leadSelected);
    const status=card.querySelector('small');
    const copy=backingReady()?'Ready to solo · live':'Live solo · build backing first';
    if(status&&status.textContent!==copy)status.textContent=copy;
    if(local.leadSelected)document.querySelectorAll('#v34Tracks .v34-track').forEach(track=>track.classList.remove('active'));
  }
  function installLeadCard(){
    const host=document.querySelector('#v34Tracks');if(!host)return;
    let card=document.querySelector('#v37LeadTrack');
    if(!card){
      card=document.createElement('article');card.id='v37LeadTrack';card.className='v37-track';
      card.innerHTML='<button class="v37-track-select" type="button"><span class="v34-track-icon">🎶</span><span><strong>Lead</strong><small></small></span><i class="v34-track-led on"></i></button>';
      host.appendChild(card);
      card.querySelector('button').onclick=()=>{stopLead();local.leadSelected=true;syncLeadCard();renderLeadWorkspace()};
    }
    syncLeadCard();
  }
  function syncMixer(){
    document.querySelector('#v37Mixer')?.remove();
    const cards=[
      ['beats',document.querySelector('.v34-track[data-lane="beats"]')],
      ['keys',document.querySelector('.v34-track[data-lane="keys"]')],
      ['bass',document.querySelector('.v34-track[data-lane="bass"]')],
      ['lead',document.querySelector('#v37LeadTrack')]
    ];
    cards.forEach(([lane,card])=>{
      if(!card)return;
      let wrap=card.querySelector('.v37-card-level');
      if(!wrap){
        wrap=document.createElement('div');
        wrap.className='v37-card-level';
        wrap.dataset.mixLane=lane;
        const max=lane==='lead'?140:120;
        wrap.innerHTML=`<div class="v37-level-head"><span>Level</span><output></output></div><input type="range" min="0" max="${max}" value="${Math.round(local.mix[lane]*100)}" aria-label="${lane} level">`;
        card.appendChild(wrap);
        const input=wrap.querySelector('input');
        input.oninput=e=>{
          local.mix[lane]=Number(e.target.value)/100;
          saveLocal();
        };
      }
      const input=wrap.querySelector('input'),output=wrap.querySelector('output');
      const val=Math.round(local.mix[lane]*100);
      if(document.activeElement!==input&&Number(input.value)!==val)input.value=String(val);
      const txt=`${val}%`;
      if(output&&output.textContent!==txt)output.textContent=txt;
    });
  }
  function installMixer(){
    syncMixer();
  }
  function decorateHome(){
    const chips=document.querySelector('.v34-home-chips');
    if(chips&&!chips.querySelector('[data-v37-lead]')){const chip=document.createElement('span');chip.dataset.v37Lead='1';chip.textContent='🎶 Lead';chips.appendChild(chip)}
    const copy=document.querySelector('.v34-home-card>p');
    if(copy&&copy.textContent.includes('Beats, chords and bass'))copy.textContent='Build beats, chords and bass into one synced backing loop, then play lead over it.';
  }
  function decorate(){
    installLeadCard();installMixer();decorateHome();
    if(local.leadSelected){syncLeadCard();const workspace=document.querySelector('#v34Workspace');if(workspace&&!workspace.querySelector('#v37LeadPads'))renderLeadWorkspace()}
    applyMix();
  }
  function scheduleDecorate(){
    if(local.scanQueued)return;local.scanQueued=true;
    requestAnimationFrame(()=>{local.scanQueued=false;decorate()});
  }

  document.addEventListener('click',event=>{
    if(event.target.closest?.('#v34Tracks .v34-track-select')){local.leadSelected=false;stopLead();setTimeout(syncLeadCard,0)}
    if(event.target.closest?.('#homeBtn'))stopLead();
  },true);
  window.addEventListener('pagehide',stopLead);window.addEventListener('blur',stopLead);

  const baseSave=V.saveProject.bind(V);
  const baseLoad=V.loadProject.bind(V);
  const baseNew=V.newProject.bind(V);
  V.saveProject=function(...args){
    const item=baseSave(...args);
    try{
      const list=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]');const target=list.find(project=>project.id===item?.id);
      if(target?.data){target.data.v37={mix:clone(local.mix),lead:clone(local.lead)};localStorage.setItem(PROJECTS_KEY,JSON.stringify(list))}
    }catch{}
    return item;
  };
  V.loadProject=function(id){
    let saved=null;try{saved=JSON.parse(localStorage.getItem(PROJECTS_KEY)||'[]').find(project=>project.id===id)?.data?.v37||null}catch{}
    stopLead();local.leadSelected=false;const result=baseLoad(id);
    Object.assign(local.mix,DEFAULTS.mix,saved?.mix||{});Object.assign(local.lead,DEFAULTS.lead,saved?.lead||{});saveLocal();setTimeout(decorate,0);return result;
  };
  V.newProject=function(){
    stopLead();local.leadSelected=false;const result=baseNew();Object.assign(local.mix,DEFAULTS.mix);Object.assign(local.lead,DEFAULTS.lead);saveLocal();setTimeout(decorate,0);return result;
  };

  new MutationObserver(scheduleDecorate).observe(document.body,{childList:true,subtree:true});
  setInterval(applyMix,120);
  window.MB_V37={version:'v37',mix:local.mix,lead:local.lead,stopLead,applyMix,decorate};
  V.version='v37';document.documentElement.classList.add('mb-v37');document.body.classList.add('mb-v37');decorate();
})();