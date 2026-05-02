# しのざきアプリ開発ガイド
## 「一言指示でプロトタイプまで作る」ための設計書

---

## 🎯 このガイドの使い方

Claudeに「〇〇アプリ作って」と指示する前に、このガイドをプロジェクトのインストラクションに貼っておく。
Claudeは毎回このガイドを前提に動く。

---

## 📐 デザイン・スタイル原則（鮨撃から抽出）

### カラーパレット（門司港テイスト）
```css
:root {
  /* ベース */
  --dark:  #08101E;  /* 深夜の関門海峡 */
  --dark2: #0E1A30;
  --dark3: #142240;
  --dark4: #1C2E50;
  
  /* アクセント */
  --gold:  #C89020;  /* 港の灯り */
  --gold2: #DBA828;
  --red:   #A03020;  /* 赤レンガ */
  --red2:  #C03C28;
  
  /* テキスト */
  --text:  #EDE8DA;  /* 古紙の白 */
  --muted: #6888A8;
  
  /* 機能色 */
  --green: #27AE60;
  --cyan:  #1A78A8;
}
```

### フォント構成（必須）
```html
<link href="https://fonts.googleapis.com/css2?
  family=Noto+Sans+JP:wght@400;700;900&
  family=Bebas+Neue&
  family=IBM+Plex+Mono:wght@400;700&
  family=Shippori+Mincho+B1:wght@700;800
  &display=swap" rel="stylesheet">
```
- **タイトル・ロゴ**: Shippori Mincho B1（和の格調）
- **英数字・スコア表示**: Bebas Neue（インパクト）
- **コード・タイプ表示**: IBM Plex Mono（テック感）
- **本文**: Noto Sans JP

### 背景の作り方（必ず立体感を出す）
```css
body {
  background: linear-gradient(160deg, #08101E 0%, #0C1828 35%, #0A1430 65%, #060E20 100%);
}
/* グリッド線（海面・工場感） */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(14,60,120,0.13) 59px, rgba(14,60,120,0.13) 60px),
    repeating-linear-gradient(176deg, transparent, transparent 179px, rgba(14,60,120,0.07) 179px, rgba(14,60,120,0.07) 180px);
  pointer-events: none;
  z-index: 0;
}
```

---

## 🏗️ アプリの基本構造（共通テンプレート）

```
index.html
├── ヘッダー（ロゴ + ナビ）
├── ゲームエリア（メインコンテンツ）
├── スコア・ステータスバー
├── アクションボタン（START/RESET）
├── ゲームオーバーオーバーレイ
└── ランキング（Supabase連携）
```

### HTML骨格
```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>アプリ名</title>
  [フォント読み込み]
  <style>[CSS]</style>
</head>
<body>
  [背景SVG or 装飾]
  <div id="hdr">[ヘッダー]</div>
  <div id="main">[ゲームエリア]</div>
  [オーバーレイ類]
  <script>[ゲームロジック]</script>
</body>
</html>
```

---

## 🎮 ゲームシステム設計パターン

### 共通ステート変数
```javascript
// 必ず持つ変数
let gameActive = false;
let gamePaused = false;
let score = 0;
let combo = 0;
let maxCombo = 0;
let timeLeft = 60;
let timerInt = null;
let animFrame = null;
let startTime = null;
let totalKeys = 0;
let correctKeys = 0;
let soundOn = true;
```

### ゲームフロー（必ず守る）
```
START押す → startGame() → gameLoop() + tick()
                ↓
           ゲーム中
                ↓
           timeLeft === 0 → endGame()
                ↓
           ゲームオーバーオーバーレイ表示
                ↓
           「もう一度」→ startGame()
```

### 標準的な startGame() の構造
```javascript
function startGame() {
  // 1. 既存ループのクリア（必ず最初に）
  clearInterval(timerInt);
  cancelAnimationFrame(animFrame);
  
  // 2. ステートリセット
  score = 0; combo = 0; timeLeft = 60;
  gameActive = true; gamePaused = false;
  startTime = Date.now();
  
  // 3. UI更新
  document.getElementById('btn-start').textContent = '↺ RESET';
  
  // 4. ループ開始
  timerInt = setInterval(tick, 1000);
  animFrame = requestAnimationFrame(gameLoop);
  
  // 5. BGM・その他
  startBgm();
}
```

