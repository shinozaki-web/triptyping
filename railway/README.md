# 鉄道タイピング 北九州線

Buildless HTML / CSS / JavaScript. Open through a static server; no account, API key, backend, package installation, or build is needed.

```sh
python3 -m http.server 8769 --bind 127.0.0.1
node --test railway/tests/core.test.cjs
```

Route: 門司港 → 小森江 → 門司 → 小倉 (鹿児島本線). The forward-facing canvas cab is an original illustration inspired by the 813 series, not a precise reconstruction of the train or scenery. No third-party train photos, logos, or recordings are used.

The three levels target 60 / 120 / 180 correct keystrokes per minute. Each leg draws local words and ends with its destination. Its practice timetable is `ceil(canonical character count × 60 / target CPM)`. Targets are cumulative: early time and lateness carry across legs. Only active typing time counts; automatic stopping, station dwell, and pauses do not. No manual brake action. Late trains continue to the terminus.

Kana-position graphs accept common romaji variants, including decomposed small kana, doubled consonants, and context-sensitive ん. Mistakes do not modify the accepted text. Paste/drop/repeated held keys do not advance the game. Per-word score uses canonical length, a capped combo bonus, and a level multiplier. Results show actual accepted keystrokes / active minute, accuracy, and score. The records and collection are local to this browser (no global leaderboard).

`js/data.js` contains 40 regional words, readings, editorial station-area assignments, and public source URLs checked on 2026-10-27. Place names and stations refer to municipal/JR information; schools, businesses, facilities, mountains, and the river use the linked public sources. Names omit 北九州市立 / 福岡県立 / 株式会社 for practice. Assignment to a leg does not imply visibility from the train. 紫川 is a local word, not a bridge crossed on this route. The listed organizations are not sponsors or affiliates.

Code is split by responsibility: config, data, sound, ranking, romaji, core, UI, canvas scene, and game orchestration. Text is rendered with `textContent` and DOM creation. Local storage is bounded and validated, and storage failures are handled. The only active external requests are Google Fonts. The portal's required AdSense publisher code is retained in the head as an inert `text/plain` script: no ad script executes on this game, and no ad units are present, preventing Auto ads from covering gameplay. Any future monetization needs an explicit non-playing placement and page-level Auto ads exclusion before activating the loader.

Manual checks: desktop/mobile layout; full route; wrong key and alternate spellings; pause/resume and focus-loss pause; sound; retry/level change; collection and local record persistence. Automated checks cover every dictionary spelling, alternate input paths, wrong-key rejection, timetable arithmetic, metrics, and malformed/blocked storage.
