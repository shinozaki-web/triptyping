'use strict';
Railway.sound = (()=>{
  let context, enabled=false;
  function unlock(){
    if(!enabled)return;
    try{context=context||new(window.AudioContext||window.webkitAudioContext)();if(context.state==='suspended')context.resume().catch(()=>{});}catch(_){}
  }
  function crash(){
    const t=context.currentTime, length=Math.floor(context.sampleRate*1.1), buffer=context.createBuffer(1,length,context.sampleRate), data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/length,2.2);
    const noise=context.createBufferSource(), filter=context.createBiquadFilter(), noiseGain=context.createGain();
    noise.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(5000,t);filter.frequency.exponentialRampToValueAtTime(300,t+1);
    noiseGain.gain.setValueAtTime(.3,t);noiseGain.gain.exponentialRampToValueAtTime(.0001,t+1.1);
    noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(context.destination);noise.start(t);
    for(const [type,from,to,peak] of [['sawtooth',420,70,.16],['square',900,180,.07]]){
      const osc=context.createOscillator(), gain=context.createGain();
      osc.type=type;osc.frequency.setValueAtTime(from,t);osc.frequency.exponentialRampToValueAtTime(to,t+.7);
      gain.gain.setValueAtTime(peak,t);gain.gain.exponentialRampToValueAtTime(.0001,t+.8);
      osc.connect(gain);gain.connect(context.destination);osc.start(t);osc.stop(t+.85);
    }
  }
  function play(kind){
    if(!enabled||!context||context.state!=='running')return;
    if(kind==='crash'){try{crash();}catch(_){}return;}
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