---

## 💰 スポンサー企業名の組み込み方

### データ構造（全アプリ共通）
```javascript
const SPONSOR_ITEMS = [
  { 
    name: '門司港レトロ観光協会',    // 企業・団体名
    yomi: 'もじこうれとろかんこうきょうかい',
    r: 'mojikoretorokenkokyokai',     // タイピング文字
    tag: 'スポンサー',                // バッジ表示
    color: '#F39C12',                 // 金色で強調
  },
];
```

### 表示ルール
- スポンサーネタは `pc-sponsor` クラスで金色ハイライト
- ゲーム内の20〜30%をスポンサーネタにする
- スポンサーネタ正解時に「★ スポンサー名」バッジを表示

### 営業時の説明文
> 「アプリの中でお題として企業名・キャッチコピーが流れてきます。
> 子どもたちが楽しみながら覚えてくれるデジタル広告です。
> 月額〇〇円で掲載できます。」

---

## 🔊 サウンドシステム（Web Audio API）

```javascript
let audioCtx = null;
function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

// キーサウンド（タイプ音）
function playKeySound() { /* ホワイトノイズの短いバースト */ }

// 正解音（上昇音）
function playCorrectSound() { /* 880Hz → 1320Hz */ }

// コンボ音（和音）
function playComboSound(n) { /* n連打でピッチ上昇 */ }

// BGM（bgm.mp3 ループ）
const bgmAudio = new Audio('bgm.mp3');
bgmAudio.loop = true;
const BGM_VOL = 0.20;
```

---

## 📊 スコア計算式（標準）

```javascript
// 基本点 = 文字数 × 12
const base = Math.max(10, word.length * 12);

// コンボボーナス
const comboBonus = combo >= 3 ? combo * 5 : 0;

// 難易度倍率
const diffMult = { easy: 1.0, normal: 1.5, hard: 2.0 }[diff];

// ゾーンボーナス（早めに打つと高得点）
const zoneMult = position < 0.25 ? 3 : position < 0.5 ? 2 : 1;

const pts = Math.round((base + comboBonus) * zoneMult * diffMult);
```

---

## 🏆 ランキング・ユーザー管理（Supabase）

```javascript
const SUPABASE_URL = '★あなたのURL★';
const SUPABASE_KEY = '★あなたのKEY★';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// スコア保存
async function saveScore(score, wpm) {
  await sb.from('scores').insert({ player_id: currentUser.id, score, wpm });
}

// ランキング取得（上位10件）
async function loadRanking() {
  const { data } = await sb
    .from('scores')
    .select('score, wpm, players(nickname)')
    .order('score', { ascending: false })
    .limit(10);
  return data;
}
```

---

## 🗾 地域展開テンプレート

新しい地域版を作る時の変数だけ変えるリスト：

```javascript
const REGION_CONFIG = {
  name:    '門司港',           // ← 地域名
  city:    '北九州市',
  theme:   '深夜の関門海峡',   // ← テーマ説明
  color1:  '#08101E',          // ← ベースカラー
  color2:  '#C89020',          // ← アクセントカラー
  items:   [...],              // ← その地域のお題データ
  quizzes: [...],              // ← その地域のクイズ
  bgImage: 'mojiko_bg.svg',    // ← 背景シルエット
};
```

---

## 🛠️ 技術スタック方針

### 今（フェーズ1〜2）: HTML + JS 一本
- GitHub Pagesで無料公開できる
- 「作ってpushするだけ」で動く
- Supabaseと組み合わせればランキング・ユーザー管理も可能
- 鮨撃と同じ作り方で全アプリ統一

### 将来（フェーズ3以降）: Next.js → Vercel
以下の条件が揃ったら移行を検討する：
- アプリが5本を超えた
- 月間PVが3万を超えた
- スポンサーが3社以上ついた

**→ それまでNext.jsは考えない。今はHTML+JSで全部作る。**

---

