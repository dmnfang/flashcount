// ── Objects ──────────────────────────────────────────────
const OBJECTS = [
  { id: 'apple',       img: 'assets/objects/apple.png',       label: 'Apple' },
  { id: 'orange',      img: 'assets/objects/orange.png',      label: 'Orange' },
  { id: 'peach',       img: 'assets/objects/peach.png',       label: 'Peach' },
  { id: 'soccer',      img: 'assets/objects/soccer-ball.png', label: 'Soccer ball' },
  { id: 'baseball',    img: 'assets/objects/baseball.png',    label: 'Baseball' },
  { id: 'basketball',  img: 'assets/objects/basketball.png',  label: 'Basketball' },
  { id: 'pencil',      img: 'assets/objects/pencil.png',      label: 'Pencil' },
  { id: 'eraser',      img: 'assets/objects/eraser.png',      label: 'Eraser' },
  { id: 'crayon',      img: 'assets/objects/crayon.png',      label: 'Crayon' },
];

// ── Speed timings (show ms, gap ms) ──────────────────────
const SPEEDS = {
  slow:   { show: [470, 130], gap: [340, 130] },
  normal: { show: [300, 85],  gap: [240, 85]  },
  fast:   { show: [150, 70],  gap: [135, 70]  },
  mixed:  null,
};

// ── State ─────────────────────────────────────────────────
let selectedObj  = null;
let distractors  = 1;
let rangeMin     = 1;
let rangeMax     = 10;
let speed        = 'slow';
let style        = 'basic';
let sequence     = [];
let seqPos       = 0;
let targetCount  = 0;

// ── Helpers ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function getTiming() {
  if (speed === 'mixed') {
    const keys = ['slow', 'normal', 'fast'];
    return SPEEDS[keys[Math.floor(Math.random() * keys.length)]];
  }
  return SPEEDS[speed];
}

// ── Fullscreen ────────────────────────────────────────────
const ICON_ENTER = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M1 6V1H6M10 1H15V6M15 10V15H10M6 15H1V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const ICON_EXIT = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 1V6H1M15 6H10V1M10 15V10H15M1 10H6V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.querySelectorAll('.fullscreen-btn').forEach(btn => {
  btn.innerHTML = ICON_ENTER;
  btn.addEventListener('click', toggleFullscreen);
});

document.addEventListener('fullscreenchange', () => {
  const icon = document.fullscreenElement ? ICON_EXIT : ICON_ENTER;
  document.querySelectorAll('.fullscreen-btn').forEach(btn => {
    btn.innerHTML = icon;
    btn.classList.toggle('is-fullscreen', !!document.fullscreenElement);
  });
});

// ── Build object grid ─────────────────────────────────────
const grid = $('object-grid');
OBJECTS.forEach(obj => {
  const slot = document.createElement('button');
  slot.className = 'obj-slot';
  slot.dataset.id = obj.id;

  slot.innerHTML = `<img class="obj-img" src="${obj.img}" alt="${obj.label}">`;

  slot.addEventListener('click', () => {
    document.querySelectorAll('.obj-slot').forEach(s => s.classList.remove('selected'));
    slot.classList.add('selected');
    selectedObj = obj;
    $('btn-start').disabled = false;
  });

  grid.appendChild(slot);
});

// ── Chip rows ─────────────────────────────────────────────
function setupChips(rowId, callback) {
  document.querySelectorAll(`#${rowId} .chip`).forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll(`#${rowId} .chip`).forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      callback(chip.dataset.val);
    });
  });
}

setupChips('distractor-chips', val => distractors = parseInt(val));
setupChips('speed-chips',      val => speed = val);
setupChips('style-chips',      val => style = val);

document.querySelectorAll('#range-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#range-chips .chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    rangeMin = parseInt(chip.dataset.min);
    rangeMax = parseInt(chip.dataset.max);
  });
});

// ── Start ─────────────────────────────────────────────────
$('btn-start').addEventListener('click', () => {
  buildSequence();
  showPreview();
});

function pluralize(label) {
  const l = label.toLowerCase();
  if (l === 'peach') return 'peaches';
  if (l === 'orange') return 'oranges';
  if (l === 'apple') return 'apples';
  if (l === 'banana') return 'bananas';
  if (l === 'soccer ball') return 'soccer balls';
  if (l === 'baseball') return 'baseballs';
  if (l === 'basketball') return 'basketballs';
  if (l === 'pencil') return 'pencils';
  if (l === 'eraser') return 'erasers';
  if (l === 'crayon') return 'crayons';
  // fallback
  return l + 's';
}

function showPreview() {
  showScreen('screen-preview');
  const label = selectedObj.label.toLowerCase();
  const plural = pluralize(label);
  $('preview-object').innerHTML = `<img src="${selectedObj.img}" alt="${label}">`;
  $('preview-text').innerHTML = `Let's count <span>${plural}!</span>`;
  setTimeout(runCountdown, 2200);
}

