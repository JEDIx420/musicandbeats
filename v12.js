/* Music & Beats V12 — comprehensive touch-device selection/callout guard. */
(function(){
  const root=document.documentElement;
  const nativeSelector='input,textarea,select,option,[contenteditable="true"],[role="textbox"]';
  const isTouch=()=>{
    try{return (navigator.maxTouchPoints||0)>0||('ontouchstart' in window)}catch{return false}
  };
  if(!isTouch())return;
  root.classList.add('v12-touch-device');

  let clearing=false;
  const elementFor=node=>node?.nodeType===Node.TEXT_NODE?node.parentElement:node;
  const ownedRoots=()=>[document.querySelector('.app-shell'),...document.querySelectorAll('dialog')].filter(Boolean);
  const inWorkstation=node=>{const el=elementFor(node);return !!(el&&ownedRoots().some(r=>r.contains(el)))};
  const isNative=node=>{const el=elementFor(node);return !!el?.closest?.(nativeSelector)};
  const activeIsNative=()=>!!document.activeElement?.closest?.(nativeSelector);

  function clearWorkstationSelection(){
    if(clearing||activeIsNative())return;
    let selection;
    try{selection=window.getSelection?.()}catch{return}
    if(!selection||selection.rangeCount===0||selection.isCollapsed)return;
    const anchor=selection.anchorNode,focus=selection.focusNode;
    if(!inWorkstation(anchor)&&!inWorkstation(focus))return;
    clearing=true;
    try{selection.removeAllRanges()}catch{}
    requestAnimationFrame(()=>{clearing=false});
  }

  /* Prevent browser selection and long-press menus anywhere in the app UI,
     except genuine native/editable controls. */
  document.addEventListener('selectstart',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))e.preventDefault();
  },true);
  document.addEventListener('contextmenu',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))e.preventDefault();
  },true);
  document.addEventListener('dragstart',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))e.preventDefault();
  },true);

  /* Safari can occasionally create selection UI even after selectstart is blocked.
     selectionchange is the final safety net. */
  document.addEventListener('selectionchange',clearWorkstationSelection);

  /* Clear stale blue selection before/after the next musical gesture without cancelling clicks. */
  document.addEventListener('pointerdown',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))clearWorkstationSelection();
  },true);
  document.addEventListener('touchstart',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))clearWorkstationSelection();
  },{capture:true,passive:true});
  document.addEventListener('touchend',e=>{
    if(inWorkstation(e.target)&&!isNative(e.target))requestAnimationFrame(clearWorkstationSelection);
  },{capture:true,passive:true});

  /* Remove drag affordances from dynamically inserted instrument/branding artwork. */
  function hardenArtwork(scope=document){
    scope.querySelectorAll?.('img,svg').forEach(el=>{
      if(inWorkstation(el)&&el.getAttribute('draggable')!=='false')el.setAttribute('draggable','false');
    });
  }
  hardenArtwork();
  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      if(node.matches?.('img,svg')&&inWorkstation(node))node.setAttribute('draggable','false');
      hardenArtwork(node);
    }));
    clearWorkstationSelection();
  });
  observer.observe(document.body,{childList:true,subtree:true});

  window.addEventListener('pageshow',()=>requestAnimationFrame(clearWorkstationSelection));
  window.addEventListener('blur',clearWorkstationSelection);
})();
