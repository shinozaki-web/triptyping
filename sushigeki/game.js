
const DIFF_LEVELS = { beginner:[1], easy:[1], normal:[1,2], hard:[1,2,3] };
const LANE_COUNTS = { beginner:1, easy:1, normal:2, hard:3 };
// 流れる速度 px/frame (60fps想定)
const BASE_SPEEDS = { beginner:0.35, easy:0.7, normal:1.2, hard:1.7 };
const DIFF_MULT = { beginner:0.5, easy:1.0, normal:1.5, hard:2.0 };

// ============================================================
// たまごモード：指ガイド用データ
// ============================================================
// キー → [指番号, 指名, 色]
const FINGER_MAP = {
  q:[0,'左小指','#9B59B6'], a:[0,'左小指','#9B59B6'], z:[0,'左小指','#9B59B6'],
  w:[1,'左薬指','#2980B9'], s:[1,'左薬指','#2980B9'], x:[1,'左薬指','#2980B9'],
  e:[2,'左中指','#16A085'], d:[2,'左中指','#16A085'], c:[2,'左中指','#16A085'],
  r:[3,'左人差し指','#27AE60'], f:[3,'左人差し指','#27AE60'], v:[3,'左人差し指','#27AE60'],
  t:[3,'左人差し指','#27AE60'], g:[3,'左人差し指','#27AE60'], b:[3,'左人差し指','#27AE60'],
  y:[4,'右人差し指','#F39C12'], h:[4,'右人差し指','#F39C12'], n:[4,'右人差し指','#F39C12'],
  u:[4,'右人差し指','#F39C12'], j:[4,'右人差し指','#F39C12'], m:[4,'右人差し指','#F39C12'],
  i:[5,'右中指','#E67E22'], k:[5,'右中指','#E67E22'],
  o:[6,'右薬指','#E74C3C'], l:[6,'右薬指','#E74C3C'],
  p:[7,'右小指','#C0392B'],
};
const KB_ROWS = [
  ['q','w','e','r','t','y','u','i','o','p'],
  ['a','s','d','f','g','h','j','k','l'],
  ['z','x','c','v','b','n','m'],
];
const PLATE_COLORS = ['pc-red','pc-gold','pc-teal','pc-blue','pc-purple'];

// ============================================================
// STATE
// ============================================================
let diff = 'easy';
let lang = 'jp';
let gameActive = false;
let startTime = null;
let timeLeft = 60;
let timerInt = null;
let animFrame = null;
let score = 0;
let totalKeys = 0;
let correctKeys = 0;
let completedWords = 0;
let combo = 0;
let maxCombo = 0;
let itemsSinceQuiz = 0;
let quizUsed = new Set();
let soundOn = true;

// powerup state
let puActive = null;
let puEndTime = 0;
let puInt = null;

// 金ネタ状態
let goldPlate = null;       // 現在流れている金皿
let goldSpawnTimer = null;  // 次の金ネタ出現タイマー
let timeFrozen = false;     // タイムフリーズ中

// 罰ネタ状態
let trapPlate = null;
let trapSpawnTimer = null;

// 罰ネタ定義（金ネタと同じ見た目、⚠️マークだけ違う）
const TRAP_ITEMS = [
  { e:'🐟', n:'大トロ',    r:'ootoro',    trap:'time_minus',    trapDesc:'時間 -15秒！' },
  { e:'🦔', n:'ウニ',      r:'uni',       trap:'combo_reset',   trapDesc:'コンボリセット！' },
  { e:'🐡', n:'フグ',      r:'fugu',      trap:'score_half',    trapDesc:'スコア半減！' },
];

// 金ネタ定義（ネタ+パワーアップ効果）
const GOLD_ITEMS = [
  { e:'🐟', n:'大トロ',    r:'ootoro',    pu:'time_extend', puIcon:'⏱', puName:'時間延長',    puDesc:'+20秒！',             color:'#F39C12' },
  { e:'🦔', n:'ウニ',      r:'uni',       pu:'score_x3',    puIcon:'🔥', puName:'スコア3倍',   puDesc:'スコア3倍！20秒間',   color:'#E67E22' },
  { e:'🐚', n:'アワビ',    r:'awabi',     pu:'slow',        puIcon:'🧊', puName:'冷却タイム',  puDesc:'ベルト半速！30秒間',  color:'#1ABC9C' },
  { e:'🦐', n:'ボタンエビ',r:'botannebi', pu:'combo2',      puIcon:'⚡', puName:'コンボ激化',  puDesc:'コンボ2倍！30秒間',   color:'#9B59B6' },
  { e:'🐡', n:'フグ',      r:'fugu',      pu:'time_freeze', puIcon:'❄️', puName:'タイムフリーズ',puDesc:'時間停止！10秒間',  color:'#3498DB' },
];

// lane plates: array of { laneIdx, item, el, x, word, typed, active, done }
let plates = [];
let pool = [];
let laneEls = [];
let laneWidth = 0;
let SPEED = 1.2;
let activeIdx = 0; // which plate index is in the typing zone
let laneSpawnDelay = []; // レーンごとの初回スポーン遅延フレーム数

// ============================================================
// NORMALIZE
// ============================================================
function norm(s){
  return s.replace(/ /g,'').toLowerCase()
    .replace(/si/g,'shi')   // し: si→shi
        .replace(/tu/g,'tsu');  // つ: tu→tsu
}
// カタカナ→ひらがな変換＋スペース除去（クイズ日本語正解判定用）
function normJP(s){ return s.replace(/[\s　]/g,'').replace(/[\u30A1-\u30F6]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60)); }

// ============================================================
// BUILD LANES
// ============================================================
function buildLanes(){
  const cnt = LANE_COUNTS[diff];
  const lanesDiv = document.getElementById('lanes');
  lanesDiv.innerHTML = '';
  laneEls = [];
  for(let i=0;i<cnt;i++){
    const l = document.createElement('div');
    l.className = 'lane';
    l.innerHTML = `<span class="zone-label">3×ゾーン</span>`;
    lanesDiv.appendChild(l);
    laneEls.push(l);
  }
  laneWidth = lanesDiv.offsetWidth || 800;
  // レーンごとに初回スポーンをずらす（レーン0はすぐ、以降150フレームずつ遅延）
  laneSpawnDelay = Array.from({length: cnt}, (_, i) => i * 150);
}

// ============================================================
// POOL
// ============================================================
function buildPool(){
  const lvs = DIFF_LEVELS[diff];
  let src = ALL_ITEMS.filter(it => lvs.includes(it.lv));
  // たまごモード: 3〜4文字の超短いネタのみ
  if(diff === 'beginner') src = src.filter(it => it.p !== '' && norm(it.r).length <= 4);
  // 板前モード: 寿司ネタのみ（価格あり = 食材・寿司ネタ）
  if(diff === 'normal') src = src.filter(it => it.p !== '');
  if(puActive && puActive.id === 'short') src = src.filter(it => norm(it.r).length <= 6);
  pool = [];
  while(pool.length < 40) pool.push(...src.sort(()=>Math.random()-.5));
  return pool;
}

// ============================================================
// PLATE MANAGEMENT
// ============================================================
function spawnPlate(laneIdx){
  const item = pool[Math.floor(Math.random()*pool.length)];
  const word = norm(item.r);
  const colorCls = item.tag ? 'pc-sponsor' : PLATE_COLORS[Math.floor(Math.random()*PLATE_COLORS.length)];

  const el = document.createElement('div');
  el.className = 'plate';
  el.style.left = '-90px';
  el.innerHTML = `
    <div class="plate-dish ${colorCls}">
      <div class="plate-emoji">${item.e}</div>
      <div class="plate-word">${word}</div>
    </div>
    <div class="plate-name">${item.n}</div>`;
  laneEls[laneIdx].appendChild(el);

  const plate = { laneIdx, item, el, x:-90, word, typed:'', active:false, done:false };
  el.addEventListener('click', () => selectTarget(plate));
  return plate;
}

function getPlatesInLane(li){ return plates.filter(p=>p.laneIdx===li&&!p.done); }

// ============================================================
// TARGET PLATE — TAB/クリックで手動切替可能、打ち終えた後は自動選択
// ============================================================
let targetPlate = null;
let lockedPlate = null; // 候補が1つに絞れた時点でロック

function lockNextTarget(){
  // すでに有効なターゲットがあれば変えない（手動選択を尊重）
  if(targetPlate && !targetPlate.done) return;
  // 画面内で最も左にある未完了の皿を自動選択（右端が入ってきた瞬間から対象）
  const visible = plates.filter(p => !p.done && p.x > -70);
  if(!visible.length){ targetPlate = null; return; }
  visible.sort((a,b) => a.x - b.x);
  targetPlate = visible[0];
  renderTarget(targetPlate.item, targetPlate.typed || '');
}

// クリック or TABで任意の皿を狙う
function selectTarget(p){
  if(!gameActive || gamePaused || p.done) return;
  targetPlate = p;
  const inp = document.getElementById('type-input');
  inp.value = p.typed || '';
  inp.focus();
  renderTarget(p.item, p.typed || '');
}

// TABキーで次の皿へ切替（type-inputにフォーカスがある時）
document.getElementById('type-input').addEventListener('keydown', function(e){
  if(e.code !== 'Tab') return;
  e.preventDefault();
  if(!gameActive || gamePaused) return;
  const available = plates.filter(p => !p.done && p.x > -70);
  if(available.length <= 1) return;
  const currentIdx = available.findIndex(p => p === targetPlate);
  const nextIdx = (currentIdx + 1) % available.length;
  selectTarget(available[nextIdx]);
});