## 📱 デプロイフロー（GitHub Pages）

```bash
# 1. リポジトリ作成
git init
git remote add origin https://github.com/shinozaki/[アプリ名].git

# 2. ファイルをコミット
git add .
git commit -m "first commit"
git push -u origin main

# 3. GitHub Pages 設定
# Settings → Pages → Source: main branch / root
# URL: https://shinozaki.github.io/[アプリ名]/
```

---

## 📝 Claudeへの一言指示テンプレート

### タイピングアプリ
```
「[テーマ]タイピングアプリ」を作って。
- お題: [例：北海道の地名10個]
- 難易度: [易・普通・難]
- スポンサー枠: [企業名があれば]
- 特殊ルール: [あれば]
このガイドの設計で、プロトタイプまで一気に作って。
```

### アドベンチャー系
```
「[テーマ]アドベンチャーゲーム」を作って。
- 舞台: [場所・世界観]
- 主人公: [キャラ設定]
- ゲーム性: [例：選択肢で進む / タイピングで戦う]
このガイドのデザイン（門司港ダーク）で作って。
```

### 2人プレイ系
```
「[テーマ]対戦ゲーム」を作って。
- プレイ人数: 2人（同一キーボード）
- 勝敗条件: [例：先に10問正解 / 制限時間で高得点]
このガイドのデザインで作って。
```

---

## ✅ プロトタイプ完成チェックリスト

- [ ] START/RESETボタンが動く
- [ ] スコアが加算される
- [ ] タイマーがカウントダウンする
- [ ] ゲームオーバー画面が出る
- [ ] 「もう一度」で再スタートできる
- [ ] スマホで崩れない（viewport設定あり）
- [ ] サウンドON/OFFできる
- [ ] ランキングが表示される（ダミーデータでもOK）

---

## 🌐 ポータルサイト設計（トリップタイピング / TripType）

### サービス概要
- **正式名称**: トリップタイピング
- **愛称・ロゴ**: TripType
- **コンセプト**: 旅するように、楽しく学ぶ。
- **ドメイン**: `triptyping.jp`（メイン） / `triptype.jp`（転送用）
- **リポジトリ**: `shinozaki-web/triptyping`
- **ホスティング**: GitHub Pages（無料）→ PV増えたらVercelへ

### TripTypeデザイン（ポータル用）
```css
:root {
  --navy:   #0A0F2E;  /* ベース */
  --navy2:  #0D1B3E;
  --teal:   #00C9B1;  /* アクセント① */
  --orange: #FF7F3F;  /* アクセント② */
  --gold:   #C8A84B;  /* スポンサー・ゴールド */
  --text:   #E8F0FF;
  --muted:  #6888AA;
}
/* 雰囲気：夜の世界地図・星空・コンパス */
```

---

### サイト構造（ファイル構成）

```
triptyping/
├── index.html          ← ポータルTOP（公開済み）
├── sushigeki/
│   └── index.html      ← 鮨撃 KITAKYUSHU（公開済み）
├── japanmap/
│   └── index.html      ← 日本地図タイピング（開発中）
├── [次のアプリ]/
│   └── index.html
├── sponsor/
│   └── index.html      ← スポンサー申込LP
└── CLAUDE.md           ← このガイド
```

---

### ポータルTOP（index.html）の構成

```
[ヘッダー]
  ロゴ: TripType / トリップタイピング
  キャッチ: 旅するように、楽しく学ぶ。

[アプリ一覧カード]
  ┌──────────────┐  ┌──────────────┐
  │  🍣 鮨撃      │  │ 🗾 日本地図   │
  │  KITAKYUSHU  │  │  タイピング   │
  │  [プレイする] │  │  [プレイする] │
  └──────────────┘  └──────────────┘
  ※ 追加されたら自動でカードを増やす構造にする

[スポンサー帯]
  ★ このサービスは〇〇が応援しています

[AdSense枠]
  レスポンシブ広告（728×90 or 320×100）

[フッター]
  運営: 門司港BONGO / お問い合わせ / スポンサー募集
```

---

### ユーザーの動線設計

