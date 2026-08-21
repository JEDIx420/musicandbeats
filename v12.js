/* Music & Beats V12 — comprehensive touch-device selection/callout guard. */
(function(){
  const root=document.documentElement;
  const app=()=>document.querySelector('.app-shell');
  const nativeSelector='input,textarea,select,option,[contenteditable="true"],[role="textbox"]';
  const isTouch=()=>{
    try{return (navigator.maxTouchPoints||0)>0||('ontouchstart' in window)}catch{return false}
  };
  if(!isTouch())return;
  root.classList.add('v12-touch-device');

  let clearing=false;
  const elementFor=node=>node?.nodeType===Node.TEXT_NODE?node.parentElement:node;
  const inApp=node=>{const el=elementFor(node);return !!(el&&app()?.contains(el))};
  const isNative=node=>{const el=elementFor(node);return !!el?.closest?.(nativeSelector)};
  const activeIsNative=()=>!!document.activeElement?.closest?.(nativeSelector);

  function clearWorkstationSelection(){
    if(clearing||activeIsNative())return;
    let selection;
    try{selection=window.getSelection?.()}catch{return}
    if(!selection||selection.rangeCount===0||selection.isCollapsed)return;
    const anchor=selection.anchorNode,focus=selection.focusNode;
    if(!inApp(anchor)&&!inApp(focus))return;
    clearing=true;
    try{selection.removeAllRanges()}catch{}
    requestAnimationFrame(()=>{clearing=false});
  }

  /* Prevent new browser text selections and long-press context menus anywhere in the workstation,
     except genuine native/editable controls. */
  document.addEventListener('selectstart',e=>{
    if(inApp(e.target)&&!isNative(e.target))e.preventDefault();
  },true);
  document.addEventListener('contextmenu',e=>{
    if(inApp(e.target)&&!isNative(e.target))e.preventDefault();
  },true);
  document.addEventListener('dragstart',e=>{
    if(inApp(e.target)&&!isNative(e.target))e.preventDefault();
  },true);

  /* Safari can occasionally create a selection even when selectstart was prevented.
     selectionchange is the final safety net. */
  document.addEventListener('selectionchange',clearWorkstationSelection);

  /* Clear a stale blue selection before and after the next musical gesture without cancelling clicks. */
  document.addEventListener('pointerdown',e=>{
    if(inApp(e.target)&&!isNative(e.target))clearWorkstationSelection();
  },true);
  document.addEventListener('touchstart',e=>{
    if(inApp(e.target)&&!isNative(e.target))clearWorkstationSelection();
  },{capture:true,passive:true});
  document.addEventListener('touchend',e=>{
    if(inApp(e.target)&&!isNative(e.target))requestAnimationFrame(clearWorkstationSelection);
  },{capture:true,passive:true});

  /* Remove browser drag affordances from artwork, including dynamically inserted instrument skins. */
  function hardenArtwork(scope=document){
    scope.querySelectorAll?.('.app-shell img,.app-shell svg').forEach(el=>{
      if(el.getAttribute('draggable')!=='false')el.setAttribute('draggable','false');
    });
  }
  hardenArtwork();
  const observer=new MutationObserver(records=>{
    records.forEach(record=>record.addedNodes.forEach(node=>{
      if(node.nodeType!==Node.ELEMENT_NODE)return;
      if(node.matches?.('img,svg')&&app()?.contains(node))node.setAttribute('draggable','false');
      hardenArtwork(node);
    }));
    clearWorkstationSelection();
  });
  if(app())observer.observe(app(),{childList:true,subtree:true});

  window.addEventListener('pageshow',()=>requestAnimationFrame(clearWorkstationSelection));
  window.addEventListener('blur',clearWorkstationSelection);
})();