// ============================================================
// ANIMATION LOOP
// ============================================================
function gameLoop(){
  if(!gameActive) return;
  animFrame = requestAnimationFrame(gameLoop);

  const speed = (puActive && puActive.id==='slow') ? SPEED*0.5
              : (puActive && puActive.id==='x2')  ? SPEED*1.5
              : SPEED;
  const goldSpeed = SPEED * 2.5; // 金ネタは2.5倍速
  // offsetWidthが0を返す場合（レイアウト未確定フレーム等）は前回の有効値を使う
  const rawW = laneEls[0] ? laneEls[0].offsetWidth : 0;
  if(rawW > 0) laneWidth = rawW;
  const laneW = laneWidth || 800;

  plates.forEach(p=>{
    if(p.done) return;
    p.x += p.isGold ? goldSpeed : speed;
    p.el.style.left = p.x + 'px';
    if(p.x > laneW + 20) plateMiss(p);
  });

  // スポーン：各レーンに皿を補充（遅延中のレーンはスキップ）
  laneEls.forEach((_,li)=>{
    if(laneSpawnDelay[li] > 0){ laneSpawnDelay[li]--; return; }
    const active = getPlatesInLane(li);
    const rightmost = active.length ? Math.max(...active.map(p=>p.x)) : -200;
    // 最大2枚に制限。次の皿は先頭皿が画面内（30%以上）に進んでから生成
    if(active.length < 2 && (active.length === 0 || rightmost > laneW * 0.3)){
      plates.push(spawnPlate(li));
    }
  });

  // ハイライト更新 — ロック済みは強く、他の候補はうっすら光らせる
  const curTyped = norm(document.getElementById('type-input').value);
  plates.forEach(p=>{
    const dish = p.el.querySelector('.plate-dish');
    if(!dish) return;
    if(p.done){ dish.classList.remove('active','semi-active'); return; }
    const matches = curTyped.length > 0 && p.word.startsWith(curTyped);
    dish.classList.toggle('active',      matches && p === lockedPlate);
    dish.classList.toggle('semi-active', matches && p !== lockedPlate);
  });

  // タイピング未入力時はヒントエリアを自動更新（ベルト上の次のネタを表示）
  if(curTyped.length === 0) lockNextTarget();
}

// ============================================================
// PLATE MISS
// ============================================================
function plateMiss(p){
  p.done = true;
  if(p.isTrap){ trapPlate = null; }
  const dish = p.el.querySelector('.plate-dish');

  // ダメネタが通り過ぎた場合はコンボリセットなし・スプラッシュなし（回避成功）
  if(p.isTrap){
    const typedNow = norm(document.getElementById('type-input').value);
    const stillMatch = typedNow.length > 0 && plates.some(q => !q.done && q !== p && q.word.startsWith(typedNow));
    if(!stillMatch){
      targetPlate = null;
      document.getElementById('type-input').value = '';
      document.getElementById('char-row').innerHTML = '';
      document.getElementById('tgt-name').textContent = '— 見えるネタをタイピング！ —';
      // コンボはリセットしない
    }
    const splash = document.createElement('div');
    splash.className = 'miss-splash';
    splash.style.color = '#2ecc71';
    splash.textContent = '回避！';
    splash.style.left = Math.min(p.x - 30, 200)+'px';
    splash.style.top = '20px';
    if(laneEls[p.laneIdx]) laneEls[p.laneIdx].appendChild(splash);
    setTimeout(()=>{ splash.remove(); p.el.remove(); plates = plates.filter(x=>x!==p); }, 700);
    return;
  }

  if(dish) dish.classList.add('miss');

  // 流れ去った後、現在の入力に一致する皿が残っていなければリセット
  const typedNow = norm(document.getElementById('type-input').value);
  const stillMatch = typedNow.length > 0 && plates.some(q => !q.done && q !== p && q.word.startsWith(typedNow));
  if(!stillMatch){
    targetPlate = null;
    document.getElementById('type-input').value = '';
    document.getElementById('char-row').innerHTML = '';
    document.getElementById('tgt-name').textContent = '— 見えるネタをタイピング！ —';
    if(typedNow.length > 0){ combo = 0; document.getElementById('sv-combo').textContent = '0'; }
  }

  const splash = document.createElement('div');
  splash.className = 'miss-splash';
  splash.textContent = '食べ損ね…';
  splash.style.left = Math.min(p.x - 30, 200)+'px';
  splash.style.top = '20px';
  if(laneEls[p.laneIdx]) laneEls[p.laneIdx].appendChild(splash);
  setTimeout(()=>{ splash.remove(); p.el.remove(); plates = plates.filter(x=>x!==p); }, 700);

  playMissVoice();
}

// ============================================================
// PLATE SUCCESS
// ============================================================
function plateSuccess(p){
  p.done = true;
  const dish = p.el.querySelector('.plate-dish');
  if(dish) dish.classList.add('done');

  const laneW = laneEls[0] ? laneEls[0].offsetWidth : 800;
  const pct = p.x / laneW;
  let mult = 1, popColor = '#fff', popLabel = '';
  if(pct < 0.25){ mult=3; popColor='#F39C12'; popLabel='神速！×3'; }
  else if(pct < 0.5){ mult=2; popColor='#2ECC71'; popLabel='はやい！×2'; }
  else { popLabel='×1'; }

  if(puActive && puActive.id==='x2') mult *= 2;
  if(puActive && puActive.id==='score_x3') mult *= 3;
  if(puActive && puActive.id==='combo') combo += 1;
  if(puActive && puActive.id==='combo2') combo += 1;

  const base = Math.max(10, norm(p.item.r).length * 12);
  const comboBonus = combo >= 3 ? combo * 5 : 0;
  const diffBonus = DIFF_MULT[diff] || 1.0;
  const pts = Math.round((base + comboBonus) * mult * diffBonus);

  combo++;
  if(combo > maxCombo) maxCombo = combo;
  score += pts;
  completedWords++;

  // じーも登場（難易度別条件 かつ クールダウンなし）
  const jimoCond = {
    easy:   { minCombo: 2, rate: 0.20 },
    normal: { minCombo: 3, rate: 0.28 },
    hard:   { minCombo: 3, rate: 0.35 },
  };
  const jc = jimoCond[diff];
  if(jc && combo >= jc.minCombo && !jimoCooldown && Math.random() < jc.rate) spawnJimo();
  itemsSinceQuiz++;
  correctKeys += norm(p.item.r).length;
  totalKeys   += norm(p.item.r).length;

  document.getElementById('sv-score').textContent = score.toLocaleString();
  document.getElementById('sv-combo').textContent = combo;
  flashStat('sv-score');
  if(combo >= 3){ showComboFx(combo); playComboSound(combo); }
  else { playCorrectSound(); }
  playCorrectVoice();

  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.style.cssText = `color:${popColor};left:${Math.min(p.x,300)}px;top:10px;`;
  pop.textContent = '+'+pts+(popLabel?' '+popLabel:'');
  if(laneEls[p.laneIdx]) laneEls[p.laneIdx].appendChild(pop);
  setTimeout(()=>pop.remove(), 700);
  setTimeout(()=>{ p.el.remove(); plates = plates.filter(x=>x!==p); }, 300);

  // 罰ネタ正解 → ペナルティ発動
  if(p.isTrap){
    trapPlate = null;
    triggerTrap(p.item.trap, p.item.trapDesc);
  }
  // 金ネタ正解 → パワーアップ即発動
  else if(p.isGold){
    goldPlate = null;
    activateGoldPowerup(p.item);
  }

  // ターゲットをクリアして次を探す
  targetPlate = null;

  if(itemsSinceQuiz >= 10){
    itemsSinceQuiz = 0;
    setTimeout(()=>triggerQuiz(), 300);
  }
}

// ============================================================
// RENDER TARGET
// ============================================================
function renderTarget(item, typed){
  if(!item) return;
  document.getElementById('tgt-emoji').textContent = item.e;
  document.getElementById('tgt-name').textContent = lang==='en' ? (item.en||item.n) : item.n;

  const yomiEl = document.getElementById('tgt-yomi');
  if(lang==='jp' && item.yomi && item.yomi!==item.n){ yomiEl.textContent='（'+item.yomi+'）'; yomiEl.style.display=''; }
  else yomiEl.style.display='none';

  const enEl = document.getElementById('tgt-en');
  if(lang==='bi' && item.en){ enEl.textContent=item.n+' — '+item.en; enEl.style.display=''; }
  else if(lang==='en'){ enEl.textContent='→ type: '+norm(item.r); enEl.style.display=''; }
  else enEl.style.display='none';

  document.getElementById('tgt-hint').textContent = item.h;

  const priceEl = document.getElementById('tgt-price');
  if(item.p){ priceEl.textContent=item.p; priceEl.style.display=''; } else priceEl.style.display='none';

  const spEl = document.getElementById('tgt-sponsor-badge');
  const tz   = document.getElementById('typing-zone');
  if(item.tag){ spEl.textContent='★ '+item.tag; spEl.style.display=''; tz.classList.add('sponsor-active'); }
  else { spEl.style.display='none'; tz.classList.remove('sponsor-active'); }

  renderCharBoxes(typed, norm(item.r));
  updateFingerGuide(typed, norm(item.r));
}

