/* Kana-position graph: spelling variants share the same progress, without enumerating words. */
(function (root) {
  'use strict';
  const rows = {
    'あいうえお': ['a','i','u','e','o'], 'かきくけこ': ['ka','ki','ku','ke','ko'],
    'さしすせそ': ['sa','shi|si','su','se','so'], 'たちつてと': ['ta','chi|ti','tsu|tu','te','to'],
    'なにぬねの': ['na','ni','nu','ne','no'], 'はひふへほ': ['ha','hi','fu|hu','he','ho'],
    'まみむめも': ['ma','mi','mu','me','mo'], 'やゆよ': ['ya','yu','yo'],
    'らりるれろ': ['ra','ri','ru','re','ro'], 'わを': ['wa','wo'],
    'がぎぐげご': ['ga','gi','gu','ge','go'], 'ざじずぜぞ': ['za','ji|zi','zu','ze','zo'],
    'だぢづでど': ['da','di','du','de','do'], 'ばびぶべぼ': ['ba','bi','bu','be','bo'],
    'ぱぴぷぺぽ': ['pa','pi','pu','pe','po'], 'ぁぃぅぇぉゃゅょ': ['xa|la','xi|li','xu|lu','xe|le','xo|lo','xya|lya','xyu|lyu','xyo|lyo'],
    'ー': ['-']
  };
  const singles = {};
  Object.entries(rows).forEach(([kana, values]) => Array.from(kana).forEach((k,i) => { singles[k] = values[i].split('|'); }));
  const pairs = {};
  const stems = { 'き':'ky', 'ぎ':'gy', 'し':'sh|sy', 'じ':'j|jy|zy', 'ち':'ch|ty|cy', 'に':'ny', 'ひ':'hy', 'び':'by', 'ぴ':'py', 'み':'my', 'り':'ry' };
  Object.entries(stems).forEach(([k, prefixes]) => ['ゃ','ゅ','ょ'].forEach((small,i) => {
    pairs[k+small] = prefixes.split('|').map(p => p + ['a','u','o'][i]);
  }));
  function graph(yomi) {
    const kana = yomi.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0)-96));
    function ordinary(i) {
      const list=[];
      if (pairs[kana.slice(i,i+2)]) pairs[kana.slice(i,i+2)].forEach(text => list.push({text,next:i+2}));
      (singles[kana[i]] || []).forEach(text => list.push({text,next:i+1}));
      return list;
    }
    const edges=Array.from({length:kana.length},(_,i) => {
      if(kana[i]==='ん') {
        const next=kana[i+1];
        const choices=(!next || !'あいうえおやゆよぁぃぅぇぉゃゅょ'.includes(next)) ? ['n','nn',"n'",'xn'] : ['nn',"n'",'xn'];
        return choices.map(text=>({text,next:i+1}));
      }
      if(kana[i]==='っ') {
        const list=[];
        ordinary(i+1).forEach(e=>{
          if(!/^[aeiounxl-]/.test(e.text)) list.push({text:e.text[0]+e.text,next:e.next});
          if(e.text.startsWith('ch')) list.push({text:'t'+e.text,next:e.next});
        });
        return list.concat(['xtsu','ltsu','xtu','ltu'].map(text=>({text,next:i+1})));
      }
      const list=ordinary(i);
      if(!list.length) throw new Error('未対応のかな: '+kana[i]);
      return list;
    });
    const suffix=[]; suffix[kana.length]='';
    for(let i=kana.length-1;i>=0;i--) suffix[i]=edges[i][0].text+suffix[edges[i][0].next];
    return {kana,edges,suffix};
  }
  function create(yomi) {
    const g=graph(yomi);
    function match(input) {
      const memo=new Map();
      function visit(pos,offset) {
        const key=pos+':'+offset;
        if(memo.has(key)) return memo.get(key);
        const rest=input.slice(offset);
        if(!rest.length) return {valid:true,complete:pos===g.kana.length,rest:g.suffix[pos],progress:pos/g.kana.length};
        if(pos===g.kana.length) return null;
        for(const e of g.edges[pos]) {
          if(rest.startsWith(e.text)) {
            const found=visit(e.next,offset+e.text.length);
            if(found) {memo.set(key,found);return found;}
          } else if(e.text.startsWith(rest)) {
            return {valid:true,complete:false,rest:e.text.slice(rest.length)+g.suffix[e.next],progress:(pos+(e.next-pos)*rest.length/e.text.length)/g.kana.length};
          }
        }
        memo.set(key,null);return null;
      }
      return visit(0,0) || {valid:false,complete:false,rest:'',progress:0};
    }
    return {match, canonical:g.suffix[0]};
  }
  const api={create};
  if(typeof module==='object' && module.exports) module.exports=api;
  else {root.Railway=root.Railway||{};root.Railway.romaji=api;}
})(typeof window==='object'?window:globalThis);
