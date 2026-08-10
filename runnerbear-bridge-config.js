window.RUNNERBEAR_BRIDGE_URL = "https://runnerbear-tredict-bridge.torbjorn-forre.workers.dev";

/* RunnerBear Today v9.6 loader. Kept here so the decision surface can evolve
   independently without touching the training/data layers. */
(function(){
  if(!document.querySelector('link[data-rb-today-v35]')){
    const l=document.createElement('link');
    l.rel='stylesheet';
    l.href='runnerbear-today-v35.css?v=960';
    l.dataset.rbTodayV35='1';
    document.head.appendChild(l);
  }
  if(!document.querySelector('script[data-rb-today-v35]')){
    const s=document.createElement('script');
    s.src='runnerbear-today-v35.js?v=960';
    s.async=false;
    s.dataset.rbTodayV35='1';
    document.head.appendChild(s);
  }
})();