// ============================================================
// たまごモード：指ガイド描画
// ============================================================
function updateFingerGuide(typed, word){
  const guide = document.getElementById('finger-guide');
  if(diff !== 'beginner' || !word){ guide.classList.remove('show'); return; }
  guide.classList.add('show');

  const nextKey = typed.length < word.length ? word[typed.length] : null;
  const info = nextKey ? FINGER_MAP[nextKey] : null;
  const color = info ? info[2] : 'var(--muted)';

  // バッジ・指名表示
  const badge = document.getElementById('fg-key-badge');
  badge.textContent = nextKey ? nextKey.toUpperCase() : '✓';
  badge.style.color = color;
  badge.style.borderColor = color;
  badge.style.background = nextKey ? color+'22' : 'transparent';

  document.getElementById('fg-finger-name').textContent = info ? info[1] : (nextKey ? '—' : '完成！');
  document.getElementById('fg-finger-name').style.color = color;
  document.getElementById('fg-finger-sub').textContent = info ? `「${nextKey.toUpperCase()}」キーを押す` : '';

  // ミニキーボード描画
  const kb = document.getElementById('mini-kb');
  kb.innerHTML = '';
  KB_ROWS.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'kb-row';
    row.forEach(k => {
      const kDiv = document.createElement('div');
      const kInfo = FINGER_MAP[k];
      kDiv.className = 'kb-key' + (k === nextKey ? ' next' : '');
      kDiv.textContent = k.toUpperCase();
      if(kInfo){
        kDiv.style.color = k === nextKey ? '#fff' : kInfo[2]+'88';
        kDiv.style.borderColor = k === nextKey ? kInfo[2] : kInfo[2]+'44';
        kDiv.style.background = k === nextKey ? kInfo[2]+'33' : 'transparent';
        if(k === nextKey) kDiv.style.setProperty('color', kInfo[2]);
      }
      rowDiv.appendChild(kDiv);
    });
    kb.appendChild(rowDiv);
  });
}

function renderCharBoxes(typed, word){
  const row = document.getElementById('char-row');
  row.innerHTML = '';
  for(let i=0;i<word.length;i++){
    const b = document.createElement('div');
    b.className = 'ch';
    b.style.position='relative';
    b.textContent = word[i];
    if(i < typed.length) b.classList.add(typed[i]===word[i]?'ok':'ng');
    else if(i===typed.length) b.classList.add('cur');
    row.appendChild(b);
  }
}

// ============================================================
// TYPING HANDLER — フリータイピング方式（ロック機能付き）
// ============================================================
document.getElementById('type-input').addEventListener('input', function(e){
  if(!gameActive){ e.target.value=''; return; }

  let typed = norm(e.target.value);
  if(typed.length === 0){
    lockedPlate = null; targetPlate = null;
    document.getElementById('char-row').innerHTML = '';
    document.getElementById('tgt-name').textContent = '— 見えるネタをタイピング！ —';
    return;
  }

  const visible = plates.filter(p => !p.done && p.x > -70);

  // ロック中の皿がまだ一致していればその皿だけ対象にする
  const pool = (lockedPlate && !lockedPlate.done && lockedPlate.word.startsWith(typed))
    ? [lockedPlate]
    : visible.filter(p => p.word.startsWith(typed));

  if(pool.length === 0){
    // どの皿にも一致しない → ミス
    typed = typed.slice(0, -1);
    e.target.value = typed;
    totalKeys++;
    combo = 0;
    document.getElementById('sv-combo').textContent = '0';
    playMissVoice();
    // ロック皿が1文字戻しても一致すれば維持、なければ解除して再検索
    if(lockedPlate && !lockedPlate.done && lockedPlate.word.startsWith(typed)){
      targetPlate = lockedPlate;
      renderTarget(lockedPlate.item, typed);
    } else {
      lockedPlate = null;
      const reMatches = typed.length > 0 ? visible.filter(p => p.word.startsWith(typed)) : [];
      if(reMatches.length > 0){
        const best = reMatches.sort((a,b) => a.x - b.x)[0];
        targetPlate = best;
        renderTarget(best.item, typed);
        if(reMatches.length === 1) lockedPlate = best;
      } else {
        targetPlate = null;
        document.getElementById('char-row').innerHTML = '';
        document.getElementById('tgt-name').textContent = '— 見えるネタをタイピング！ —';
      }
    }
    return;
  }

  playKeySound();
  totalKeys++;

  // 完全一致（ロック中なら必ずその皿、複数なら最も左）
  const exact = pool.filter(p => p.word === typed).sort((a,b) => a.x - b.x)[0];
  if(exact){
    this.classList.add('cfx');
    setTimeout(()=>this.classList.remove('cfx'), 300);
    this.value = '';
    lockedPlate = null; targetPlate = null;
    document.getElementById('char-row').innerHTML = '';
    document.getElementById('tgt-name').textContent = '…';
    plateSuccess(exact);
    return;
  }

  // 最も左（落下に近い）を表示ターゲットにする
  const best = pool.sort((a,b) => a.x - b.x)[0];
  targetPlate = best;
  renderTarget(best.item, typed);

  // 候補が1つに絞れたらロック
  lockedPlate = pool.length === 1 ? best : null;
});

// ============================================================
// QUIZ
// ============================================================
function triggerQuiz(){
  if(!gameActive) return;
  if(gamePaused) return; // ポーズ中はクイズを出さない
  fadeBgm(0.18, 200);
  // pause belt (タイマーは継続)
  cancelAnimationFrame(animFrame);

  // クイズ前に流れていた皿をすべて片付ける
  plates.forEach(p => p.el.remove());
  plates = [];
  targetPlate = null;
  lockedPlate = null;
  document.getElementById('type-input').value = '';
  document.getElementById('char-row').innerHTML = '';
  document.getElementById('tgt-name').textContent = '…';

  const unused = QUIZZES.filter(q=>!quizUsed.has(q.a));
  const q = unused.length ? unused[Math.floor(Math.random()*unused.length)] : QUIZZES[Math.floor(Math.random()*QUIZZES.length)];
  quizUsed.add(q.a);

  const card = document.getElementById('quiz-card');
  card.innerHTML = `
    <div class="quiz-badge">🍣 小休憩クイズ</div>
    <div class="quiz-q">${q.q}</div>
    <div class="quiz-hint">ヒント: ${q.hint}</div>
    <input class="quiz-input" id="quiz-inp" type="text" placeholder="ローマ字・ひらがな・漢字で入力..."
      autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
    <button class="quiz-submit" onclick="submitQuiz('${q.a}')">答えを送信</button>
    <button class="quiz-skip" onclick="skipQuiz()">スキップしてゲームに戻る</button>
  `;
  document.getElementById('quiz-overlay').classList.add('show');
  setTimeout(()=>{ const inp=document.getElementById('quiz-inp'); if(inp) inp.focus(); }, 100);
}

