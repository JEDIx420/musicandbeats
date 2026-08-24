/* Music & Beats V32 — contextual help, Help Center and Explain Controls mode.
   Native browser APIs only. No external dependencies. */
(()=>{
  if(window.MB_HELP)return;

  const HELP={
    'home.brand':{section:'Getting started',title:'Music & Beats home',short:'Return to the start screen.',body:'Takes you back to the Music & Beats home screen. Your locally saved projects remain available.',tip:'Use this whenever you want to switch between Play and Record workflows.'},
    'home.play':{section:'Getting started',title:'Play mode',short:'Jam immediately without building a recording session.',body:'Play mode is the quickest way to experiment. Choose Smart Keys, Bass or Guitar, add a Groove Box rhythm, shape the sound with Tone & FX, and optionally turn on Arp Lab.',tip:'Start here if you want to hear ideas quickly.'},
    'home.record':{section:'Getting started',title:'Record mode',short:'Build a BPM-locked loop one layer at a time.',body:'Record mode creates a structured session with a fixed BPM, bar length, count-in and layer count. Each layer is recorded against the same musical grid.',tip:'Use Record when you want a loop you can save and return to.'},
    'project.save':{section:'Projects',title:'Save project',short:'Save the current Music & Beats project locally.',body:'Stores the current project in this browser/device so you can reopen it later. Projects are local unless you export or move them yourself.',tip:'Save after meaningful changes, especially before closing the browser.'},
    'nav.back':{section:'Navigation',title:'Back / Home',short:'Return to the previous setup or home screen.',body:'Leaves the current workflow and returns to the previous screen or the Music & Beats home screen.',tip:'Stopping playback first is useful when you want a completely quiet transition.'},
    'play.audio':{section:'Play',title:'Start audio',short:'Unlock and start the browser audio engine.',body:'Browsers require a user gesture before Web Audio can run. Start Audio creates or resumes the AudioContext so instruments, beats, effects and ARP playback can make sound.',tip:'If controls move but you hear nothing, press Start Audio first.'},
    'play.transport':{section:'Play',title:'Beat transport',short:'Start or stop the Play-mode groove.',body:'Runs or stops the current Groove Box rhythm at the Play BPM. Instruments and ARP can be performed over it.',tip:'Set the BPM before starting if you already know the tempo you want.'},
    'play.bpm':{section:'Play',title:'BPM',short:'Sets the tempo for Play mode.',body:'BPM means beats per minute. It controls Groove Box timing, the metronome and BPM-locked ARP rates such as 1/8, 1/16 and 1/64.',tip:'Lower values feel slower and more spacious; higher values feel faster and denser.'},
    'play.metronome':{section:'Play',title:'Click / metronome',short:'Turns the tempo click on or off.',body:'Plays a regular timing reference at the current BPM so you can perform or practice against the grid.',tip:'Use the click when learning a part, then turn it off when the groove itself is enough.'},
    'instrument.tabs':{section:'Instruments',title:'Instrument tabs',short:'Choose Guitar, Smart Keys or Bass.',body:'Switches the main Play surface between the available performance instruments. Each instrument keeps its own relevant controls.',tip:'Smart Keys is the easiest starting point for chords; Bass is useful for low-end parts.'},
    'instrument.sound':{section:'Instruments',title:'Sound / preset',short:'Chooses the instrument sound.',body:'Selects the synth or instrument preset used by the current playable surface. Different presets can use different oscillator counts, filters and envelopes.',tip:'Heavier multi-oscillator presets can sound wider; simpler presets are useful for clean arrangements.'},
    'instrument.octave':{section:'Instruments',title:'Octave',short:'Moves the playable instrument up or down by octaves.',body:'Changes the register of the keyboard or Smart Keys without changing the harmonic pattern itself.',tip:'Lower octaves work well for bass-like parts; higher octaves help leads and pads sit above the mix.'},
    'smart.key':{section:'Smart Keys',title:'Key preset',short:'Builds the seven Smart Keys from a musical key.',body:'Creates the default seven scale-degree chords for the selected key. You can still edit individual chords afterwards.',tip:'Pick the key first, then customize only the chords you want to change.'},
    'smart.voicing':{section:'Smart Keys',title:'Voicing',short:'Changes how notes inside each chord are spread.',body:'Close voicing keeps chord tones near each other. Open and wide voicings spread notes farther apart for a broader sound.',tip:'Use close voicings for compact accompaniment and wider voicings for pads or cinematic parts.'},
    'smart.edit':{section:'Smart Keys',title:'Edit chords',short:'Customize individual Smart Key chord pads.',body:'Opens chord editing so each of the seven pads can have its own root and chord type instead of using only the key preset defaults.',tip:'Edit only the chord that needs changing; the other pads can remain generated from the key.'},
    'smart.reset':{section:'Smart Keys',title:'Reset from key',short:'Restore Smart Keys from the selected key preset.',body:'Rebuilds the seven Smart Key pads from the current key and clears custom chord edits for that set.',tip:'Use this when experimental chord edits get too far from the original key.'},
    'latch':{section:'Performance',title:'Latch',short:'Keeps the last chord or bass note held after you release it.',body:'With Latch on, the most recently triggered Smart Key chord or Bass note continues until you choose another one, stop it, or turn Latch off. With ARP on, the latched target feeds the arpeggiator.',tip:'Latch is useful when you need both hands free to adjust ARP, Groove Box or effects.'},
    'smart.pad':{section:'Smart Keys',title:'Smart Key chord pad',short:'Plays one of the seven current chords.',body:'Each Smart Key pad triggers its assigned chord. You can also use number keys 1–7 where keyboard shortcuts are available.',tip:'In Explain Controls mode, tap a pad to learn about the surface without sounding it.'},
    'instrument.key':{section:'Instruments',title:'Playable key',short:'Plays one note of the current instrument.',body:'This is a playable piano-style key. Its pitch depends on the current instrument, octave and keyboard layout.',tip:'On touch devices, play directly with your fingers. Use Explain Controls mode if you want help without triggering sound.'},
    'drawer':{section:'Interface',title:'Show / Hide module',short:'Expands or collapses a Play module.',body:'Controls only the visibility of that module. Parameter changes inside a module should never change this drawer state.',tip:'Collapse modules you are not adjusting to keep the workstation compact.'},
    'expression.velocity':{section:'Tone & FX',title:'Velocity',short:'Controls how strongly synth notes are struck.',body:'Scales the amplitude and musical intensity of newly triggered synth voices.',tip:'Lower values soften the instrument; higher values make it more assertive.'},
    'expression.sustain':{section:'Tone & FX',title:'Sustain',short:'Controls how long played synth notes remain present.',body:'Adjusts the sustain/release character of performed synth notes. ARP playback also uses rate-aware envelopes so very fast patterns remain bounded.',tip:'Long sustain works well for pads; shorter sustain keeps fast passages cleaner.'},
    'expression.tone':{section:'Tone & FX',title:'Tone',short:'Brightens or darkens the synth output.',body:'Changes the effective filter tone of the instrument. Higher values preserve more high-frequency detail; lower values sound warmer or darker.',tip:'Reduce Tone when a bright preset is competing with cymbals or vocals.'},
    'expression.space':{section:'Tone & FX',title:'Space',short:'Controls the overall sense of ambience.',body:'Adds spatial depth through the shared synth effects path.',tip:'Use small amounts for clarity and larger amounts for ambient or worship-style sounds.'},
    'fx.board':{section:'Tone & FX',title:'Performance Rack board',short:'Loads a coordinated effects-board preset.',body:'Changes the combined effects character of the M&B Performance Rack. Boards are starting points; individual effects can still be adjusted or bypassed.',tip:'Choose a board close to the vibe you want, then fine-tune individual effects.'},
    'fx.saturate':{section:'Tone & FX',title:'Saturate',short:'Adds harmonic drive and density.',body:'Uses nonlinear saturation to make the synth thicker, warmer or more aggressive depending on the amount and board.',tip:'Small amounts add presence; large amounts can become intentionally distorted.'},
    'fx.chorus':{section:'Tone & FX',title:'Chorus',short:'Adds width and gentle pitch movement.',body:'Creates a modulated doubled signal that can make keys and pads feel wider.',tip:'Useful for electric-piano, synthwave and wide pad sounds.'},
    'fx.echo':{section:'Tone & FX',title:'Echo',short:'Adds tempo-independent repeating delay.',body:'Feeds part of the synth into a delay path to create audible repeats and rhythmic depth.',tip:'Keep repeats restrained when the ARP itself is already very busy.'},
    'fx.space':{section:'Tone & FX',title:'Space effect',short:'Adds reverb-like ambience and depth.',body:'Places the instrument in a larger virtual space by feeding the shared ambience path.',tip:'Large Space settings suit ambient sounds; smaller values keep fast rhythms articulate.'},
    'groove.clear':{section:'Groove Box',title:'Clear groove',short:'Clears the current drum pattern.',body:'Removes the active steps from the Groove Box programmer so you can rebuild the rhythm.',tip:'Use this before hand-programming a beat from scratch.'},
    'groove.style':{section:'Groove Box',title:'Style',short:'Chooses the musical groove family.',body:'Changes the underlying rhythmic vocabulary used when generating a pattern, such as Worship, Pop, Funk, House, Trap or Reggaeton.',tip:'Style provides the rhythmic starting point; the 16-step programmer remains editable afterwards.'},
    'groove.energy':{section:'Groove Box',title:'Energy',short:'Controls how active and forceful generated grooves feel.',body:'Higher energy generally produces a busier or more assertive pattern while lower energy leaves more space.',tip:'Start around the middle, then adjust after hearing it with your instrument.'},
    'groove.generate':{section:'Groove Box',title:'Generate variation',short:'Creates another groove using the current settings.',body:'Generates a fresh beat variation while respecting the selected style and Groove Box performance controls.',tip:'Generate until the broad feel works, then edit individual steps.'},
    'groove.kit':{section:'Groove Box',title:'Drum kit',short:'Changes the timbre of the generated drums.',body:'Selects the sound character used for kick, snare and hats without changing the underlying step pattern.',tip:'Try a different kit before rewriting a pattern that already grooves well.'},
    'groove.density':{section:'Groove Box',title:'Density',short:'Controls how busy the drum pattern is.',body:'Raises or lowers the amount of rhythmic activity in generated grooves.',tip:'Lower density leaves more room for busy ARPs and melodic parts.'},
    'groove.sync':{section:'Groove Box',title:'Sync',short:'Adds or reduces off-beat rhythmic emphasis.',body:'Shapes how strongly the groove uses syncopated positions instead of only obvious downbeats.',tip:'Increase Sync for more movement and funk; reduce it for straighter patterns.'},
    'groove.swing':{section:'Groove Box',title:'Groove swing',short:'Offsets alternating drum subdivisions for a looser feel.',body:'Moves selected subdivisions away from perfectly even timing to create shuffle or swing.',tip:'Use modest values first; extreme swing can change the feel dramatically.'},
    'groove.human':{section:'Groove Box',title:'Humanize',short:'Adds controlled timing variation to the drums.',body:'Introduces small timing differences so generated drums feel less mechanically identical.',tip:'A little humanization can help; too much can make a tight electronic groove feel unstable.'},
    'groove.punch':{section:'Groove Box',title:'Punch',short:'Changes the impact and transient strength of drum synthesis.',body:'Makes drum hits feel softer or more forceful without rewriting the sequence.',tip:'Increase Punch when the drums need to cut through a dense mix.'},
    'groove.fill':{section:'Groove Box',title:'Fill',short:'Changes how the pattern treats the ending of the phrase.',body:'Adds an ending behavior such as a roll, lift or break so generated loops have more movement at the turnaround.',tip:'Use fills sparingly when several other layers are already changing at the bar line.'},
    'arp.power':{section:'Arp Lab',title:'ARP',short:'Turns the arpeggiator on or off.',body:'When enabled, Smart Keys or Bass targets are converted into a BPM-locked note pattern using the current Arp Lab settings.',tip:'Turn on Latch as well if you want the pattern to continue while adjusting controls.'},
    'arp.stop':{section:'Arp Lab',title:'Stop ARP',short:'Immediately stops the current arpeggiated target.',body:'Stops the active ARP pattern and releases its pooled voices without changing the saved Arp Lab settings.',tip:'Use Stop when you want silence but want to keep the same ARP configuration for later.'},
    'arp.mode':{section:'Arp Lab',title:'Direction',short:'Chooses the order in which ARP notes are played.',body:'Up, Down, Up/Down, Random and Chord Pulse change how the current chord or bass target is traversed.',tip:'Chord Pulse triggers the chord together and is much denser than a single-note direction.'},
    'arp.rate':{section:'Arp Lab',title:'Rate',short:'Sets the BPM-locked subdivision speed of the ARP.',body:'Rates such as 1/8, 1/16, 1/32 and 1/64 divide the beat into progressively faster steps. The V31 engine schedules these against the Web Audio clock.',tip:'1/64 is intentionally extreme; combine it carefully with Ratchet and Chord Pulse.'},
    'arp.octaves':{section:'Arp Lab',title:'Octaves / Range',short:'Sets how many octave registers the ARP can traverse.',body:'Expands the note sequence into higher octave copies of the target notes.',tip:'More octaves create wider melodic movement but can sound busier.'},
    'arp.gate':{section:'Arp Lab',title:'Gate',short:'Controls how long each ARP note lasts relative to its step.',body:'Short gate values create clipped, percussive notes. Longer values allow notes to overlap more.',tip:'Shorten Gate at 1/32 or 1/64 if the sound becomes too dense.'},
    'arp.swing':{section:'Arp Lab',title:'ARP swing',short:'Offsets alternating ARP steps for a swung feel.',body:'Changes the timing relationship between alternating subdivisions while staying locked to the overall BPM.',tip:'Small swing values add feel without making the pattern sound obviously shuffled.'},
    'arp.ratchet':{section:'Arp Lab',title:'Ratchet',short:'Repeats each ARP step before moving to the next one.',body:'Ratchet x2–x4 subdivides each ARP step into repeated notes. The performance-core scheduler places these repeats directly on the Web Audio timeline.',tip:'Rate × Ratchet multiplies note density very quickly, especially with Chord Pulse.'},
    'arp.offset':{section:'Arp Lab',title:'Offset',short:'Shifts where the ARP pattern begins in its sequence.',body:'Moves the starting position so the same note set can produce a different rhythmic/melodic entry point.',tip:'Use Offset to create variation without changing the chord itself.'},
    'arp.motion':{section:'Arp Lab',title:'Motion',short:'Applies a movement pattern to ARP pitch progression.',body:'Changes how the ARP pattern moves beyond the basic note order, adding patterned transposition or movement.',tip:'Start with Static while learning the other controls, then add Motion.'},
    'arp.steps':{section:'Arp Lab',title:'Steps',short:'Sets the length of the ARP motion pattern.',body:'Controls how many pattern positions are used before the motion sequence repeats.',tip:'Short step counts repeat quickly; longer patterns feel more evolving.'},
    'arp.distance':{section:'Arp Lab',title:'Distance',short:'Sets the pitch distance used by motion changes.',body:'Controls how far motion steps move, for example by an octave or another interval depending on the selected motion mode.',tip:'Large distances create dramatic jumps; small distances keep the pattern compact.'},
    'arp.velocity':{section:'Arp Lab',title:'Velocity',short:'Chooses how note intensity changes across ARP steps.',body:'Controls whether ARP notes stay at a flat intensity or follow a shaped velocity pattern.',tip:'Velocity movement can add groove even when pitch movement is simple.'},
    'arp.retrigger':{section:'Arp Lab',title:'Retrigger',short:'Controls when the ARP sequence restarts.',body:'Determines whether a new target or musical boundary resets the sequence position.',tip:'Use New note for predictable chord changes; other modes can preserve more continuous motion.'},
    'arp.rhythm':{section:'Arp Lab',title:'Rhythm pattern',short:'Turns individual ARP steps on or off.',body:'The eight rhythm cells act as a mask. Disabled positions create rests while the ARP clock continues.',tip:'Create syncopation by disabling a few steps instead of changing Rate.'},
    'record.bpm':{section:'Record',title:'Session BPM',short:'Sets the permanent musical grid tempo for the recording session.',body:'All guided recording, count-ins and BPM-aligned playback use this tempo.',tip:'Choose the BPM before recording the first layer when possible.'},
    'record.bars':{section:'Record',title:'Loop length',short:'Sets how many bars each guided layer records.',body:'Every recorded layer is aligned to this loop length so the session repeats cleanly.',tip:'Four bars is a versatile default; use longer loops for evolving parts.'},
    'record.layers':{section:'Record',title:'Layer count',short:'Chooses how many layer slots to start with.',body:'Creates the initial set of recording layers. Additional layers can still be added later up to the app limit.',tip:'Start with fewer layers if you want a simple arrangement.'},
    'record.countin':{section:'Record',title:'Count-in',short:'Sets the lead-in before recording begins.',body:'Plays a timing lead-in so you can prepare before exact sample capture starts.',tip:'One bar is usually enough; use more for difficult entrances.'},
    'record.start':{section:'Record',title:'Create session',short:'Builds the recording session with the selected grid settings.',body:'Creates the layer timeline and opens Record mode using the chosen BPM, bar length, layer count and count-in.',tip:'Review the setup values before creating the session.'},
    'record.source':{section:'Record',title:'Layer source',short:'Chooses what will be recorded into the current layer.',body:'A layer can use Audio Input, Guitar, Smart Keys, Bass or Beat. The relevant tools appear after choosing the source.',tip:'Give each layer a clear musical role to keep the loop easy to mix.'},
    'record.record':{section:'Record',title:'Record layer',short:'Records the armed layer exactly against the session grid.',body:'Starts the count-in and then captures the current source for the exact loop duration. AudioWorklet capture is used where supported for phase-locked timing.',tip:'Listen to the existing layers during count-in so your entrance lands naturally.'},
    'record.redo':{section:'Record',title:'Redo layer',short:'Records the current layer again.',body:'Replaces the current layer performance with a new take while keeping the same session grid.',tip:'Use Redo when the timing or performance needs another take.'},
    'record.clear':{section:'Record',title:'Clear layer',short:'Removes the recorded content from the current layer.',body:'Clears the layer so it can be left empty or recorded again.',tip:'Clear only the selected layer; other session layers remain intact.'},
    'record.play':{section:'Record',title:'Play session',short:'Starts or stops playback of the recorded loop.',body:'Plays the currently recorded layers together in phase against the session grid.',tip:'Use this after each new layer to check the arrangement before recording more.'},
    'record.settings':{section:'Record',title:'Session settings',short:'Adjusts BPM, bars and count-in for the current session.',body:'Opens the session grid settings. Changing BPM after recording can require playback-rate compensation for existing external audio.',tip:'Major grid changes are safest before many audio layers have been recorded.'},
    'layers.add':{section:'Record',title:'Add layer',short:'Adds another recording layer to the session.',body:'Creates another layer slot so you can add a new musical source or part.',tip:'Add a layer only when the arrangement needs another distinct part.'},
    'layers.prev':{section:'Record',title:'Previous layer',short:'Moves selection to the previous layer.',body:'Changes which layer is active for editing, source selection and recording.',tip:'Navigation does not delete or stop the other recorded layers.'},
    'layers.next':{section:'Record',title:'Next layer',short:'Moves selection to the next layer.',body:'Advances the active layer so you can continue building the loop in order.',tip:'Play the session before moving on if you want to check how the current layer fits.'}
  };

  const RULES=[
    ['home.brand','#homeBtn'],['project.save','#saveBtn'],['home.play','#enterPlay'],['home.record','#enterRecord'],['nav.back','.back-home'],
    ['play.audio','#playAudioBtn'],['play.transport','#playBeatToggle'],['play.bpm','#playBpm,#playBpmDown,#playBpmUp'],['play.metronome','#playMetronome'],
    ['instrument.tabs','.instrument-tab'],['instrument.sound','#playSound,#playBassSound,#recordSound,#recordBassSound'],['instrument.octave','#playOctave'],
    ['smart.key','#playKey'],['smart.voicing','#playVoicing'],['smart.edit','.v6-edit-smart'],['smart.reset','.v6-reset-smart'],['latch','[data-v18-latch]'],
    ['smart.pad','.chord-pad'],['instrument.key','.piano-key'],['drawer','[data-v24-toggle]'],
    ['groove.clear','#clearPlayBeat'],['groove.style','#playBeatStyle'],['groove.energy','#playEnergy'],['groove.generate','#generatePlayBeat'],
    ['arp.power','#playScreen #v6ArpPanel .v6-arp-power,[data-v17-record-arp] [data-v17-power]'],['arp.stop','#playScreen #v6ArpPanel [data-arp-action="panic"],#playScreen #v6ArpPanel [data-v17-stop],#playScreen #v6ArpPanel .v18-arp-stop'],
    ['record.bpm','#sessionBpm,#sessionBpmDown,#sessionBpmUp,#editSessionBpm'],['record.bars','#barChoices button,#editSessionBars'],['record.layers','#layerChoices button'],['record.countin','#countInChoices button,#editCountIn'],
    ['record.start','#startSessionBtn'],['record.source','.source-card'],['record.record','#recordLayerBtn'],['record.redo','#redoLayerBtn'],['record.clear','#clearLayerBtn'],['record.play','#playSessionBtn'],['record.settings','#sessionSettingsBtn,#applySettingsBtn'],
    ['layers.add','#addLayerBtn'],['layers.prev','#prevLayerBtn'],['layers.next','#nextLayerBtn']
  ];
  const ARP_KEYS={mode:'arp.mode',rate:'arp.rate',octaves:'arp.octaves',range:'arp.octaves',gate:'arp.gate',swing:'arp.swing',ratchet:'arp.ratchet',offset:'arp.offset',motion:'arp.motion',steps:'arp.steps',distance:'arp.distance',velocity:'arp.velocity',velocityMode:'arp.velocity',retrigger:'arp.retrigger'};
  const WORD_MAP={
    velocity:'expression.velocity',sustain:'expression.sustain',tone:'expression.tone',space:'expression.space',
    board:'fx.board',saturate:'fx.saturate',chorus:'fx.chorus',echo:'fx.echo',delay:'fx.echo',
    kit:'groove.kit',density:'groove.density',sync:'groove.sync',swing:'groove.swing',human:'groove.human',humanize:'groove.human',punch:'groove.punch',fill:'groove.fill'
  };

  const generated=new Map();
  const INTERACTIVE='button,select,input:not([type="hidden"]),textarea,[role="tab"],[role="button"],.chord-pad,.piano-key,[tabindex]:not([tabindex="-1"])';
  let helpMode=false,scanQueued=false,lastTooltipTarget=null;

  function cleanText(s=''){return String(s).replace(/\s+/g,' ').trim()}
  function controlName(el){
    const label=el.closest?.('label');
    if(label){const clone=label.cloneNode(true);clone.querySelectorAll('select,input,button,.mb-help-dot').forEach(n=>n.remove());const t=cleanText(clone.textContent);if(t)return t}
    return cleanText(el.getAttribute?.('aria-label')||el.getAttribute?.('title')||el.querySelector?.('strong')?.textContent||el.textContent||el.name||el.id||'Control');
  }
  function nearestSection(el){return cleanText(el.closest?.('section,.panel,.tool-box,.setup-card,.transport-card')?.querySelector?.('h1,h2,strong,.panel-kicker')?.textContent)||'Music & Beats'}
  function dynamicArp(el){
    const host=el.closest?.('#v6ArpPanel,[data-v17-record-arp],[data-v18-record-arp]');if(!host)return null;
    if(el.closest?.('.v22-rhythm-pattern,.v18-arp-pattern,.v17-pattern'))return HELP['arp.rhythm'];
    const source=el.matches?.('[data-arp],[data-v17-arp],[data-v18-arp]')?el:el.closest?.('[data-arp],[data-v17-arp],[data-v18-arp]');
    const key=source?.dataset?.arp||source?.dataset?.v17Arp||source?.dataset?.v18Arp||el.closest?.('[data-v22-control]')?.dataset?.v22Control;
    return HELP[ARP_KEYS[key]]||null;
  }
  function dynamicByWords(el){
    const text=controlName(el).toLowerCase();
    const area=el.closest?.('.v9-expression-shell,.expression-strip,.v17-fx-rack,.v19-rack-shell,.v18-groovebox,.beat-panel,#layerSourceTools');
    if(!area)return null;
    for(const [word,id] of Object.entries(WORD_MAP))if(text.includes(word))return HELP[id];
    return null;
  }
  function explicitItem(el){for(const [id,selector] of RULES)try{if(el.matches(selector)||el.closest(selector)===el)return HELP[id]}catch{}return null}
  function fallbackItem(el){
    const title=controlName(el),section=nearestSection(el),id=`auto:${section}:${title}`.toLowerCase().replace(/[^a-z0-9:]+/g,'-').slice(0,120);
    if(!generated.has(id))generated.set(id,{section,title,short:`${title} control in ${section}.`,body:`Use ${title} to adjust or trigger this part of ${section}. This control is included in Explain Controls mode even though it does not need a longer dedicated article yet.`,tip:'Change one control at a time and listen or watch for the result.'});
    return generated.get(id);
  }
  function resolveItem(el){return dynamicArp(el)||explicitItem(el)||dynamicByWords(el)||fallbackItem(el)}
  function itemId(item){for(const [id,x] of Object.entries(HELP))if(x===item)return id;for(const [id,x] of generated)if(x===item)return id;return null}
  function itemForId(id){return HELP[id]||generated.get(id)||null}

  function ensureTooltip(){
    let tip=document.querySelector('#mbHelpTooltip');if(tip)return tip;
    tip=document.createElement('div');tip.id='mbHelpTooltip';tip.className='mb-help-tooltip';tip.setAttribute('role','tooltip');tip.hidden=true;document.body.appendChild(tip);return tip;
  }
  function positionTooltip(el){
    const tip=ensureTooltip(),item=itemForId(el.dataset.mbHelpId);if(!item)return;
    tip.textContent=item.short;tip.hidden=false;lastTooltipTarget=el;
    const r=el.getBoundingClientRect(),tr=tip.getBoundingClientRect();
    let left=Math.min(innerWidth-tr.width-10,Math.max(10,r.left+r.width/2-tr.width/2));
    let top=r.top-tr.height-9;if(top<8)top=Math.min(innerHeight-tr.height-8,r.bottom+9);
    tip.style.left=`${left}px`;tip.style.top=`${top}px`;
  }
  function hideTooltip(el=null){if(el&&lastTooltipTarget!==el)return;const tip=document.querySelector('#mbHelpTooltip');if(tip)tip.hidden=true;lastTooltipTarget=null}

  function addInfoDot(el,item){
    if(el.matches?.('.mb-help-dot,.mb-help-button')||el.closest?.('.mb-help-dialog'))return;
    const form=el.matches?.('select,input,textarea')?el:null,label=form?.closest?.('label');
    if(!label||label.querySelector(':scope > .mb-help-dot'))return;
    label.classList.add('mb-help-anchor');
    const dot=document.createElement('button');dot.type='button';dot.className='mb-help-dot';dot.dataset.helpOpen=itemId(item);dot.setAttribute('aria-label',`Help: ${item.title}`);dot.textContent='i';label.appendChild(dot);
  }
  function annotateElement(el){
    if(!el||el.matches?.('.mb-help-dot,.mb-help-button')||el.closest?.('.mb-help-dialog,.mb-help-banner'))return;
    const item=resolveItem(el),id=itemId(item);if(!item||!id)return;
    el.dataset.mbHelpId=id;el.classList.add('mb-helpable');if(!el.title)el.title=item.short;addInfoDot(el,item);
  }
  function annotateModuleHeads(root=document){
    root.querySelectorAll?.('.v24-module-meta,.v9-expression-copy,.v19-rack-copy,.v28-bank-header').forEach(el=>{
      if(el.dataset.mbHelpId)return;
      const text=cleanText(el.querySelector('strong')?.textContent||el.textContent).toLowerCase();
      let id=text.includes('tone')?'fx.board':text.includes('groove')?'groove.style':text.includes('arp')?'arp.power':text.includes('performance')?'expression.velocity':null;
      if(!id)return;el.dataset.mbHelpId=id;el.classList.add('mb-helpable');if(!el.title)el.title=HELP[id].short;
    });
  }
  function scan(root=document){
    if(root.matches?.(INTERACTIVE))annotateElement(root);
    root.querySelectorAll?.(INTERACTIVE).forEach(annotateElement);annotateModuleHeads(root);
  }
  function scheduleScan(){if(scanQueued)return;scanQueued=true;requestAnimationFrame(()=>{scanQueued=false;scan(document)})}

  function detailMarkup(item){return `<div class="mb-help-detail-head"><span>${item.section}</span><h2>${item.title}</h2><p>${item.short}</p></div><div class="mb-help-detail-body"><h3>What this does</h3><p>${item.body}</p><div class="mb-help-tip-card"><strong>Try this</strong><p>${item.tip}</p></div></div>`}
  function ensureDetailDialog(){
    let d=document.querySelector('#mbHelpDetail');if(d)return d;
    d=document.createElement('dialog');d.id='mbHelpDetail';d.className='mb-help-dialog mb-help-detail';d.innerHTML='<div class="mb-help-dialog-shell"><button class="mb-help-close" type="button" aria-label="Close help">×</button><div data-help-detail-content></div></div>';document.body.appendChild(d);
    d.querySelector('.mb-help-close').addEventListener('click',()=>d.close());return d;
  }
  function openItem(id){
    const item=itemForId(id);if(!item)return;hideTooltip();const d=ensureDetailDialog();d.querySelector('[data-help-detail-content]').innerHTML=detailMarkup(item);if(!d.open)d.showModal();
  }

  function helpCards(){
    const groups={};Object.entries(HELP).forEach(([id,item])=>{(groups[item.section]||(groups[item.section]=[])).push([id,item])});
    return Object.entries(groups).map(([section,items])=>`<section class="mb-help-group" data-help-group><h3>${section}</h3><div class="mb-help-card-grid">${items.map(([id,item])=>`<button type="button" class="mb-help-card" data-help-open="${id}" data-help-search="${(item.title+' '+item.short+' '+section).toLowerCase()}"><strong>${item.title}</strong><span>${item.short}</span></button>`).join('')}</div></section>`).join('');
  }
  function ensureHelpCenter(){
    let d=document.querySelector('#mbHelpCenter');if(d)return d;
    d=document.createElement('dialog');d.id='mbHelpCenter';d.className='mb-help-dialog mb-help-center';
    d.innerHTML=`<div class="mb-help-dialog-shell"><div class="mb-help-center-head"><div><span>GUIDE & REFERENCE</span><h2>Help Center</h2><p>Learn the workflow or explain any control without leaving the workstation.</p></div><button class="mb-help-close" type="button" aria-label="Close Help Center">×</button></div><div class="mb-help-journeys"><article><small>QUICK JAM</small><strong>Hear an idea in under a minute</strong><p>Start Audio → Smart Keys → choose a Groove → play chords → try Latch → open Arp Lab.</p></article><article><small>BUILD A LOOP</small><strong>Record a structured session</strong><p>Record → BPM & bars → choose a layer source → record → add layers → Play Session → Save.</p></article></div><div class="mb-help-tools"><label><span>Search help</span><input type="search" data-help-searchbox placeholder="Try “ratchet”, “record”, “swing”…"></label><button type="button" class="mb-help-explain-toggle" data-help-mode-toggle>Explain controls</button></div><div class="mb-help-groups" data-help-groups>${helpCards()}</div></div>`;
    document.body.appendChild(d);d.querySelector('.mb-help-close').addEventListener('click',()=>d.close());
    d.querySelector('[data-help-searchbox]').addEventListener('input',e=>{
      const q=e.target.value.trim().toLowerCase();d.querySelectorAll('.mb-help-card').forEach(card=>card.hidden=!!q&&!card.dataset.helpSearch.includes(q));
      d.querySelectorAll('[data-help-group]').forEach(group=>group.hidden=![...group.querySelectorAll('.mb-help-card')].some(c=>!c.hidden));
    });
    d.querySelector('[data-help-mode-toggle]').addEventListener('click',()=>{setHelpMode(true);d.close()});
    return d;
  }
  function openCenter(){hideTooltip();const d=ensureHelpCenter();if(!d.open)d.showModal()}

  function ensureHeaderButton(){
    const actions=document.querySelector('.top-actions');if(!actions||actions.querySelector('.mb-help-button'))return;
    const b=document.createElement('button');b.type='button';b.className='ghost-btn mb-help-button';b.innerHTML='<span>?</span> Help';b.setAttribute('aria-label','Open Help Center');b.addEventListener('click',openCenter);actions.appendChild(b);
  }
  function ensureHelpBanner(){
    let b=document.querySelector('#mbHelpBanner');if(b)return b;
    b=document.createElement('div');b.id='mbHelpBanner';b.className='mb-help-banner';b.hidden=true;b.innerHTML='<strong>Explain Controls is on</strong><span>Tap any highlighted control to learn what it does.</span><button type="button">Exit</button>';b.querySelector('button').addEventListener('click',()=>setHelpMode(false));document.body.appendChild(b);return b;
  }
  function setHelpMode(on){
    helpMode=!!on;document.documentElement.classList.toggle('mb-help-mode',helpMode);const b=ensureHelpBanner();b.hidden=!helpMode;document.querySelector('.mb-help-button')?.classList.toggle('active',helpMode);
  }

  /* Info dots open detail help without triggering the labelled control. */
  window.addEventListener('pointerdown',e=>{const dot=e.target.closest?.('.mb-help-dot');if(!dot)return;e.preventDefault();e.stopImmediatePropagation()},true);
  window.addEventListener('click',e=>{const open=e.target.closest?.('[data-help-open]');if(!open)return;e.preventDefault();e.stopImmediatePropagation();openItem(open.dataset.helpOpen)},true);

  /* Explain Controls intercepts before the app's document-level performance handlers. */
  window.addEventListener('pointerdown',e=>{
    if(!helpMode||e.target.closest?.('.mb-help-dialog,.mb-help-banner,.mb-help-button,.mb-help-dot'))return;
    const target=e.target.closest?.('[data-mb-help-id]');if(!target)return;e.preventDefault();e.stopImmediatePropagation();openItem(target.dataset.mbHelpId);
  },true);
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&helpMode){setHelpMode(false);return}
    if(!helpMode||!['Enter',' '].includes(e.key))return;const target=e.target.closest?.('[data-mb-help-id]');if(!target)return;e.preventDefault();e.stopImmediatePropagation();openItem(target.dataset.mbHelpId);
  },true);

  /* One floating tooltip for all controls on pointer/focus devices. */
  document.addEventListener('pointerover',e=>{if(matchMedia('(hover:hover)').matches){const el=e.target.closest?.('[data-mb-help-id]');if(el)positionTooltip(el)}},true);
  document.addEventListener('pointerout',e=>{const el=e.target.closest?.('[data-mb-help-id]');if(el)hideTooltip(el)},true);
  document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-mb-help-id]');if(el)positionTooltip(el)},true);
  document.addEventListener('focusout',e=>{const el=e.target.closest?.('[data-mb-help-id]');if(el)hideTooltip(el)},true);
  window.addEventListener('scroll',()=>hideTooltip(),{passive:true,capture:true});
  window.addEventListener('resize',()=>hideTooltip(),{passive:true});

  /* Lightweight dynamic coverage: scan only when interactive UI is actually added. */
  const observer=new MutationObserver(records=>{
    for(const r of records)for(const n of r.addedNodes){
      if(n.nodeType!==1||n.matches?.('.mb-help-dot,.mb-help-dialog,.mb-help-banner')||n.closest?.('.mb-help-dialog'))continue;
      if(n.matches?.(INTERACTIVE)||n.querySelector?.(INTERACTIVE)){scheduleScan();return}
    }
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.MB_HELP={items:HELP,open:openItem,openCenter,setHelpMode,get helpMode(){return helpMode},scan:scheduleScan};
  ensureHeaderButton();ensureHelpBanner();ensureDetailDialog();ensureHelpCenter();scan(document);
  window.addEventListener('musicandbeats:ready',()=>{ensureHeaderButton();scheduleScan()});
  window.addEventListener('pageshow',scheduleScan,{passive:true});
  document.addEventListener('musicandbeats:drawerchange',scheduleScan);
})();