function buildSequence() {
  // Bias toward upper end — take the higher of two random rolls
  const roll = () => rangeMin + Math.floor(Math.random() * (rangeMax - rangeMin + 1));
  targetCount = Math.max(roll(), roll());

  const pool = OBJECTS.filter(o => o.id !== selectedObj.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, distractors);

  const targets = Array.from({ length: targetCount }, () => ({ ...selectedObj, isTarget: true }));

  // Build a distractor supply — roughly one per 2-4 targets
  const distractorSupply = [];
  const totalDistractors = Math.max(2, Math.floor(targetCount / (2 + Math.random() * 2)));
  for (let i = 0; i < totalDistractors; i++) {
    distractorSupply.push({ ...pool[i % pool.length], isTarget: false });
  }
  distractorSupply.sort(() => Math.random() - 0.5);

  // Build sequence with natural runs
  sequence = [];
  let ti = 0;
  let di = 0;
  let consecutiveDistractors = 0;

  while (ti < targets.length) {
    // Weighted run lengths: 1(rare), 2(common), 3(common), 4(less common), 5(rare)
    const weights = [1, 3, 3, 2, 1];
    const total = weights.reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let runLength = 1;
    for (let w = 0; w < weights.length; w++) {
      rand -= weights[w];
      if (rand <= 0) { runLength = w + 1; break; }
    }

    for (let r = 0; r < runLength && ti < targets.length; r++) {
      sequence.push(targets[ti++]);
    }

    if (di < distractorSupply.length && ti < targets.length) {
      sequence.push(distractorSupply[di++]);
      if (di < distractorSupply.length && ti < targets.length && Math.random() < 0.3) {
        sequence.push(distractorSupply[di++]);
      }
    }
  }
}

// ── Countdown ─────────────────────────────────────────────
function runCountdown() {
  showScreen('screen-countdown');
  const el = $('countdown-text');
  const steps = ['Ready?', '3', '2', '1', 'Go!'];
  let i = 0;

  el.classList.add('ready');

  function tick() {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    el.textContent = steps[i];

    if (i === 0) {
      el.classList.add('ready');
    } else {
      el.classList.remove('ready');
    }

    i++;
    if (i < steps.length) {
      setTimeout(tick, i === 1 ? 900 : 750);
    } else {
      setTimeout(startGame, 600);
    }
  }

  tick();
}

// ── Game ──────────────────────────────────────────────────
function startGame() {
  showScreen('screen-game');
  const stage = document.querySelector('#screen-game .stage');
  stage.classList.remove('basic', 'spread', 'chaos');
  stage.classList.add(style);
  seqPos = 0;
  $('progress-bar').style.width = '0%';
  runFlash();
}

function runFlash() {
  if (seqPos >= sequence.length) {
    setTimeout(showQuestion, 500);
    return;
  }

  const item = sequence[seqPos];
  const el   = $('flash-object');
  const pct  = Math.round((seqPos / sequence.length) * 100);

  $('progress-bar').style.width = pct + '%';

  el.classList.remove('in', 'out');
  void el.offsetWidth;
  el.innerHTML = `<img src="${item.img}" alt="${item.label}">`;

  // Position and size based on style
  if (style === 'basic') {
    el.style.top = '';
    el.style.left = '';
    el.style.width = '';
    el.style.height = '';
  } else {
    const stage = document.querySelector('#screen-game .stage');
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const baseSize = style === 'chaos'
      ? Math.round(100 + Math.random() * (Math.min(sw, sh) * 0.55))
      : Math.round(Math.min(sw, sh) * 0.38);
    const maxX = sw - baseSize - 20;
    const maxY = sh - baseSize - 20;
    const x = 20 + Math.floor(Math.random() * Math.max(1, maxX));
    const y = 40 + Math.floor(Math.random() * Math.max(1, maxY - 40));
    el.style.width  = baseSize + 'px';
    el.style.height = baseSize + 'px';
    el.style.left   = x + 'px';
    el.style.top    = y + 'px';
  }

  el.classList.add('in');

  const t    = getTiming();
  const show = t.show[0] + Math.random() * t.show[1];
  const gap  = t.gap[0]  + Math.random() * t.gap[1];

  setTimeout(() => {
    el.classList.remove('in');
    el.classList.add('out');
    setTimeout(() => {
      el.classList.remove('out');
      el.innerHTML = '';
      seqPos++;
      setTimeout(runFlash, gap);
    }, 140);
  }, show);
}

// ── Question ──────────────────────────────────────────────
function showQuestion() {
  const label = selectedObj.label.toLowerCase();
  const plural = pluralize(label);
  showScreen('screen-question');
  $('question-object').innerHTML = `<img src="${selectedObj.img}" alt="${label}">`;
  $('question-text').textContent = `How many ${plural}?`;
}

$('btn-show-answer').addEventListener('click', showAnswer);

// ── Answer ────────────────────────────────────────────────
function showAnswer() {
  showScreen('screen-answer');
  const el = $('answer-display');
  el.innerHTML = `
    <span>${targetCount}</span>
    <img src="${selectedObj.img}" alt="${selectedObj.label.toLowerCase()}" style="height:0.75em; width:auto;">
  `;
}

$('btn-home').addEventListener('click', () => {
  showScreen('screen-home');
});