```
SNS・YouTube
    ↓
ポータルTOP（triptyping.jp）
    ↓
アプリカード → プレイ開始
    ↓
ゲームオーバー画面
    ├── AdSense広告（収益①）
    ├── スポンサーバナー（収益②）
    ├── 「他のアプリも遊ぶ」→ TOP戻り（回遊）
    └── SNSシェアボタン → 新規流入
```

---

### 各アプリに必ず入れる共通UI要素

```html
<!-- アプリ内フッター（全アプリ共通） -->
<div id="portal-footer">
  <a href="/">← トリップタイピングトップへ</a>
  <span>他のアプリも遊ぼう！</span>
  <a href="/japanmap">🗾 日本地図タイピング</a>
  <a href="/sushigeki">🍣 鮨撃</a>
</div>

<!-- ゲームオーバー画面内の導線 -->
<div id="next-app-cta">
  <p>他のアプリも遊んでみよう</p>
  <a href="/">TripTypeで探す →</a>
</div>
```

---

### AdSense設置箇所（優先順位順）

| 場所 | 形式 | 理由 |
|------|------|------|
| ゲームオーバー画面の下 | レスポンシブ | 離脱前で視認率最高 |
| ポータルTOPのカード下 | 728×90 | 滞在中に自然に見える |
| ランキングセクション横 | 300×250 | スクロール中に入る |
| ゲーム開始前（HowTo画面）| 320×100 | 読んでる間に表示 |

※ゲーム**プレイ中**には絶対に広告を出さない（UX破壊）

---

### スポンサー収益の設計

#### 料金表（営業用）
| プラン | 内容 | 月額 |
|--------|------|------|
| ミニ掲載 | お題に企業名10文を追加 | ¥3,000 |
| スタンダード | お題20文＋バナー表示 | ¥8,000 |
| プレミアム | お題30文＋トップ固定バナー＋SNS紹介 | ¥20,000 |
| 自治体パック | カスタム版制作＋1年運用 | ¥300,000〜 |

#### スポンサー申込LPに必要な要素
```
/sponsor/index.html に含めるもの：
1. サービス紹介（月間PV数・ユーザー層）
2. 掲載サンプル画像（実際のゲーム画面）
3. 料金プラン表
4. 申込フォーム（Googleフォームへリンクでもよい）
5. 問い合わせ先（LINE / メール）
```

---

### フェーズ別公開スケジュール

**Phase 1（完了）**
- ✅ 鮨撃を triptyping.jp/sushigeki/ に公開
- ✅ ポータルTOP（triptyping.jp）公開

**Phase 2（1〜2ヶ月）**
- 日本地図タイピングを追加
- AdSense申請（月1万PV目安）
- スポンサーLP作成＆門司港の企業に営業開始

**Phase 3（半年後〜）**
- 鉄道タイピング追加
- 月間3万PV突破でAdSense本格稼働
- 自治体・学校向けライセンス営業開始

---

### Claudeへの一言指示：ポータルTOP作成

```
トリップタイピング（TripType）のポータルTOPページ（index.html）を作って。

構成：
- ヘッダー：ロゴ「TripType」＋キャッチ「旅するように、楽しく学ぶ。」
- アプリカード：鮨撃・日本地図タイピングの2枚
- AdSense枠（id="ad-top" / id="ad-bottom"）
- スポンサーバナー（金色ライン）
- フッター：運営 門司港BONGO / © 2025 TripType

デザイン：ネイビー（#0A0F2E）ベース・ターコイズ（#00C9B1）アクセント・星空アニメーション。
作ったらGitHubにpushして。
リポジトリ：https://github.com/shinozaki-web/triptyping
```

---

## 🚀 収益化フロー（全体像）

```
SNS・YouTube集客
        ↓
  トリップタイピング（triptyping.jp）
        ↓
  ┌─────┴─────┐
  アプリ遊ぶ   スポンサーLP見る
  ↓               ↓
AdSense収益    掲載料収益
（自動・薄利）  （営業・高単価）
        ↓
  PV増える → 自治体ライセンス営業
```

---

*最終更新: 2025年5月 / 作成: 門司港BONGO 篠崎友寿*