function submitQuiz(ans){
  const inp = document.getElementById('quiz-inp');
  if(!inp) return;
  const typed = norm(inp.value);
  const correct = norm(ans);
  const card = document.getElementById('quiz-card');

  // 日本語（ひらがな/カタカナ/漢字）入力でも正解判定
  const quizObj = QUIZZES.find(q => norm(q.a) === correct);
  const typedJP = normJP(inp.value);
  const matchesJP = !!(quizObj && quizObj.ja && quizObj.ja.some(j => normJP(j) === typedJP));

  if(typed === correct || matchesJP){
    // ランダムに3種類選んで選択肢として提示
    const choices = POWERUPS.slice().sort(()=>Math.random()-.5).slice(0,3);
    const cardsHTML = choices.map(pu=>`
      <div class="pu-card" onclick="activatePowerup('${pu.id}')">
        <div class="pu-card-icon">${pu.icon}</div>
        <div class="pu-card-name">${pu.name}</div>
        <div class="pu-card-desc">${pu.desc}</div>
      </div>
    `).join('');
    card.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result-icon">🎉</div>
        <div class="quiz-result-title" style="color:var(--green2);">正解！</div>
        <div class="quiz-result-desc" style="margin-bottom:16px;">パワーアップを1つ選んでください</div>
      </div>
      <div class="pu-cards">${cardsHTML}</div>
    `;
    playCorrectSound();
  } else {
    card.innerHTML = `
      <div class="quiz-result">
        <div class="quiz-result-icon">😢</div>
        <div class="quiz-result-title" style="color:var(--red2);">残念！</div>
        <div class="quiz-result-desc">正解は「${QUIZZES.find(q=>norm(q.a)===correct)?.display || ans}」でした</div>
      </div>
      <button class="quiz-submit" style="margin-top:16px;" onclick="skipQuiz()">ゲームに戻る</button>
    `;
  }
}

function activatePowerup(id){
  const pu = POWERUPS.find(p=>p.id===id);
  if(!pu) return;
  skipQuiz();
  _applyPowerup(id, pu.icon, pu.name, pu.desc || '', pu.duration, pu.color || '');
}

function activateGoldPowerup(goldItem){
  const g = goldItem;
  const durations = { time_extend:0, score_x3:20, slow:30, combo2:30, time_freeze:10 };
  const dur = durations[g.pu] || 20;
  _applyPowerup(g.pu, g.puIcon, g.puName, g.puDesc, dur, g.color);
}

function _applyPowerup(id, icon, name, desc, duration, color){
  // 時間延長は即時処理
  if(id === 'time_extend'){
    timeLeft = Math.min(timeLeft + 20, 99);
    document.getElementById('sv-timer').textContent = timeLeft;
    showGoldFX('⏱ +20秒！', '#F39C12');
    return;
  }
  // タイムフリーズ
  if(id === 'time_freeze'){
    timeFrozen = true;
    showGoldFX('❄️ 時間停止！', '#3498DB');
    const bar = document.getElementById('powerup-bar');
    bar.classList.add('active');
    document.getElementById('pu-icon').textContent = icon;
    document.getElementById('pu-label').textContent = name + ' 発動中！';
    let rem = duration;
    clearInterval(puInt);
    puInt = setInterval(()=>{
      rem--;
      document.getElementById('pu-timer-fill').style.width = (rem/duration*100)+'%';
      if(rem <= 0){
        clearInterval(puInt);
        timeFrozen = false;
        puActive = null;
        bar.classList.remove('active');
        document.getElementById('pu-icon').textContent='⬜';
        document.getElementById('pu-label').textContent='パワーアップなし　— 10ネタでクイズ出題';
        document.getElementById('pu-timer-fill').style.width='0%';
      }
    }, 1000);
    return;
  }

  puActive = { id, icon, name, duration };
  puEndTime = Date.now() + duration * 1000;
  if(id==='short') buildPool();

  showGoldFX(icon + ' ' + name + '！', color || '#F39C12');
  const bar = document.getElementById('powerup-bar');
  bar.classList.add('active');
  document.getElementById('pu-icon').textContent = icon;
  document.getElementById('pu-label').textContent = name + ' 発動中！';

  clearInterval(puInt);
  puInt = setInterval(()=>{
    const rem = puEndTime - Date.now();
    const pct = Math.max(0, rem/(duration*1000)*100);
    document.getElementById('pu-timer-fill').style.width = pct+'%';
    if(rem <= 0){
      clearInterval(puInt);
      puActive = null;
      bar.classList.remove('active');
      document.getElementById('pu-icon').textContent='⬜';
      document.getElementById('pu-label').textContent='パワーアップなし　— 10ネタでクイズ出題';
      document.getElementById('pu-timer-fill').style.width='0%';
      if(id==='short') buildPool();
    }
  }, 100);
}

function showGoldFX(text, color){
  const el = document.getElementById('combo-fx');
  if(!el) return;
  el.textContent = text;
  el.style.color = color || '#F39C12';
  el.style.textShadow = '0 0 24px '+color;
  el.style.transform = 'translate(-50%,-50%) scale(1)';
  el.style.opacity = '1';
  setTimeout(()=>{
    el.style.transform = 'translate(-50%,-50%) scale(0)';
    el.style.opacity = '0';
  }, 1200);
}

// 金ネタスポーン
function spawnGoldPlate(){
  if(!gameActive || gamePaused) return;
  if(goldPlate && !goldPlate.done) return; // 既に出てる

  const gItem = GOLD_ITEMS[Math.floor(Math.random()*GOLD_ITEMS.length)];
  const laneIdx = Math.floor(Math.random() * laneEls.length);
  const word = norm(gItem.r);

  const el = document.createElement('div');
  el.className = 'plate';
  el.style.left = '-90px';
  el.innerHTML = `
    <div class="plate-dish pc-sponsor" style="border-color:${gItem.color};box-shadow:0 0 18px 4px ${gItem.color}88;background:${gItem.color}22;">
      <div class="plate-emoji">${gItem.e}</div>
      <div class="plate-word" style="color:${gItem.color};">${word}</div>
      <div style="font-size:6px;color:${gItem.color};font-weight:700;margin-top:2px;">GOLD</div>
    </div>
    <div class="plate-name" style="color:${gItem.color};font-weight:700;">${gItem.n}</div>`;

  laneEls[laneIdx].appendChild(el);
  goldPlate = { laneIdx, item: gItem, el, x: -90, word, done: false, isGold: true };
  plates.push(goldPlate);

  // 次の金ネタ予約（25〜40秒後）
  const next = (25 + Math.random() * 15) * 1000;
  goldSpawnTimer = setTimeout(spawnGoldPlate, next);
}

function startGoldSpawnCycle(){
  clearTimeout(goldSpawnTimer);
  goldPlate = null;
  // 最初は15〜25秒後に出現
  const first = (15 + Math.random() * 10) * 1000;
  goldSpawnTimer = setTimeout(spawnGoldPlate, first);
}

// 罰ネタスポーン（金ネタと同じ見た目、⚠️マークだけ違う）
function spawnTrapPlate(){
  if(!gameActive || gamePaused) return;
  if(trapPlate && !trapPlate.done) return;

  const tItem = TRAP_ITEMS[Math.floor(Math.random()*TRAP_ITEMS.length)];
  const laneIdx = Math.floor(Math.random() * laneEls.length);
  const word = norm(tItem.r);
  const color = '#F39C12'; // 金ネタと同じ色で紛らわしく

  const el = document.createElement('div');
  el.className = 'plate';
  el.style.left = '-90px';
  el.innerHTML = `
    <div class="plate-dish pc-sponsor" style="border-color:${color};box-shadow:0 0 18px 4px ${color}88;background:${color}22;position:relative;">
      <div style="position:absolute;top:-6px;right:-6px;font-size:14px;line-height:1;z-index:10;">⚠️</div>
      <div class="plate-emoji">${tItem.e}</div>
      <div class="plate-word" style="color:${color};">${word}</div>
      <div style="font-size:6px;color:${color};font-weight:700;margin-top:2px;">GOLD</div>
    </div>
    <div class="plate-name" style="color:${color};font-weight:700;">${tItem.n}</div>`;

  laneEls[laneIdx].appendChild(el);
  trapPlate = { laneIdx, item: tItem, el, x: -90, word, done: false, isGold: true, isTrap: true };
  plates.push(trapPlate);

  // 次の罰ネタ（30〜50秒後）
  const next = (30 + Math.random() * 20) * 1000;
  trapSpawnTimer = setTimeout(spawnTrapPlate, next);
}

function startTrapSpawnCycle(){
  clearTimeout(trapSpawnTimer);
  trapPlate = null;
  // 最初は20〜35秒後
  const first = (20 + Math.random() * 15) * 1000;
  trapSpawnTimer = setTimeout(spawnTrapPlate, first);
}

function triggerTrap(trapId, desc){
  if(trapId === 'time_minus'){
    timeLeft = Math.max(0, timeLeft - 15);
    document.getElementById('sv-timer').textContent = timeLeft;
  } else if(trapId === 'combo_reset'){
    combo = 0;
    document.getElementById('sv-combo').textContent = '0';
  } else if(trapId === 'score_half'){
    score = Math.floor(score / 2);
    document.getElementById('sv-score').textContent = score.toLocaleString();
  }
  // 赤フラッシュ
  const el = document.getElementById('combo-fx');
  if(el){
    el.textContent = '⚠️ ' + desc;
    el.style.color = '#e74c3c';
    el.style.textShadow = '0 0 24px #e74c3c';
    el.style.transform = 'translate(-50%,-50%) scale(1)';
    el.style.opacity = '1';
    setTimeout(()=>{ el.style.transform='translate(-50%,-50%) scale(0)'; el.style.opacity='0'; }, 1500);
  }
  // 画面赤点滅
  document.body.style.background = 'rgba(200,0,0,0.15)';
  setTimeout(()=>{ document.body.style.background=''; }, 400);
}

function skipQuiz(){
  document.getElementById('quiz-overlay').classList.remove('show');
  if(!gameActive) return;
  if(gamePaused) return; // ポーズ中はそのまま
  fadeBgm(1.0, 250);
  // クイズ後は皿を改めてスタッガーつきで流す
  laneSpawnDelay = Array.from({length: laneEls.length}, (_, i) => i * 150);
  // 二重起動を防ぐため既存のループを必ずクリアしてから再開
  clearInterval(timerInt);
  cancelAnimationFrame(animFrame);
  timerInt = setInterval(tick, 1000);
  animFrame = requestAnimationFrame(gameLoop);
  const inp = document.getElementById('type-input');
  if(inp && !inp.disabled) inp.focus();
}

// ============================================================
// PAUSE
// ============================================================
let gamePaused = false;

function togglePause(){
  if(!gameActive) return;
  const btn = document.getElementById('btn-pause');
  const inp = document.getElementById('type-input');
  if(!gamePaused){
    gamePaused = true;
    cancelAnimationFrame(animFrame);
    clearInterval(timerInt);
    inp.disabled = true;
    btn.textContent = '▶ 再開';
    btn.style.borderColor = 'var(--gold)';
    btn.style.color = 'var(--gold)';
    bgmAudio.pause();
    showPauseOverlay();
  } else {
    gamePaused = false;
    inp.disabled = false;
    inp.focus();
    btn.textContent = '⏸ 一時停止';
    btn.style.borderColor = '';
    btn.style.color = '';
    hidePauseOverlay();
    if(soundOn){ bgmAudio.volume = BGM_VOL; bgmAudio.play().catch(()=>{}); }
    // 二重起動を防ぐため既存のループを必ずクリアしてから再開
    clearInterval(timerInt);
    cancelAnimationFrame(animFrame);
    timerInt = setInterval(tick, 1000);
    animFrame = requestAnimationFrame(gameLoop);
  }
}

function showPauseOverlay(){
  let ov = document.getElementById('pause-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'pause-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:150;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;backdrop-filter:blur(3px);';
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div style="font-family:'Bebas Neue',cursive;font-size:56px;letter-spacing:6px;color:var(--gold);">PAUSE</div>
    <div style="font-size:13px;color:var(--muted);">ESCキーまたはボタンで再開</div>
    <button onclick="togglePause()" style="background:var(--red);border:none;color:#fff;font-family:'Bebas Neue',cursive;font-size:20px;letter-spacing:3px;padding:12px 36px;border-radius:4px;cursor:pointer;margin-top:6px;">▶ 再開</button>
  `;
  ov.style.display = 'flex';
}

function hidePauseOverlay(){
  const ov = document.getElementById('pause-overlay');
  if(ov) ov.style.display = 'none';
}

// ESCキーでポーズ切替（クイズ表示中は無効）
document.addEventListener('keydown', function(e){
  if(e.code === 'Escape' && gameActive){
    const quizOv = document.getElementById('quiz-overlay');
    if(quizOv && quizOv.classList.contains('show')) return;
    togglePause();
  }
});

// ============================================================
// GAME FLOW
// ============================================================
function onClickStart(){
  // 初回 or リセット: 説明を出してからスタート / ゲーム中はそのままリセット
  if(!gameActive){
    document.getElementById('howto-overlay').style.display='flex';
  } else {
    startGame();
  }
}
function closeHowtoAndStart(){
  document.getElementById('howto-overlay').style.display='none';
  startGame();
}
function startGame(){
  document.getElementById('go-overlay').classList.remove('show');
  hidePauseOverlay();
  gamePaused = false;
  score=0; totalKeys=0; correctKeys=0; completedWords=0;
  combo=0; maxCombo=0; timeLeft=60; itemsSinceQuiz=0;
  quizUsed.clear(); plates=[]; targetPlate=null; puActive=null; clearInterval(puInt);
  timeFrozen=false; clearTimeout(goldSpawnTimer); goldPlate=null;
  clearTimeout(trapSpawnTimer); trapPlate=null;
  document.getElementById('pu-timer-fill').style.width='0%';
  document.getElementById('powerup-bar').classList.remove('active');
  document.getElementById('pu-icon').textContent='⬜';
  document.getElementById('pu-label').textContent='パワーアップなし　— 10ネタでクイズ出題';

  ['sv-score','sv-combo'].forEach(id=>document.getElementById(id).textContent='0');
  document.getElementById('sv-wpm').textContent='—';
  document.getElementById('sv-acc').textContent='—';
  document.getElementById('sv-timer').textContent='60';
  document.getElementById('sv-timer').classList.remove('urg');
  document.getElementById('btn-start').textContent='↺ RESET';

  // 停止ボタンを表示
  const pbtn = document.getElementById('btn-pause');
  pbtn.style.display = '';
  pbtn.textContent = '⏸ 一時停止';
  pbtn.style.borderColor = '';
  pbtn.style.color = '';

  SPEED = BASE_SPEEDS[diff];
  buildLanes();
  buildPool();
  laneWidth = (laneEls[0] && laneEls[0].offsetWidth > 0) ? laneEls[0].offsetWidth : 800;

  const inp = document.getElementById('type-input');
  inp.disabled=false; inp.value=''; inp.focus();
  inp.placeholder = lang==='en'?'— type here —':'タイピング開始...';

  gameActive=true;
  startTime=Date.now();
  clearInterval(timerInt); cancelAnimationFrame(animFrame);
  timerInt = setInterval(tick,1000);
  animFrame = requestAnimationFrame(gameLoop);
  startBgm();
  startGoldSpawnCycle();
  startTrapSpawnCycle();
}

function tick(){
  if(timeFrozen) return; // タイムフリーズ中はカウントしない
  timeLeft--;
  const tel = document.getElementById('sv-timer');
  tel.textContent = timeLeft;
  if(timeLeft<=10) tel.classList.add('urg');

  const elapsed = (Date.now()-startTime)/60000;
  const wpm = elapsed>0 ? Math.round((correctKeys/5)/elapsed) : 0;
  document.getElementById('sv-wpm').textContent = wpm;

  if(timeLeft<=0){
    clearInterval(timerInt); cancelAnimationFrame(animFrame);
    gameActive=false;
    endGame(wpm);
  }
}

function endGame(wpm){
  stopBgm();
  const inp=document.getElementById('type-input');
  inp.disabled=true; inp.value=''; inp.placeholder='— start typing —';
  document.getElementById('btn-start').textContent='▶ START';
  document.getElementById('btn-pause').style.display='none';
  gamePaused = false;

  const acc = totalKeys>0 ? Math.round((correctKeys/totalKeys)*100) : 0;
  const rank = RANKS.slice().reverse().find(r=>score>=r.min)||RANKS[0];

  document.getElementById('go-score').textContent = score.toLocaleString();
  document.getElementById('go-wpm').textContent   = wpm;
  document.getElementById('go-acc').textContent   = acc+'%';
  document.getElementById('go-count').textContent = completedWords;
  document.getElementById('go-rank').innerHTML    = `<span class="rank-badge">${rank.title}</span>${rank.msg}`;
  document.getElementById('go-sub').textContent   = completedWords>0 ? `${completedWords}ネタ完食！` : 'もう一度チャレンジ！';
  document.getElementById('go-overlay').classList.add('show');
  document.getElementById('sv-acc').textContent   = acc+'%';

  // leaderboard
  LB_DATA.push({ name:currentUser?currentUser.nickname:'あなた', score, wpm, acc:acc+'%' });
  LB_DATA.sort((a,b)=>b.score-a.score); LB_DATA.splice(10);
  renderLB();

  // save & badges
  saveScore(score, wpm, acc);
  const nb = checkBadges(score, wpm, acc, diff, maxCombo);
  if(nb.length) setTimeout(()=>showBadgePopup(nb), 900);
}

// ============================================================
// ============================================================
// じーも
// ============================================================
let jimoTimer = null;
let jimoCooldown = false;
let jimoMoveInterval = null;

function pauseGameForJimo(){
  if(!gameActive || gamePaused) return;
  cancelAnimationFrame(animFrame);
  clearInterval(timerInt);
  document.getElementById('type-input').disabled = true;
  fadeBgm(0.20, 300);
}

function resumeGameAfterJimo(){
  if(!gameActive) return;
  document.getElementById('type-input').disabled = false;
  document.getElementById('type-input').focus();
  clearInterval(timerInt);
  cancelAnimationFrame(animFrame);
  timerInt = setInterval(tick, 1000);
  animFrame = requestAnimationFrame(gameLoop);
  fadeBgm(1.0, 300);
}

function createSparks(container){
  const colors = ['#FFD700','#FF6B00','#FF3366','#00FFAA','#FFFFFF'];
  for(let i=0;i<20;i++){
    const s = document.createElement('div');
    s.className = 'spark';
    const angle = (i / 20) * 360;
    const dist = 100 + Math.random() * 200;
    const sx = Math.cos(angle * Math.PI / 180) * dist + 'px';
    const sy = Math.sin(angle * Math.PI / 180) * dist + 'px';
    s.style.cssText = `left:50%;top:50%;background:${colors[i%colors.length]};--sx:${sx};--sy:${sy};animation-delay:${Math.random()*0.3}s;`;
    container.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

function createConfetti(container){
  const colors = ['#FFD700','#FF6B00','#FF3366','#00FFAA','#4488FF','#FF88CC'];
  for(let i=0;i<40;i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.cssText = `
      left:${Math.random()*100}%;
      top:-20px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:${Math.random()>0.5?'50%':'2px'};
      width:${6+Math.random()*10}px;
      height:${6+Math.random()*10}px;
      animation-duration:${1.5+Math.random()*1.5}s;
      animation-delay:${Math.random()*0.5}s;
    `;
    container.appendChild(c);
    setTimeout(() => c.remove(), 3000);
  }
}

function spawnJimo(){
  const char = document.getElementById('jimo-char');
  if(char.style.display !== 'none') return;

  // ① レーン停止
  pauseGameForJimo();

  // ② 右からスライドで全画面登場
  const fs = document.getElementById('jimo-fullscreen');
  fs.style.display = 'flex';
  // スパーク生成
  const sparksEl = fs.querySelector('.jimo-sparks') || (() => {
    const el = document.createElement('div'); el.className='jimo-sparks'; fs.appendChild(el); return el;
  })();
  setTimeout(() => { fs.classList.add('show'); createSparks(sparksEl); playJimoSpawnSound(); }, 10);

  // ③ 2.5秒後に全画面を消して小じーもを配置
  setTimeout(() => {
    fs.classList.remove('show');
    setTimeout(() => {
      fs.style.display = 'none';

      const margin = 100;
      const label = document.getElementById('jimo-label');

      function placeJimo(){
        const x = margin + Math.random() * (window.innerWidth - margin * 2);
        const y = margin + Math.random() * (window.innerHeight - margin * 2);
        char.style.left = x + 'px';
        char.style.top = y + 'px';
        label.style.left = (x - 10) + 'px';
        label.style.top = (y + 68) + 'px';
      }

      placeJimo();
      char.style.display = 'block';
      label.style.display = 'block';
      playJimoAppearSound();

      // ランダムに逃げ回る（0.6〜1.2秒ごとに移動）
      function scheduleNextMove(){
        jimoMoveInterval = setTimeout(() => {
          if(char.style.display === 'none') return;
          placeJimo();
          scheduleNextMove();
        }, 600 + Math.random() * 600);
      }
      scheduleNextMove();

      // 5秒以内に捕まえないと逃げる
      jimoTimer = setTimeout(() => dismissJimo(true), 5000);
    }, 400);
  }, 2500);
}

function catchJimo(){
  clearTimeout(jimoTimer);
  clearTimeout(jimoMoveInterval); jimoMoveInterval = null;
  playJimoCatchSound();

  // 小じーもを隠す
  document.getElementById('jimo-char').style.display = 'none';
  document.getElementById('jimo-label').style.display = 'none';

  // ボーナス計算
  const bonus = Math.max(3000, Math.round(score * 0.5));
  score += bonus;
  document.getElementById('sv-score').textContent = score.toLocaleString();

  // ④ 全画面お祝い演出（下からスライドアップ）
  const cel = document.getElementById('jimo-celebrate');
  document.getElementById('cel-bonus-text').textContent = '＋' + bonus.toLocaleString() + '点ボーナス！';
  cel.style.display = 'flex';
  setTimeout(() => { cel.classList.add('show'); createConfetti(cel); createSparks(cel); }, 10);

  // ⑤ 2秒後にゲーム再開
  setTimeout(() => {
    cel.classList.remove('show');
    setTimeout(() => {
      cel.style.display = 'none';
      resumeGameAfterJimo();
      // クールダウン開始
      jimoCooldown = true;
      setTimeout(() => { jimoCooldown = false; }, 10000);
    }, 300);
  }, 2000);
}

function dismissJimo(escaped = false){
  clearTimeout(jimoMoveInterval); jimoMoveInterval = null;
  document.getElementById('jimo-char').style.display = 'none';
  document.getElementById('jimo-label').style.display = 'none';
  if(escaped) playJimoDismissSound();
  resumeGameAfterJimo(); // 逃げた場合もゲームを再開する
  jimoCooldown = true;
  setTimeout(() => { jimoCooldown = false; }, 10000);
}

// DIFF / LANG
// ============================================================
function setDiff(d,btn){
  // たまごはチュートリアル画面を開く（ベルトゲームは変更しない）
  if(d==='beginner'){ openTutorial(); return; }
  diff=d;
  document.querySelectorAll('[id^=diff-]').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
  document.getElementById('belt-label').textContent='SPEED: '+{easy:'見習い',normal:'板前',hard:'板長'}[d];
  document.getElementById('finger-guide').classList.remove('show');
  if(!gameActive) buildLanes();
}
function setLang(l,btn){
  lang=l;
  document.querySelectorAll('#lang-row .mode-btn').forEach(b=>b.classList.remove('act'));
  btn.classList.add('act');
}

// ============================================================
// SOUND
// ============================================================
let audioCtx=null;
function getCtx(){ if(!audioCtx) audioCtx=new(window.AudioContext||window.webkitAudioContext)(); return audioCtx; }

function playKeySound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), buf=ctx.createBuffer(1,ctx.sampleRate*.04,ctx.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(ctx.sampleRate*.008));
    const s=ctx.createBufferSource(), g=ctx.createGain(); s.buffer=buf; g.gain.value=.15;
    s.connect(g); g.connect(ctx.destination); s.start();
  }catch(e){}
}
function playCorrectSound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), now=ctx.currentTime;
    [[880,0],[1108,.04]].forEach(([f,d])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='sine'; o.frequency.setValueAtTime(f,now+d); o.frequency.exponentialRampToValueAtTime(f*1.5,now+d+.12);
      g.gain.setValueAtTime(.2,now+d); g.gain.exponentialRampToValueAtTime(.001,now+d+.22);
      o.connect(g); g.connect(ctx.destination); o.start(now+d); o.stop(now+d+.25);
    });
  }catch(e){}
}
function playComboSound(n){
  if(!soundOn) return;
  try{
    const ctx=getCtx(),now=ctx.currentTime,bf=440*Math.pow(1.06,Math.min(n,12));
    [0,.08,.16].forEach((d,i)=>{
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type='triangle'; o.frequency.value=bf*[1,1.25,1.5][i];
      g.gain.setValueAtTime(.18,now+d); g.gain.exponentialRampToValueAtTime(.001,now+d+.3);
      o.connect(g); g.connect(ctx.destination); o.start(now+d); o.stop(now+d+.32);
    });
  }catch(e){}
}

