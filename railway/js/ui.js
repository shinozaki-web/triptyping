'use strict';
Railway.ui = (()=>{
  const $=id=>document.getElementById(id);
  const time=seconds=>{const value=Math.max(0,Math.floor(seconds));return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');};
  function text(id,value){$(id).textContent=value;}
  function records(){
    const saved=Railway.ranking.get(),level=$('record-level').value;
    const list=$('records');list.replaceChildren();
    const rows=saved.records.filter(r=>r.level===level).slice(0,3);
    if(!rows.length){const li=document.createElement('li');li.className='empty';li.textContent='最初の乗務記録を残そう。';list.append(li);}
    rows.forEach((r,i)=>{const li=document.createElement('li'),label=document.createElement('span'),score=document.createElement('b');label.textContent=(i+1)+'. '+r.date+' / '+r.cpm+'文字/分';score.textContent=r.score.toLocaleString()+'点';li.append(label,score);list.append(li);});
    text('storage-note',saved.available?'完走した記録を保存します。名前の登録は不要です。':'この環境では保存できません。今開いている間は記録を表示します。');
  }
  function collection(){
    const saved=Railway.ranking.get();text('collection-count','ことば '+saved.words.length+' / '+Railway.data.words.length);
    $('stamps').replaceChildren(...Railway.config.stations.map((name,i)=>{
      const div=document.createElement('div');div.className='stamp'+(saved.stamps.includes(i)?' earned':'');
      const label=document.createElement('span'),small=document.createElement('small');label.textContent=name;small.textContent=saved.stamps.includes(i)?'VISITED':'未到着';div.append(label,small);return div;
    }));
    const learned=Railway.data.words.filter(w=>saved.words.includes(w.id));
    $('word-collection').replaceChildren();
    if(!learned.length)text('word-collection','運転を終えた区間のことばが、ここに増えていきます。');
    learned.forEach(w=>{const span=document.createElement('span');span.textContent=w.name;span.title=w.yomi+' / '+w.category;$('word-collection').append(span);});
    records();
  }
  function setup(){
    Object.values(Railway.data.sources).forEach(source=>{
      const li=document.createElement('li'),a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';li.append(a);$('sources').append(li);
    });collection();
  }
  function screen(mode){
    $('departure').hidden=mode!=='idle';$('welcome').hidden=mode!=='idle';$('typing').hidden=mode==='idle';$('pause').hidden=!['running','approach'].includes(mode);
    document.body.classList.toggle('playing',mode!=='idle');
    $('key-input').disabled=mode!=='running';
  }
  function route(leg,arrived=false){document.querySelectorAll('.route li').forEach((el,i)=>{
    el.classList.toggle('visited',i<=leg+(arrived?1:0));el.classList.toggle('current',i===(arrived?leg+1:leg));
    if(i===(arrived?leg+1:leg))el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');
  });text('next-station',Railway.config.stations[leg]+' → '+Railway.config.stations[leg+1]);}
  function prompt(word,index,total,matcher,input){
    text('word-tag',word.category);text('word-count',(index+1)+' / '+total);text('word',word.name);text('yomi',word.yomi);text('area','エリア：'+word.area);
    spelling(matcher,input);
  }
  function spelling(matcher,input){
    const result=matcher.match(input);text('typed',input);text('next-key',result.rest[0]||'');text('remaining',result.rest.slice(1));
    $('romaji').setAttribute('aria-label',input+result.rest);
  }
  function feedback(message,error=false){text('feedback',message);$('feedback').classList.toggle('mistake',error);}
  function stats(s){
    text('elapsed',time(s.elapsed));text('score',s.score.toLocaleString());text('accuracy',s.total?Math.round(s.correct/s.total*100)+'%':'—');text('combo',s.combo+' COMBO');
    if(s.plan){
      const diff=s.plan[s.leg].target-s.elapsed;
      text('schedule-label',diff>=0?'目標まで':'目標を超過');text('schedule',(diff<0?'+':'')+time(Math.abs(diff)));
      $('schedule').className=diff<0?'late':'early';
    } else {text('schedule','—');text('schedule-label','到着目標');$('schedule').className='';}
  }
  function progress(value){$('track-fill').style.width=(value*100)+'%';$('track-fill').parentElement.setAttribute('aria-valuenow',Math.round(value*100));}
  function focus(){if(!$('key-input').disabled)$('key-input').focus({preventScroll:true});}
  function arrival(s,final,record,tip){
    const result=Railway.core.arrival(s.plan[s.leg].target,s.elapsed);
    text('arrival-eyebrow',final?'ALL STATIONS COMPLETE':'STATION ARRIVAL');text('arrival-stamp',Railway.config.stations[s.leg+1]);
    text('arrival-title',result.ontime?'定時到着！':Math.abs(result.seconds)+'秒遅れで到着');
    text('arrival-detail',result.ontime?result.seconds+'秒の余裕をもって到着しました。':'最後までよく走りきりました。'+(final?'次の運転で、もう一度挑戦しよう。':'次の区間で、遅れを取り戻そう。'));
    text('arrival-tip',tip);$('final-metrics').hidden=!final;
    if(final){$('final-metrics').replaceChildren(...[['スコア',record.score.toLocaleString()],['文字 / 分',record.cpm],['正確さ',record.accuracy+'%']].map(([label,value])=>{const div=document.createElement('div'),span=document.createElement('span'),strong=document.createElement('strong');span.textContent=label;strong.textContent=value;div.append(span,strong);return div;}));}
    text('continue',final?'もう一度運転する →':'次の駅へ →');$('choose-level').hidden=!final;$('next-app-cta').hidden=!final;
    $('arrival-dialog').showModal();$('continue').focus();
  }
  return {$,text,time,setup,screen,route,prompt,spelling,feedback,stats,progress,focus,arrival,collection,records};
})();
