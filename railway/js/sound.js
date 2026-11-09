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

  // ---- Ambient layer: Kanmon-night BGM, rail rumble / joints, and wall-approach warning ----
  const SCALE=[146.83,155.56,196,220,233.08,293.66,311.13,392,440,466.16,587.33]; // D Eb G A Bb (miyako-bushi), 3 octaves
  let wanted=false,graph=null,timer=0,vel=0,danger=0;
  let nextBeat=0,beat=0,stepIndex=4,lastHorn=0,railNext=0,beepNext=0;
  function noiseBuffer(){
    const length=context.sampleRate*2,buffer=context.createBuffer(1,length,context.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<length;i++)data[i]=Math.random()*2-1;return buffer;
  }
  function build(){
    const master=context.createGain();master.gain.value=.9;master.connect(context.destination);
    const bgm=context.createGain(),rail=context.createGain(),alarm=context.createGain();bgm.gain.value=0;rail.gain.value=0;alarm.gain.value=0;
    bgm.connect(master);rail.connect(master);alarm.connect(master);
    const echo=context.createDelay(1),feedback=context.createGain(),tone=context.createBiquadFilter();
    echo.delayTime.value=.46;feedback.gain.value=.42;tone.type='lowpass';tone.frequency.value=1800;
    echo.connect(tone);tone.connect(feedback);feedback.connect(echo);tone.connect(bgm);
    const pad=context.createBiquadFilter();pad.type='lowpass';pad.frequency.value=520;pad.connect(bgm);
    for(const [frequency,level] of [[73.42,.07],[110,.045],[146.83,.03],[73.9,.05]]){
      const osc=context.createOscillator(),gain=context.createGain();osc.type='triangle';osc.frequency.value=frequency;gain.gain.value=level;osc.connect(gain);gain.connect(pad);osc.start();
    }
    const buffer=noiseBuffer();
    const rumble=context.createBufferSource(),rumbleFilter=context.createBiquadFilter(),rumbleGain=context.createGain();
    rumble.buffer=buffer;rumble.loop=true;rumbleFilter.type='lowpass';rumbleFilter.frequency.value=240;rumbleGain.gain.value=0;
    rumble.connect(rumbleFilter);rumbleFilter.connect(rumbleGain);rumbleGain.connect(rail);rumble.start();
    const drone=context.createOscillator(),droneFilter=context.createBiquadFilter(),droneGain=context.createGain();
    drone.type='sawtooth';drone.frequency.value=110;droneFilter.type='lowpass';droneFilter.frequency.value=700;droneGain.gain.value=0;
    drone.connect(droneFilter);droneFilter.connect(droneGain);droneGain.connect(alarm);drone.start();
    graph={bgm,rail,alarm,echo,rumbleGain,drone,droneGain,buffer};
  }
  function pluck(t,frequency,level){
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type='triangle';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+1.5);
    osc.connect(gain);gain.connect(graph.bgm);gain.connect(graph.echo);osc.start(t);osc.stop(t+1.6);
  }
  function horn(t){
    const osc=context.createOscillator(),filter=context.createBiquadFilter(),gain=context.createGain();
    osc.type='sawtooth';osc.frequency.setValueAtTime(116,t);osc.frequency.linearRampToValueAtTime(110,t+2.4);
    filter.type='lowpass';filter.frequency.value=420;
    gain.gain.setValueAtTime(.0001,t);gain.gain.linearRampToValueAtTime(.05,t+.5);gain.gain.setValueAtTime(.05,t+1.5);gain.gain.linearRampToValueAtTime(.0001,t+2.6);
    osc.connect(filter);filter.connect(gain);gain.connect(graph.bgm);gain.connect(graph.echo);osc.start(t);osc.stop(t+2.7);
  }
  function thump(t,level,pitch){
    const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
    src.buffer=graph.buffer;filter.type='bandpass';filter.frequency.value=pitch;filter.Q.value=.8;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(level,t+.004);gain.gain.exponentialRampToValueAtTime(.0001,t+.11);
    src.connect(filter);filter.connect(gain);gain.connect(graph.rail);src.start(t,Math.random()*1.5,.13);
    const body=context.createOscillator(),bodyGain=context.createGain();
    body.type='sine';body.frequency.setValueAtTime(95,t);body.frequency.exponentialRampToValueAtTime(55,t+.09);
    bodyGain.gain.setValueAtTime(level*.9,t);bodyGain.gain.exponentialRampToValueAtTime(.0001,t+.1);
    body.connect(bodyGain);bodyGain.connect(graph.rail);body.start(t);body.stop(t+.11);
  }
  function beep(t,frequency){
    const osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.07+.05*danger,t+.01);gain.gain.exponentialRampToValueAtTime(.0001,t+.09);
    osc.connect(gain);gain.connect(graph.alarm);osc.start(t);osc.stop(t+.1);
  }
  function tick(){
    if(!enabled||!context||context.state!=='running')return;
    if(!graph)build();
    const now=context.currentTime,on=wanted;
    graph.bgm.gain.setTargetAtTime(on?1:0,now,on?.6:.25);
    graph.rail.gain.setTargetAtTime(on?1:0,now,.2);
    graph.rumbleGain.gain.setTargetAtTime(on?Math.min(.14,vel/22*.14):0,now,.3);
    const alarmOn=on&&danger>.01;
    graph.alarm.gain.setTargetAtTime(alarmOn?1:0,now,.15);
    graph.drone.frequency.setTargetAtTime(110*Math.pow(2,danger*3),now,.2);
    graph.droneGain.gain.setTargetAtTime(alarmOn?.03+.07*danger:0,now,.2);
    if(!on){nextBeat=0;railNext=0;beepNext=0;return;}
    const beatLength=.8-.35*danger;
    if(!nextBeat||nextBeat<now-1)nextBeat=now+.05;
    while(nextBeat<now+.3){
      if(beat%2===0&&Math.random()<.65){
        stepIndex=Math.max(0,Math.min(SCALE.length-1,stepIndex+Math.round((Math.random()*2-1)*2.2)));
        pluck(nextBeat,SCALE[stepIndex],.09);
      }
      if(beat%8===0&&now-lastHorn>24&&Math.random()<.18&&danger<.01){lastHorn=now;horn(nextBeat);}
      beat++;nextBeat+=beatLength;
    }
    if(vel>.6){
      const rate=(.4+vel*.15)*(1+danger*.6);
      if(!railNext||railNext<now-1)railNext=now+.02;
      while(railNext<now+.12){thump(railNext,.2,420);thump(railNext+.13,.13,320);railNext+=1/rate;}
    }else railNext=0;
    if(alarmOn){
      if(!beepNext||beepNext<now-1)beepNext=now+.02;
      while(beepNext<now+.12){beep(beepNext,220*Math.pow(2,danger*2.6));beepNext+=1/(2+9*danger);}
    }else beepNext=0;
  }
  function ambient(on){wanted=on;if(!timer)timer=setInterval(tick,40);}
  function update(velocity,level){vel=Math.max(0,velocity);danger=Math.min(1,Math.max(0,level));}
  return {unlock,play,ambient,update,toggle(){enabled=!enabled;unlock();return enabled;}};
})();
