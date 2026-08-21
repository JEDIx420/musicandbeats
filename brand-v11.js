/* Music & Beats V11 — brand metadata */
(function(){
  const head=document.head;
  const ensureMeta=(key,value,content,property=false)=>{let el=head.querySelector(`meta[${property?'property':'name'}="${value}"]`);if(!el){el=document.createElement('meta');el.setAttribute(property?'property':'name',value);head.appendChild(el)}el.setAttribute('content',content)};
  const ensureLink=(rel,href)=>{let el=head.querySelector(`link[rel="${rel}"]`);if(!el){el=document.createElement('link');el.rel=rel;head.appendChild(el)}el.href=href};
  ensureMeta('name','description','Music & Beats is an iPad-first browser music workstation with Smart Keys, guitar effects, beats, bass, six-layer looping, timeline editing and local project saving.');
  ensureMeta('name','application-name','Music & Beats');
  ensureMeta('property','og:title','Music & Beats',true);
  ensureMeta('property','og:description','Loop. Play. Create. A touch-first browser music workstation for iPad, mobile and desktop.',true);
  ensureMeta('property','og:type','website',true);
  ensureMeta('property','og:url','https://jedix420.github.io/musicandbeats/',true);
  ensureMeta('name','twitter:card','summary');
  ensureLink('apple-touch-icon','icon.svg');
  ensureLink('mask-icon','icon.svg');
  const mark=document.querySelector('.brand-mark');if(mark){mark.setAttribute('role','img');mark.setAttribute('aria-label','Music & Beats logo')}
})();
