const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {create}=require('../js/romaji.js');
const core=require('../js/core.js');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync(require.resolve('../js/data.js'),'utf8').replace('Railway.data','window.Railway.data'),context);
const data=context.window.Railway.data;
function accepts(kana,input){
  const matcher=create(kana);
  for(let i=0;i<=input.length;i++)assert.equal(matcher.match(input.slice(0,i)).valid,true,kana+': '+input.slice(0,i));
  assert.equal(matcher.match(input).complete,true,kana+': '+input);
}
test('every published word supports its canonical spelling, one keystroke at a time',()=>{
  assert.equal(data.words.length,40);
  for(const word of data.words){accepts(word.yomi,word.romaji);assert.ok(data.sources[word.source]);}
});
test('common spelling variants, contracted sounds, small kana, nasal n, and sokuon',()=>{
  for(const [kana,inputs] of [
    ['しちつ',['shichitsu','sititu','shititu']],
    ['しゃちゅじょ',['shachujo','syatyuzyo','sixyachilyujilyo']],
    ['がっこう',['gakkou','gaxtsukou','galtukou']],
    ['まっちゃ',['maccha','matcha','maxtsucha']],
    ['かんもんきせん',['kanmonkisen','kannmonnkisenn',"kan'mon'kisen"]],
    ['あんない',['annai','annnai']],
    ['かんい',['kanni',"kan'i",'kaxni']],
    ['チャチャタウン',['chachataun','tyatyataunn']],
    ['いづつや',['idutsuya','idutuya']]
  ])for(const input of inputs)accepts(kana,input);
});
test('wrong input cannot advance; n before vowel cannot be omitted',()=>{
  assert.equal(create('かんい').match('kani').valid,false);
  assert.equal(create('こくら').match('kokx').valid,false);
  assert.equal(create('こくら').match('kokurax').valid,false);
  assert.equal(create('こくら').match('ko').complete,false);
});
test('spelling variants yield the same completed progress',()=>{
  const matcher=create('しょうがっこう');
  assert.equal(matcher.match('shou').progress,matcher.match('syou').progress);
  assert.equal(matcher.match('shougakkou').progress,1);
});
test('each level has a varied route, correct destination order, and cumulative character-scaled timetable',()=>{
  for(const level of [{cpm:60,words:4},{cpm:120,words:5},{cpm:180,words:6}]){
    const plan=core.plan(data.words,level,()=>.3);let target=0;
    plan.forEach((leg,i)=>{
      assert.equal(leg.words.at(-1).name,['小森江','門司','小倉'][i]);
      assert.equal(new Set(leg.words.map(w=>w.id)).size,leg.words.length);
      assert.ok(leg.words.some(w=>w.category==='山'));
      assert.ok(leg.words.some(w=>w.category==='地名'));
      assert.equal(leg.characters,leg.words.reduce((sum,w)=>sum+w.romaji.length,0));
      assert.equal(leg.duration,Math.ceil(leg.characters*60/level.cpm));
      target+=leg.duration;assert.equal(leg.target,target);
    });
  }
});
test('lateness is explicit, can be recovered, and CPM / accuracy reflect actual keystrokes',()=>{
  assert.deepEqual(core.arrival(60,60.01),{seconds:-1,ontime:false});
  assert.deepEqual(core.arrival(60,60),{seconds:0,ontime:true});
  assert.deepEqual(core.arrival(120,115),{seconds:5,ontime:true});
  assert.deepEqual(core.metrics(60,75,30,1234),{cpm:120,accuracy:80,score:1234});
});
test('corrupt or unavailable local storage is safe, and text-like score payloads are discarded',()=>{
  const code=fs.readFileSync(require.resolve('../js/ranking.js'),'utf8');
  for(const localStorage of [
    {getItem:()=>'{bad',setItem:()=>{throw Error('quota');}},
    {getItem:()=>JSON.stringify({records:[{level:'easy',score:'<img>',cpm:1,accuracy:1,delay:0,date:'2026-10-27'}],stamps:[0,'evil',99],words:['m01','<img>']}),setItem:()=>{}},
    {getItem:()=>{throw Error('unavailable');},setItem:()=>{throw Error('blocked');}}
  ]){
    const c={Railway:{data},localStorage};vm.createContext(c);vm.runInContext(code,c);
    assert.equal(c.Railway.ranking.get().records.length,0);
    c.Railway.ranking.visit(1,['m01']);assert.ok(c.Railway.ranking.get().stamps.includes(1));
    assert.equal(c.Railway.ranking.save({level:'easy',score:100,cpm:60,accuracy:100,delay:0,date:'2026-10-27'}),c.Railway.ranking.get().available);
  }
});