const MISS_V=['なしか！','なんしよっと！','ちゃんとせんか！','まけるな！','ちがうばい！','しっかりせんか！'];
const OK_V  =['よかよか！','さすがばい！','うまかねー！','ばりうまい！','その調子たい！','ナイスたい！'];
let lastMissT=0, missVI=0, okVI=0;
function playMissVoice(){
  if(!soundOn) return;
  const now=Date.now(); if(now-lastMissT<1000) return; lastMissT=now;
  try{
    const u=new SpeechSynthesisUtterance(MISS_V[missVI++%MISS_V.length]);
    u.lang='ja-JP'; u.rate=1.1; u.pitch=1.0; u.volume=.9;
    const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('ja')); if(v) u.voice=v;
    speechSynthesis.speak(u);
  }catch(e){}
}
function playCorrectVoice(){
  if(!soundOn) return;
  if(okVI%3!==0){ okVI++; return; }
  try{
    const u=new SpeechSynthesisUtterance(OK_V[okVI++%OK_V.length]);
    u.lang='ja-JP'; u.rate=1.15; u.pitch=1.2; u.volume=.85;
    const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('ja')); if(v) u.voice=v;
    speechSynthesis.speak(u);
  }catch(e){ okVI++; }
}
function toggleSound(btn){
  soundOn=!soundOn;
  btn.textContent=soundOn?'🔊 音あり':'🔇 音なし';
  btn.style.color=soundOn?'var(--gold)':'';
  bgmAudio.volume = soundOn ? BGM_VOL : 0;
}

