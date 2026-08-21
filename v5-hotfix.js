/* Smart Chords freeze hotfix: avoid MutationObserver self-trigger loops when adding 1–7 badges. */
v5AnnotateChordPads=function(){
  ['#playChords','#recordChords'].forEach(sel=>{
    const host=$(sel);if(!host)return;
    [...host.querySelectorAll('.chord-pad')].forEach((pad,i)=>{
      if(i>6)return;
      const label=String(i+1);
      let badge=pad.querySelector('.key-map-badge');
      if(!badge){
        badge=document.createElement('kbd');
        badge.className='key-map-badge';
        badge.textContent=label;
        pad.appendChild(badge);
      }else if(badge.textContent!==label){
        badge.textContent=label;
      }
      if(pad.getAttribute('aria-keyshortcuts')!==label)pad.setAttribute('aria-keyshortcuts',label);
    });
  });
};
