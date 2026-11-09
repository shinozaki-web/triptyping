'use strict';
(()=>{
  const {config,core,romaji,ui,sound,scene,ranking}=Railway;
  const $=ui.$;
  let s,matcher,typed='',last=performance.now(),pausedFrom='running',arrivalTimer=0;
  let lastPaint=0,scenePaint=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selectedLevel=()=>document.querySelector('input[name="level"]:checked').value;
  function initial(){return {mode:'idle',level:selectedLevel(),leg:0,wordIndex:0,elapsed:0,legElapsed:0,brakeFrom:0,brakeTo:1,brakeDuration:1.8,crashT:0,crashShown:false,warned:false,score:0,total:0,correct:0,combo:0,maxCombo:0,plan:null,completed:0,velocity:0,motion:0,progress:0,learned:[],arrivals:[]};}
  function setMode(mode){s.mode=mode;ui.screen(mode);}
  function showWord(){
    typed='';const leg=s.plan[s.leg],word=leg.words[s.wordIndex];matcher=romaji.create(word.yomi);
    ui.prompt(word,s.wordIndex,leg.words.length,matcher,typed);ui.feedback(s.wordIndex===leg.words.length-1?'最後は到着駅。打ち終えると自動で停車します。':'電車は自動で走っています。止まれるうちに打ち切ろう。');ui.focus();
  }
  function syncClock(now){const delta=Math.max(0,(now-last)/1000);last=now;if(s.mode==='running'){s.elapsed+=delta;s.legElapsed+=delta;}return delta;}
  function start(){
    $('arrival-dialog').close();$('pause-dialog').close();sound.unlock();s=initial();s.plan=core.plan(Railway.data.words,config.levels[s.level]);
    ranking.visit(0,[]);ui.collection();$('record-level').value=s.level;ui.records();
    $('hints').checked=true;$('romaji').classList.remove('no-hints');
    setMode('running');last=performance.now();ui.danger(false);ui.route(0);ui.text('run-state','運転中');showWord();ui.stats(s);document.querySelector('.game-shell').scrollIntoView({block:'start'});
  }
  function reset(){
    $('arrival-dialog').close();$('pause-dialog').close();s=initial();setMode('idle');ui.danger(false);ui.route(0);ui.stats(s);ui.progress(0);ui.text('run-state','発車準備');
    $('start').focus({preventScroll:true});
  }
  function pause(){
    if(!['running','approach'].includes(s.mode))return;
    syncClock(performance.now());pausedFrom=s.mode;setMode('paused');ui.text('run-state','一時停止');ui.stats(s);$('pause-dialog').showModal();
  }
  function resume(){
    if(s.mode!=='paused')return;$('pause-dialog').close();setMode(pausedFrom);last=performance.now();ui.text('run-state',s.mode==='approach'?'自動停車中':'運転中');ui.focus();
  }
  function accept(key){
    if(s.mode!=='running')return;
    syncClock(performance.now());s.total++;
    const result=matcher.match(typed+key);
    if(!result.valid){s.combo=0;sound.play('error');ui.feedback('そのキーは違うみたい。正しいキーを打てば大丈夫。',true);ui.stats(s);return;}
    typed+=key;s.correct++;s.combo++;s.maxCombo=Math.max(s.maxCombo,s.combo);sound.play('key');
    ui.spelling(matcher,typed);ui.feedback('いい調子。そのまま進もう。');
    if(result.complete){
      const word=s.plan[s.leg].words[s.wordIndex];s.learned.push(word.id);
      s.score+=Math.round((word.romaji.length*12+Math.min(s.combo,30)*5)*config.levels[s.level].multiplier);
      s.completed++;s.wordIndex++;sound.play('word');
      if(s.wordIndex===s.plan[s.leg].words.length){
        const duration=s.plan[s.leg].duration;
        s.brakeFrom=s.progress;s.brakeTo=Math.max(1,s.progress+.03);s.brakeDuration=Math.min(4,Math.max(1.8,(s.brakeTo-s.progress)*duration/core.PACE*.5));
        arrivalTimer=0;setMode('approach');ui.danger(false);ui.text('run-state','自動停車中');ui.feedback('入力完了。ブレーキをかけています。到着まで少しお待ちください。');
      }else showWord();
    }
    ui.stats(s);
  }
  function arrive(){
    s.progress=s.brakeTo;s.velocity=0;const final=s.leg===2;setMode(final?'finished':'station');
    ui.text('run-state',final?'小倉に到着':'駅に到着');ui.route(s.leg,true);
    const arrival=core.arrival(s.plan[s.leg].duration,s.legElapsed);s.arrivals.push(arrival);
    ranking.visit(s.leg+1,s.learned);s.learned=[];
    let record=null,tip=arrival.ontime?'駅スタンプを獲得！この調子で走ろう。':'あわてず正確に。ミスを減らすのも、上達への近道。';
    if(final){
      record={...core.metrics(s.correct,s.total,s.elapsed,s.score),level:s.level,date:new Date().toLocaleDateString('sv-SE'),delay:-arrival.seconds};
      const previous=ranking.get().records.filter(r=>r.level===s.level);
      const best=previous.length?Math.max(...previous.map(r=>r.cpm)):0;
      tip=best&&record.cpm>best?'これまでの最高より、1分あたり'+(record.cpm-best)+'文字アップ！':'全4駅のスタンプを獲得！また走ると、新しい地域のことばに出会えます。';
      ranking.save(record);
    }
    ui.collection();sound.play('station');ui.arrival(s,final,record,tip);ui.stats(s);
  }
  function next(){
    if(s.mode==='finished'||s.mode==='crashed'){start();return;}
    if(s.mode!=='station')return;
    $('arrival-dialog').close();s.leg++;s.wordIndex=0;s.progress=0;s.velocity=0;s.motion=0;s.legElapsed=0;s.warned=false;
    setMode('running');last=performance.now();ui.route(s.leg);ui.text('run-state','運転中');showWord();ui.stats(s);
  }
  function crash(){
    s.progress=core.CRASH_PROGRESS;s.velocity=0;s.crashT=0;setMode('crashed');
    ui.danger(false);ui.text('run-state','衝突！');ui.feedback('ブレーキが間に合わなかった…');sound.play('crash');ui.stats(s);
  }
  function frame(now){
    const delta=syncClock(now);
    if(s.mode==='running'){
      const duration=s.plan[s.leg].duration;
      s.progress=core.legProgress(s.legElapsed,duration);
      const cruise=Math.min(22,core.PACE/duration*450);
      s.velocity+=(cruise-s.velocity)*Math.min(1,delta*4);s.motion+=s.velocity*delta;
      if(s.progress>=core.PACE&&!s.warned){s.warned=true;ui.danger(true);ui.text('run-state','オーバーラン注意！');ui.feedback('間に合わない！壁が近づいています。急いで打ち切ろう！',true);}
      if(core.crashed(s.progress))crash();
    }else if(s.mode==='approach'){
      arrivalTimer+=delta;const t=Math.min(1,arrivalTimer/s.brakeDuration);
      s.progress=s.brakeFrom+(s.brakeTo-s.brakeFrom)*(1-(1-t)*(1-t));
      s.velocity=Math.min(22,(s.brakeTo-s.brakeFrom)*2*(1-t)/s.brakeDuration*450);s.motion+=s.velocity*delta;
      if(t>=1)arrive();
    }else if(s.mode==='crashed'){
      s.crashT+=delta;
      if(s.crashT>=1.8&&!s.crashShown){s.crashShown=true;ui.crash(s);}
    }
    const active=['running','approach','station'].includes(s.mode);
    sound.ambient(active);sound.update(active?s.velocity:0,s.mode==='running'?core.danger(s.progress):0);
    if(now-lastPaint>100){ui.stats(s);ui.progress(s.progress);lastPaint=now;}
    if(now-scenePaint>(reduced?180:32)){
      scene.render({leg:s.leg,progress:s.progress,motion:reduced?0:s.motion,velocity:s.mode==='paused'?0:s.velocity,finished:['station','finished'].includes(s.mode),active:s.mode==='running',crash:s.mode==='crashed'?s.crashT:0});scenePaint=now;
    }
    requestAnimationFrame(frame);
  }
  $('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('resume').addEventListener('click',resume);$('reset').addEventListener('click',reset);$('continue').addEventListener('click',next);$('choose-level').addEventListener('click',reset);
  $('sound').addEventListener('click',()=>{const on=sound.toggle();ui.text('sound','音 '+(on?'ON':'OFF'));$('sound').setAttribute('aria-pressed',String(on));});
  $('hints').addEventListener('change',()=>{$('romaji').classList.toggle('no-hints',!$('hints').checked);ui.focus();});
  document.querySelectorAll('input[name="level"]').forEach(input=>input.addEventListener('change',()=>{ui.text('level-help',config.levels[selectedLevel()].help);$('record-level').value=selectedLevel();ui.records();}));
  $('record-level').addEventListener('change',ui.records);
  const input=$('key-input');
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();pause();return;}
    if(event.isComposing)return;
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.repeat){event.preventDefault();return;}
    if(/^[a-zA-Z'-]$/.test(event.key)){event.preventDefault();accept(event.key.toLowerCase());input.value='';}
    else if(event.key==='Backspace'||event.key===' '||event.key==='Enter'){event.preventDefault();}
  });
  input.addEventListener('beforeinput',event=>{
    event.preventDefault();
    if(event.inputType==='insertText'&&event.data&&/^[a-zA-Z'-]$/.test(event.data))accept(event.data.toLowerCase());
    else if(event.isComposing||event.inputType==='insertCompositionText')ui.feedback('日本語入力をOFFにして、半角英字で打ってみよう。',true);
    input.value='';
  });
  input.addEventListener('input',()=>{input.value='';});
  input.addEventListener('paste',e=>{e.preventDefault();ui.feedback('コピーではなく、一文字ずつ打って練習しよう。');});
  input.addEventListener('drop',e=>e.preventDefault());
  input.addEventListener('compositionend',()=>{input.value='';ui.feedback('日本語入力をOFFにして、半角英字で打ってみよう。',true);});
  for(const id of ['pause-dialog','arrival-dialog'])$(id).addEventListener('cancel',e=>e.preventDefault());
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  ui.setup();s=initial();ui.route(0);ui.stats(s);requestAnimationFrame(frame);
})();