// ============================================================
// BGM ENGINE — bgm.mp3
// ============================================================
const BGM_VOL = 0.20; // 通常音量 (0〜1)

const bgmAudio = new Audio('bgm.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0;

let bgmFadeTimer = null;

function startBgm(){
  if(!soundOn){ bgmAudio.volume = 0; }
  else { bgmAudio.volume = BGM_VOL; }
  bgmAudio.currentTime = 0;
  bgmAudio.play().catch(()=>{});
}

function stopBgm(){
  fadeBgm(0, 400);
  setTimeout(()=>{ bgmAudio.pause(); bgmAudio.currentTime = 0; }, 450);
}

function fadeBgm(ratio, ms){
  clearInterval(bgmFadeTimer);
  if(!soundOn && ratio > 0) return;
  const target = ratio * BGM_VOL;
  const steps = 20;
  const interval = (ms || 250) / steps;
  const start = bgmAudio.volume;
  const delta = (target - start) / steps;
  let i = 0;
  bgmFadeTimer = setInterval(()=>{
    i++;
    bgmAudio.volume = Math.min(1, Math.max(0, start + delta * i));
    if(i >= steps){ clearInterval(bgmFadeTimer); bgmAudio.volume = target; }
  }, interval);
}

// ============================================================
// じーもSE
// ============================================================

// ① 全画面登場：ドラマチックな上昇アルペジオ＋シンバル
function playJimoSpawnSound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), now=ctx.currentTime;
    // 上昇アルペジオ (C→E→G→C5→E5)
    [[261,0],[329,0.07],[392,0.14],[523,0.21],[659,0.28]].forEach(([f,d])=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='square'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.18, now+d);
      g.gain.exponentialRampToValueAtTime(0.001, now+d+0.35);
      o.start(now+d); o.stop(now+d+0.35);
    });
    // シンバルクラッシュ
    const len=Math.ceil(ctx.sampleRate*0.55);
    const buf=ctx.createBuffer(1,len,ctx.sampleRate), nd=buf.getChannelData(0);
    for(let i=0;i<len;i++) nd[i]=(Math.random()*2-1)*Math.pow(1-i/len,0.5);
    const src=ctx.createBufferSource(), gn=ctx.createGain(), flt=ctx.createBiquadFilter();
    flt.type='bandpass'; flt.frequency.value=2800; flt.Q.value=0.4;
    src.buffer=buf; src.connect(flt); flt.connect(gn); gn.connect(ctx.destination);
    gn.gain.setValueAtTime(0.38, now);
    gn.gain.exponentialRampToValueAtTime(0.001, now+0.55);
    src.start(now);
  }catch(e){}
}

// ② 小じーも出現：キラキラ魔法音＋ポヨン
function playJimoAppearSound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), now=ctx.currentTime;
    // 上昇キラキラ
    [784,1046,1318,1568,2093].forEach((f,i)=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='sine'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination);
      const t=now+i*0.058;
      g.gain.setValueAtTime(0.16, t);
      g.gain.exponentialRampToValueAtTime(0.001, t+0.20);
      o.start(t); o.stop(t+0.20);
    });
    // ポヨン
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='sine';
    o2.frequency.setValueAtTime(180, now);
    o2.frequency.exponentialRampToValueAtTime(760, now+0.06);
    o2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.28, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now+0.18);
    o2.start(now); o2.stop(now+0.18);
  }catch(e){}
}

// ③ 捕まえた：勝利ファンファーレ (タタタターン！)
function playJimoCatchSound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), now=ctx.currentTime;
    // メロディ：タタタターン
    [[523,0,0.11],[523,0.12,0.09],[523,0.22,0.09],[659,0.33,0.55]].forEach(([f,d,dur])=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='square'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.20, now+d);
      g.gain.exponentialRampToValueAtTime(0.001, now+d+dur);
      o.start(now+d); o.stop(now+d+dur);
    });
    // ハーモニー
    [[659,0,0.11],[659,0.12,0.09],[659,0.22,0.09],[784,0.33,0.55]].forEach(([f,d,dur])=>{
      const o=ctx.createOscillator(), g=ctx.createGain();
      o.type='square'; o.frequency.value=f;
      o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.13, now+d);
      g.gain.exponentialRampToValueAtTime(0.001, now+d+dur);
      o.start(now+d); o.stop(now+d+dur);
    });
    // ベル持続音
    const ob=ctx.createOscillator(), gb=ctx.createGain();
    ob.type='sine'; ob.frequency.value=1318;
    ob.connect(gb); gb.connect(ctx.destination);
    gb.gain.setValueAtTime(0.22, now+0.33);
    gb.gain.exponentialRampToValueAtTime(0.001, now+1.3);
    ob.start(now+0.33); ob.stop(now+1.3);
    // クラッシュ
    const len=Math.ceil(ctx.sampleRate*0.45);
    const buf2=ctx.createBuffer(1,len,ctx.sampleRate), nd2=buf2.getChannelData(0);
    for(let i=0;i<len;i++) nd2[i]=(Math.random()*2-1)*Math.pow(1-i/len,0.45);
    const src2=ctx.createBufferSource(), gn2=ctx.createGain(), flt2=ctx.createBiquadFilter();
    flt2.type='bandpass'; flt2.frequency.value=3200; flt2.Q.value=0.3;
    src2.buffer=buf2; src2.connect(flt2); flt2.connect(gn2); gn2.connect(ctx.destination);
    gn2.gain.setValueAtTime(0.42, now+0.33);
    gn2.gain.exponentialRampToValueAtTime(0.001, now+0.33+0.45);
    src2.start(now+0.33);
  }catch(e){}
}

