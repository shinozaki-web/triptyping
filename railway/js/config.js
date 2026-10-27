'use strict';
window.Railway = window.Railway || {};
Railway.config = Object.freeze({
  stations: ['門司港', '小森江', '門司', '小倉'],
  levels: {
    easy: { name: '見習い', cpm: 60, words: 4, multiplier: 1, help: '1分に60文字が目標。短いお題から、ゆっくり。' },
    normal: { name: '運転士', cpm: 120, words: 5, multiplier: 1.5, help: '1分に120文字が目標。学校や企業の名前にも挑戦。' },
    hard: { name: '達人', cpm: 180, words: 6, multiplier: 2, help: '1分に180文字が目標。長いお題も、正確に。' }
  }
});
