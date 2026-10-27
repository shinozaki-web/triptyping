'use strict';
Railway.ranking = (()=>{
  const key='triptyping.railway.v1';
  const empty=()=>({records:[],stamps:[],words:[]});
  function validRecord(r){return r&&['easy','normal','hard'].includes(r.level)&&['score','cpm','accuracy','delay'].every(k=>Number.isFinite(r[k]))&&r.score>=0&&r.score<1e8&&r.cpm>=0&&r.cpm<1e5&&r.accuracy>=0&&r.accuracy<=100&&typeof r.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(r.date);}
  function read(){
    try{
      const raw=localStorage.getItem(key);if(!raw||raw.length>40000)return empty();
      const saved=JSON.parse(raw);
      return {records:Array.isArray(saved.records)?saved.records.filter(validRecord).slice(0,30):[],stamps:Array.isArray(saved.stamps)?saved.stamps.filter(n=>Number.isInteger(n)&&n>=0&&n<4).slice(0,4):[],words:Array.isArray(saved.words)?[...new Set(saved.words.filter(id=>Railway.data.words.some(w=>w.id===id)))].slice(0,40):[]};
    }catch(_){return empty();}
  }
  let state=read();
  let available=true;
  function persist(){try{localStorage.setItem(key,JSON.stringify(state));return available=true;}catch(_){available=false;return false;}}
  return {
    get(){return {records:[...state.records],stamps:[...state.stamps],words:[...state.words],available};},
    visit(station,words){state.stamps=[...new Set([...state.stamps,station])];state.words=[...new Set([...state.words,...words])];persist();},
    save(record){if(!validRecord(record))return false;state.records.push(record);state.records.sort((a,b)=>b.score-a.score);state.records=['easy','normal','hard'].flatMap(level=>state.records.filter(r=>r.level===level).slice(0,10));return persist();}
  };
})();