// ④ 逃げた：ワーワー下降（トロンボーン風）
function playJimoDismissSound(){
  if(!soundOn) return;
  try{
    const ctx=getCtx(), now=ctx.currentTime;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sawtooth';
    o.frequency.setValueAtTime(440, now);
    o.frequency.exponentialRampToValueAtTime(196, now+0.28);
    o.frequency.setValueAtTime(350, now+0.33);
    o.frequency.exponentialRampToValueAtTime(155, now+0.62);
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.20, now);
    g.gain.setValueAtTime(0.18, now+0.28);
    g.gain.setValueAtTime(0.16, now+0.33);
    g.gain.exponentialRampToValueAtTime(0.001, now+0.68);
    o.start(now); o.stop(now+0.68);
    // 低音ドン
    const o2=ctx.createOscillator(), g2=ctx.createGain();
    o2.type='sine'; o2.frequency.value=75;
    o2.connect(g2); g2.connect(ctx.destination);
    g2.gain.setValueAtTime(0.32, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now+0.35);
    o2.start(now); o2.stop(now+0.35);
  }catch(e){}
}

// ============================================================
// FX
// ============================================================
function flashStat(id){ const el=document.getElementById(id); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),400); }
function showComboFx(n){ const el=document.getElementById('combo-fx'); el.textContent=n+' COMBO!'; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }

// ============================================================
// BADGES
// ============================================================
function getBD(){ if(!currentUser) return {earned:[],totalScore:0,bestWpm:0}; return JSON.parse(localStorage.getItem('ktd_badges_'+currentUser.id)||'{"earned":[],"totalScore":0,"bestWpm":0}'); }
function saveBD(d){ if(!currentUser) return; localStorage.setItem('ktd_badges_'+currentUser.id,JSON.stringify(d)); }
function checkBadges(s,wpm,acc,d,mc){
  if(!currentUser) return [];
  const data=getBD();
  data.totalScore=(data.totalScore||0)+s;
  data.bestWpm=Math.max(data.bestWpm||0,wpm);
  const got=[];
  BADGES.forEach(b=>{
    if(data.earned.includes(b.id)) return;
    let ok=false;
    if(b.axis==='score') ok=data.totalScore>=b.th;
    if(b.axis==='wpm')   ok=data.bestWpm>=b.th;
    if(b.axis==='combo') ok=mc>=b.th;
    if(b.axis==='acc')   ok=acc>=b.th;
    if(b.axis==='diff')  ok=d==='hard';
    if(b.axis==='all')   ok=data.earned.length>=BADGES.length-1;
    if(ok){ data.earned.push(b.id); got.push(b); }
  });
  saveBD(data); return got;
}
function showBadgePopup(badges){
  if(!badges.length) return;
  const b=badges[0];
  const p=document.createElement('div'); p.className='badge-popup';
  p.innerHTML=`<div style="font-size:10px;color:var(--gold);letter-spacing:2px;margin-bottom:5px;">★ バッジ獲得！</div><div style="font-size:32px;margin-bottom:5px;">${b.e}</div><div style="font-size:14px;font-weight:700;">${b.name}</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">${b.cond}</div>`;
  document.body.appendChild(p);
  setTimeout(()=>{ p.style.animation='bpOut .4s ease-in forwards'; setTimeout(()=>{ p.remove(); if(badges.length>1) showBadgePopup(badges.slice(1)); },400); },2200);
}

// ============================================================
// USER / MYPAGE
// ============================================================
// SUPABASE
// ============================================================
const SUPABASE_URL = 'https://wfzosqiulaaknjaydywf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmem9zcWl1bGFha25qYXlkeXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNDYzMDQsImV4cCI6MjA5MjcyMjMwNH0.4kVINp8j5ZiSj7Xvh_BpCG_rfefarMY9i96tLHxWh4A';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// USER
// ============================================================
let currentUser=null;
function loadUser(){ try{ currentUser=JSON.parse(localStorage.getItem('ktd_user')); }catch(e){} updateUserBtn(); }
function updateUserBtn(){ const b=document.getElementById('user-btn'); if(!b) return; b.textContent=currentUser?'👤 '+currentUser.nickname:'登録/ログイン'; b.style.color=currentUser?'var(--gold)':''; }

function selWard(btn,w){ document.querySelectorAll('.ward-btn').forEach(b=>b.classList.remove('sel')); btn.classList.add('sel'); document.getElementById('reg-ward').value=w; }

async function submitReg(){
  const nn=document.getElementById('reg-nn').value.trim();
  const gr=document.getElementById('reg-grade').value;
  const wd=document.getElementById('reg-ward').value;
  if(!nn){ alert('ニックネームを入力してください'); return; }

  // Supabaseに登録（ニックネームが重複していればそのまま取得）
  let player;
  const { data: existing } = await sb.from('players').select('*').eq('nickname', nn).single();
  if(existing){
    player = existing;
  } else {
    const { data, error } = await sb.from('players').insert({ nickname: nn }).select().single();
    if(error){ alert('登録エラー: '+error.message); return; }
    player = data;
  }

  const u = { id: player.id, nickname: nn, grade: gr, ward: wd, joinedAt: new Date().toLocaleDateString('ja-JP') };
  currentUser = u;
  localStorage.setItem('ktd_user', JSON.stringify(u));
  updateUserBtn();
  closeModal('modal-reg');
  alert('登録完了！ようこそ、'+nn+'さん！');
}

async function saveScore(s,wpm,acc){
  if(!currentUser) return;
  // Supabaseに保存
  await sb.from('scores').insert({ player_id: currentUser.id, score: s, wpm: wpm });
  // ローカルにもキャッシュ
  const key='ktd_scores_'+currentUser.id;
  const sc=JSON.parse(localStorage.getItem(key)||'[]');
  sc.unshift({score:s,wpm,acc,date:new Date().toLocaleDateString('ja-JP')});
  if(sc.length>20) sc.splice(20);
  localStorage.setItem(key,JSON.stringify(sc));
}

function getScores(){ if(!currentUser) return []; return JSON.parse(localStorage.getItem('ktd_scores_'+currentUser.id)||'[]'); }

function showMypage(){
  if(!currentUser){ showModal('modal-reg'); return; }
  const sc=getScores();
  const best=sc.length?Math.max(...sc.map(s=>s.score)):0;
  const bwpm=sc.length?Math.max(...sc.map(s=>s.wpm)):0;
  document.getElementById('my-name').textContent=currentUser.nickname;
  document.getElementById('my-ward').textContent=currentUser.ward+' / '+currentUser.grade;
  document.getElementById('my-score').textContent=best.toLocaleString();
  document.getElementById('my-wpm').textContent=bwpm;
  document.getElementById('my-plays').textContent=sc.length;
  const bd=getBD();
  document.getElementById('my-badge-ct').textContent=bd.earned.length+' / '+BADGES.length;
  document.getElementById('my-badge-grid').innerHTML=BADGES.map(b=>{
    const has=bd.earned.includes(b.id);
    return `<div class="bg-item${has?' earned':''}" title="${b.name}｜${b.cond}"><div class="bg-item-e">${b.e}</div><div class="bg-item-n">${b.name}</div></div>`;
  }).join('');
  showModal('modal-my');
}

function logoutUser(){ localStorage.removeItem('ktd_user'); currentUser=null; updateUserBtn(); closeModal('modal-my'); }

function showModal(id){ document.getElementById(id).classList.add('show'); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }

// ============================================================
// LEADERBOARD / UI
// ============================================================
function renderLB(){
  document.getElementById('lb-list').innerHTML=LB_DATA.slice(0,10).map((d,i)=>{
    const rc=i===0?'g':i===1?'s':i===2?'b':'';
    const ri=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
    return `<div class="lb-row"><div class="lb-rank ${rc}">${ri}</div><div class="lb-name">${d.name}</div><div class="lb-score">${d.score.toLocaleString()}</div><div class="lb-wpm">${d.wpm}</div><div class="lb-acc">${d.acc}</div></div>`;
  }).join('');
}
function switchView(v,btn){ document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('act')); btn.classList.add('act'); if(v==='rank') showRanking(); }
async function showRanking(){
  document.getElementById('lb-section').scrollIntoView({behavior:'smooth'});
  // Supabaseから上位10件取得
  const { data, error } = await sb
    .from('scores')
    .select('score, wpm, created_at, players(nickname)')
    .order('score', { ascending: false })
    .limit(10);
  if(error || !data) return;
  document.getElementById('lb-list').innerHTML = data.map((d,i)=>{
    const rc=i===0?'g':i===1?'s':i===2?'b':'';
    const ri=i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1);
    const name = d.players?.nickname || '名無し';
    const acc = '-';
    return `<div class="lb-row"><div class="lb-rank ${rc}">${ri}</div><div class="lb-name">${name}</div><div class="lb-score">${d.score.toLocaleString()}</div><div class="lb-wpm">${d.wpm}</div><div class="lb-acc">${acc}</div></div>`;
  }).join('');
}
function showTournament(){ alert('🎌 鮨撃 区対抗タイピング大会 2025\n\n日時: 2025年開催予定\n会場: 門司港レトロ会館\n参加費: ¥500\n\n各区・学年の1位が代表として出場！\n\nお問い合わせ: 門司港プログラミング道場'); }
function shareResult(){
  const txt=`🍣 鮨撃 KITAKYUSHU\nスコア: ${score.toLocaleString()}点 | WPM: ${document.getElementById('go-wpm').textContent} | 正確度: ${document.getElementById('go-acc').textContent}\n\n#鮨撃 #KITAKYUSHU #寿司の都 #北九州`;
  navigator.clipboard?navigator.clipboard.writeText(txt).then(()=>alert('コピーしました！')):alert(txt);
}

