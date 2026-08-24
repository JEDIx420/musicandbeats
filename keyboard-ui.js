/* Music & Beats V33 — keyboard geometry repair + configurable displayed octaves. */
(()=>{
  if(window.MB_KEYBOARD_UI)return;
  const STORAGE='musicandbeats:v33:displayed-octaves';
  const clampOctaves=v=>Math.max(1,Math.min(3,Number(v)||1));
  function defaultOctaves(){return window.innerWidth<560?1:2}
  function readOctaves(){
    try{const v=localStorage.getItem(STORAGE);return v===null?defaultOctaves():clampOctaves(v)}catch{return defaultOctaves()}
  }
  function writeOctaves(v){try{localStorage.setItem(STORAGE,String(clampOctaves(v)))}catch{}}
  function selectedOctaves(){return clampOctaves(document.querySelector('#playDisplayOctaves')?.value||readOctaves())}

  function installControl(){
    const row=document.querySelector('#playChordControls');
    const voicing=document.querySelector('#playVoicing');
    if(!row||!voicing||document.querySelector('#playDisplayOctaves'))return;
    const label=document.createElement('label');
    label.className='mb-display-octaves-control';
    label.innerHTML=`Displayed octaves<select id="playDisplayOctaves" aria-label="Displayed octaves"><option value="1">1 octave</option><option value="2">2 octaves</option><option value="3">3 octaves</option></select>`;
    voicing.closest('label')?.insertAdjacentElement('afterend',label);
    const select=label.querySelector('select');
    select.value=String(readOctaves());
    select.title='Choose how many keyboard octaves are visible at once, up to three.';
    select.addEventListener('change',()=>{
      const value=clampOctaves(select.value);select.value=String(value);writeOctaves(value);refreshSmartKeyboard();
    });
  }

  function renderSmartKeyboard(id,opts={}){
    const el=document.querySelector(id);if(!el)return;
    const octave=Number(opts.octave??3),preset=opts.preset||'Studio Grand',octaves=selectedOctaves();
    const start=noteMidi('C',octave),count=octaves*12;
    const midis=Array.from({length:count+1},(_,i)=>start+i);
    const isBlack=m=>[1,3,6,8,10].includes((m%12+12)%12);
    const whites=midis.filter(m=>!isBlack(m));
    const whiteCount=whites.length;
    const blackWidth=(100/whiteCount)*0.62;
    el.dataset.displayOctaves=String(octaves);
    el.style.setProperty('--mb-white-count',String(whiteCount));
    el.innerHTML=whites.map(m=>`<button class="piano-key white-key" data-midi="${m}" data-preset="${preset}" type="button">${m%12===0?midiLabel(m):''}</button>`).join('');
    midis.filter(isBlack).forEach(m=>{
      if(m<=start||m>=midis[midis.length-1])return;
      const left=whites.filter(w=>w<m).length/whiteCount*100;
      el.insertAdjacentHTML('beforeend',`<button class="piano-key black-key" style="left:${left}%;width:${blackWidth}%" data-midi="${m}" data-preset="${preset}" type="button"></button>`);
    });
    bindKeyboard(el);
    try{window.MB_HELP?.scan?.()}catch{}
  }

  const baseRenderKeyboard=window.renderKeyboard||renderKeyboard;
  renderKeyboard=function(id,opts={}){
    if(id==='#playKeyboard'&&typeof playInstrument!=='undefined'&&playInstrument==='chords')return renderSmartKeyboard(id,opts);
    return baseRenderKeyboard.apply(this,arguments);
  };

  function refreshSmartKeyboard(){
    if(typeof currentScreen!=='undefined'&&currentScreen!=='play')return;
    if(typeof playInstrument!=='undefined'&&playInstrument!=='chords')return;
    installControl();
    renderSmartKeyboard('#playKeyboard',{
      octave:+(document.querySelector('#playOctave')?.value||3),
      preset:document.querySelector('#playSound')?.value||'Studio Grand'
    });
  }

  if(typeof renderPlayInstrument==='function'){
    const baseRenderPlayInstrument=renderPlayInstrument;
    renderPlayInstrument=function(){
      const out=baseRenderPlayInstrument.apply(this,arguments);
      installControl();
      if(playInstrument==='chords')requestAnimationFrame(refreshSmartKeyboard);
      return out;
    };
  }

  document.addEventListener('change',e=>{
    if(e.target?.matches?.('#playOctave,#playSound')&&typeof playInstrument!=='undefined'&&playInstrument==='chords')requestAnimationFrame(refreshSmartKeyboard);
  },true);

  window.MB_KEYBOARD_UI={readOctaves,refresh:refreshSmartKeyboard};
  installControl();
  if(typeof currentScreen!=='undefined'&&currentScreen==='play'&&playInstrument==='chords')requestAnimationFrame(refreshSmartKeyboard);
})();