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
  slow:   { show: [550, 150], gap: [400, 150] },
  normal: { show: [350, 100], gap: [280, 100] },
  fast:   { show: [180, 80],  gap: [160, 80]  },
  mixed:  null,
};

// ── State ─────────────────────────────────────────────────
let selectedObj  = null;
let distractors  = 1;
let rangeMin     = 1;
let rangeMax     = 10;
let speed        = 'slow';
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

function showPreview() {
  showScreen('screen-preview');
  const label = selectedObj.label.toLowerCase();
  $('preview-object').innerHTML = `<img src="${selectedObj.img}" alt="${label}">`;
  $('preview-text').innerHTML = `Let's count <span>${label}s!</span>`;
  setTimeout(runCountdown, 2200);
}

function buildSequence() {
  // Bias toward upper end — take the higher of two random rolls
  const roll = () => rangeMin + Math.floor(Math.random() * (rangeMax - rangeMin + 1));
  targetCount = Math.max(roll(), roll());

  const pool = OBJECTS.filter(o => o.id !== selectedObj.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, distractors);

  // When count lands in the bottom third of the range, boost distractor frequency
  const rangeBand = rangeMax - rangeMin;
  const isLowCount = targetCount < rangeMin + Math.ceil(rangeBand / 3);
  const distractorEvery = isLowCount ? 1 : (2 + Math.floor(Math.random()));

  const distractorItems = [];
  const totalDistractors = Math.max(pool.length, Math.floor(targetCount / distractorEvery));
  for (let i = 0; i < totalDistractors; i++) {
    distractorItems.push({ ...pool[i % pool.length], isTarget: false });
  }
  distractorItems.sort(() => Math.random() - 0.5);

  const targets = Array.from({ length: targetCount }, () => ({ ...selectedObj, isTarget: true }));
  sequence = [];
  let ti = 0, di = 0, sinceLastDistractor = 0;

  while (ti < targets.length || di < distractorItems.length) {
    const canInsert =
      di < distractorItems.length &&
      sinceLastDistractor >= distractorEvery &&
      sequence.length > 0 &&
      ti < targets.length;

    if (canInsert) {
      sequence.push(distractorItems[di++]);
      sinceLastDistractor = 0;
    } else if (ti < targets.length) {
      sequence.push(targets[ti++]);
      sinceLastDistractor++;
    } else {
      sequence.splice(sequence.length - 1, 0, distractorItems[di++]);
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
  showScreen('screen-question');
  $('question-object').innerHTML = `<img src="${selectedObj.img}" alt="${label}">`;
  $('question-text').textContent = `How many ${label}s?`;
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