// ============================================================
// INIT
// ============================================================
loadUser();
renderLB();
buildLanes();

// ============================================================
// たまごモード チュートリアル
// ============================================================
const TUTORIAL_STAGES = [
  {
    id:1, name:'ホームポジション（左手）', desc:'A・S・D・F キーの練習',
    type:'keys',
    seq:['a','a','a','s','s','s','d','d','d','f','f','f','a','s','d','f','f','d','s','a'],
  },
  {
    id:2, name:'ホームポジション（右手）', desc:'J・K・L・P キーの練習',
    type:'keys',
    seq:['j','j','j','k','k','k','l','l','l','p','p','p','j','k','l','p','p','l','k','j'],
  },
  {
    id:3, name:'母音を覚えよう', desc:'A・I・U・E・O',
    type:'keys',
    seq:['a','i','u','e','o','a','i','u','e','o','o','e','u','i','a'],
  },
  {
    id:4, name:'かんたんなネタを打とう', desc:'ika・ebi・uni・tai・aji・toro・kani',
    type:'words',
    words:['ika','ebi','uni','tai','aji','toro','kani','fugu','nori','buri'],
  },
];

let tutIdx=0, tutStep=0, tutWordIdx=0, tutTyped='';
let tutKeyHandlerFn=null;

function openTutorial(){
  document.getElementById('tutorial-overlay').classList.add('show');
  tutIdx=0; tutStep=0; tutWordIdx=0; tutTyped='';
  startTutStage(0);
  if(tutKeyHandlerFn) document.removeEventListener('keydown', tutKeyHandlerFn);
  tutKeyHandlerFn = function(e){
    if(!document.getElementById('tutorial-overlay').classList.contains('show')) return;
    if(e.key==='Escape'){ closeTutorial(); return; }
    const k=e.key.toLowerCase();
    if(k.length!==1||!/[a-z]/.test(k)) return;
    e.preventDefault();
    const stage=TUTORIAL_STAGES[tutIdx];
    if(stage.type==='words') handleTutWordKey(k);
    else handleTutKey(k);
  };
  document.addEventListener('keydown', tutKeyHandlerFn);
}

function closeTutorial(){
  document.getElementById('tutorial-overlay').classList.remove('show');
  if(tutKeyHandlerFn){ document.removeEventListener('keydown', tutKeyHandlerFn); tutKeyHandlerFn=null; }
}

function startTutStage(idx){
  tutIdx=idx; tutStep=0; tutWordIdx=0; tutTyped='';
  const st=TUTORIAL_STAGES[idx];
  document.getElementById('tut-stage-name').textContent=`ステージ ${idx+1} / ${TUTORIAL_STAGES.length} — ${st.name}`;
  document.getElementById('tut-stage-clear-msg').style.display='none';
  document.getElementById('tut-stage-clear-msg').className='';
  document.getElementById('tut-next-btn').style.display='none';
  updateTutProgress();
  if(st.type==='words') showTutWord(); else showTutKey();
}

function updateTutProgress(){
  const st=TUTORIAL_STAGES[tutIdx];
  const total=st.type==='words'?st.words.length:st.seq.length;
  const cur=st.type==='words'?tutWordIdx:tutStep;
  document.getElementById('tut-progress-fill').style.width=(cur/total*100)+'%';
  document.getElementById('tut-progress-nums').textContent=cur+' / '+total;
}

function showTutKey(){
  const st=TUTORIAL_STAGES[tutIdx];
  if(tutStep>=st.seq.length){ tutStageClear(); return; }
  const k=st.seq[tutStep];
  const info=FINGER_MAP[k];
  const color=info?info[2]:'#aaa';
  const lbl=document.getElementById('tut-key-label');
  lbl.textContent=k.toUpperCase();
  lbl.style.color=color; lbl.style.borderColor=color;
  lbl.style.background=color+'18'; lbl.style.boxShadow='0 0 24px '+color+'44';
  document.getElementById('tut-key-sub').textContent=k.toUpperCase()+' を押してください';
  document.getElementById('tut-char-row').innerHTML='';
  highlightFinger(info?info[0]:-1);
  renderTutMiniKb(k);
}

function showTutWord(){
  const st=TUTORIAL_STAGES[tutIdx];
  if(tutWordIdx>=st.words.length){ tutStageClear(); return; }
  const word=st.words[tutWordIdx]; tutTyped='';
  const firstInfo=FINGER_MAP[word[0]];
  const color=firstInfo?firstInfo[2]:'#aaa';
  const lbl=document.getElementById('tut-key-label');
  lbl.textContent=word.toUpperCase();
  lbl.style.color=color; lbl.style.borderColor=color;
  lbl.style.background=color+'18'; lbl.style.boxShadow='0 0 24px '+color+'44';
  lbl.style.fontSize=word.length>4?'38px':'50px';
  document.getElementById('tut-key-sub').textContent='タイプしてください';
  renderTutChars('',word);
  highlightFinger(firstInfo?firstInfo[0]:-1);
  renderTutMiniKb(word[0]);
}

function renderTutChars(typed,word){
  const row=document.getElementById('tut-char-row');
  row.innerHTML='';
  for(let i=0;i<word.length;i++){
    const b=document.createElement('div');
    b.className='ch'; b.style.position='relative'; b.textContent=word[i].toUpperCase();
    if(i<typed.length) b.classList.add('ok');
    else if(i===typed.length) b.classList.add('cur');
    row.appendChild(b);
  }
}

function highlightFinger(fingerIdx){
  document.querySelectorAll('.hand-finger').forEach(f=>f.classList.remove('lit'));
  if(fingerIdx<0) return;
  const id=fingerIdx<=3?'lf-'+fingerIdx:'rf-'+fingerIdx;
  const el=document.getElementById(id);
  if(el) el.classList.add('lit');
}

function renderTutMiniKb(nextKey){
  const kb=document.getElementById('tut-mini-kb');
  kb.innerHTML='';
  KB_ROWS.forEach(row=>{
    const rd=document.createElement('div'); rd.className='tut-kb-row';
    row.forEach(k=>{
      const kd=document.createElement('div');
      const kinfo=FINGER_MAP[k];
      const isNext=k===nextKey;
      kd.className='tut-kb-key'+(isNext?' tut-next-key':'');
      kd.textContent=k.toUpperCase();
      if(kinfo){
        kd.style.color=isNext?'#fff':kinfo[2]+'77';
        kd.style.borderColor=isNext?kinfo[2]:kinfo[2]+'33';
        kd.style.background=isNext?kinfo[2]+'33':'transparent';
        if(isNext) kd.style.setProperty('color',kinfo[2]);
      }
      rd.appendChild(kd);
    });
    kb.appendChild(rd);
  });
}

function handleTutKey(k){
  const st=TUTORIAL_STAGES[tutIdx];
  const expected=st.seq[tutStep];
  if(k===expected){
    const lbl=document.getElementById('tut-key-label');
    lbl.classList.add('tut-hit'); setTimeout(()=>lbl.classList.remove('tut-hit'),150);
    playKeySound();
    tutStep++;
    updateTutProgress();
    if(tutStep>=st.seq.length){ tutStageClear(); return; }
    showTutKey();
  } else {
    const lbl=document.getElementById('tut-key-label');
    lbl.classList.remove('tut-miss'); void lbl.offsetWidth; lbl.classList.add('tut-miss');
    setTimeout(()=>lbl.classList.remove('tut-miss'),300);
    playMissVoice();
  }
}

// Word key handler (stage 4) — keydown ベース、IME不使用
function handleTutWordKey(k){
  const st=TUTORIAL_STAGES[tutIdx];
  const word=st.words[tutWordIdx];
  const pos=tutTyped.length;
  if(k!==word[pos]){
    const lbl=document.getElementById('tut-key-label');
    lbl.classList.remove('tut-miss'); void lbl.offsetWidth; lbl.classList.add('tut-miss');
    setTimeout(()=>lbl.classList.remove('tut-miss'),300);
    playMissVoice();
    return;
  }
  playKeySound();
  tutTyped+=k;
  renderTutChars(tutTyped, word);
  if(tutTyped.length<word.length){
    const nk=word[tutTyped.length];
    const ni=FINGER_MAP[nk];
    highlightFinger(ni?ni[0]:-1);
    renderTutMiniKb(nk);
    const lbl=document.getElementById('tut-key-label');
    const color=ni?ni[2]:'#aaa';
    lbl.style.color=color; lbl.style.borderColor=color; lbl.style.boxShadow='0 0 24px '+color+'44';
  }
  if(tutTyped===word){
    tutWordIdx++;
    updateTutProgress();
    setTimeout(()=>{ if(tutWordIdx>=st.words.length){tutStageClear();return;} showTutWord(); },200);
  }
}

function tutStageClear(){
  highlightFinger(-1);
  const msg=document.getElementById('tut-stage-clear-msg');
  msg.style.display='block';
  if(tutIdx<TUTORIAL_STAGES.length-1){
    msg.className=''; msg.textContent='🎉 ステージ '+(tutIdx+1)+' クリア！';
    playCorrectSound();
    setTimeout(()=>{ msg.style.display='none'; startTutStage(tutIdx+1); }, 1600);
  } else {
    msg.className='final';
    msg.innerHTML='🏆 チュートリアル完了！<br><span style="font-size:16px;color:var(--muted);">見習いモードに挑戦しよう！</span>';
    document.getElementById('tut-next-btn').style.display='';
    playComboSound(5);
  }
}

function tutGoToEasy(){
  closeTutorial();
  setDiff('easy', document.getElementById('diff-easy'));
}
