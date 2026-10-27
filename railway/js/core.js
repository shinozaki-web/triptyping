(function(root){
  'use strict';
  function shuffle(items,random=Math.random) {
    const list=[...items];
    for(let i=list.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
    return list;
  }
  function plan(words,level,random=Math.random) {
    let target=0;
    return [0,1,2].map(leg=>{
      const pool=words.filter(w=>w.leg===leg);
      const station=pool.find(w=>w.area==='到着駅');
      const eligible=pool.filter(w=>w!==station && (level.cpm!==60 || w.romaji.length<=16));
      // A short place name first; at least one mountain and one local institution per leg.
      const selected=[];
      for(const category of [['地名'],['山'],['企業','小学校','中学校','高校','施設','公園']]) {
        const pick=shuffle(eligible.filter(w=>category.includes(w.category)),random)[0];
        if(pick) selected.push(pick);
      }
      const extras=shuffle(eligible.filter(w=>!selected.includes(w)),random);
      while(selected.length<level.words && extras.length) selected.push(extras.shift());
      selected.push(station);
      const characters=selected.reduce((sum,w)=>sum+w.romaji.length,0);
      const duration=Math.ceil(characters*60/level.cpm);
      target+=duration;
      return {words:selected,characters,duration,target};
    });
  }
  function metrics(correct,total,elapsed,score) {
    return {cpm:elapsed>0?Math.round(correct*60/elapsed):0,accuracy:total?Math.round(correct/total*100):100,score};
  }
  function arrival(target,elapsed){const diff=target-elapsed;const seconds=diff>=0?Math.floor(diff):-Math.ceil(-diff);return {seconds,ontime:diff>=0};}
  const api={plan,metrics,arrival};
  if(typeof module==='object' && module.exports) module.exports=api;
  else {root.Railway=root.Railway||{};root.Railway.core=api;}
})(typeof window==='object'?window:globalThis);
