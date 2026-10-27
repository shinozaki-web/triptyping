'use strict';
Railway.sound = (()=>{
  let context, enabled=false;
  function unlock(){
    if(!enabled)return;
    try{context=context||new(window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch(_){}
  }
  function play(kind){
    if(!enabled||!context||context.state!=='running')return;
    const notes={key:[420],error:[130],word:[660,880],station:[523,659,784]};
    try{(notes[kind]||notes.key).forEach((frequency,i)=>{
      const oscillator=context.createOscillator(),volume=context.createGain(),t=context.currentTime+i*.09;
      oscillator.type=kind==='error'?'triangle':'sine';oscillator.frequency.value=frequency;
      volume.gain.setValueAtTime(.0001,t);volume.gain.exponentialRampToValueAtTime(.045,t+.008);volume.gain.exponentialRampToValueAtTime(.0001,t+.12);
      oscillator.connect(volume);volume.connect(context.destination);oscillator.start(t);oscillator.stop(t+.13);
    });}catch(_){}
  }
  return {unlock,play,toggle(){enabled=!enabled;unlock();return enabled;}};
})();
