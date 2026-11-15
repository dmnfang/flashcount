// ============================================
// sound.js — Flashcount port of cardbox-app's sound.js
// Same engine (Web Audio buffers, per-sound GAIN, iOS unlock, automatic UI click sounds) and the same
// Cardbox v3 SFX pack, minus React, music loops and saved settings (Flashcount keeps settings in memory).
// Loaded as <script type="module">; sets window.sound and installs itself.
// ============================================

const BASE = new URL('./assets/sfx/', import.meta.url).href

/* ================= TUNING KNOBS ================= */
const SFX_VOL = 0.5           // master level (0–1), same as Cardbox

// Per-sound level, multiplied with the master. 1 = as exported; lower = quieter.
const GAIN = {
  tap: 0.55,
  toggle: 0.5,
  launch: 0.7,
  close: 0.6,
  tilePop: 0.8,
  revealAll: 0.6,
}

// Pitch changes that keep Tap and Toggle sounding different from each other (same as Cardbox)
const TAP_RATE = 0.85         // plain buttons: a bit lower
const SELECT_RATE = 1.1       // radio-style pills / object tiles changing selection

// Synthesized tick (same "tock" as Cardbox, used for the countdown and distractors)
const TICK_VOLUME = 0.5

// What plays during a count (see CUES below)
const POP_RATE = [0.95, 1.08]            // every flash pops, each a touch higher or lower
const COUNT_TICK = { freq: 1200 }        // Ready? / 3 / 2 / 1
const GO_TICK = { freq: 1800, volume: 1.4, dur: 0.09 }   // Go!: same tock, higher and a little longer
/* ================================================= */

const SFX = {
  tap: 'Tap.mp3',
  toggle: 'Toggle.mp3',
  launch: 'Launch.mp3',
  close: 'Close.mp3',
  tilePop: 'Reveal_-_Tile_Pop.mp3',
  revealAll: 'Reveal_-_Reveal-all.mp3',
}

/* ---------- settings (in memory) ---------- */
const state = { sfxOn: true, sfxVol: SFX_VOL }

export function setSfxOn(on) {
  state.sfxOn = !!on
  applyVolumes()
}

/* ---------- audio engine ---------- */
let ctx = null
let sfxBus = null
const buffers = new Map()
const loading = new Map()
const lastPlayed = {}

function ensureCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC({ latencyHint: 'interactive' })
  sfxBus = ctx.createGain()
  sfxBus.connect(ctx.destination)
  applyVolumes()
  return ctx
}

function applyVolumes() {
  if (!ctx) return
  sfxBus.gain.setTargetAtTime(state.sfxOn ? state.sfxVol : 0, ctx.currentTime, 0.02)
}

function load(name, file) {
  if (buffers.has(name)) return Promise.resolve(buffers.get(name))
  if (loading.has(name)) return loading.get(name)
  const p = fetch(BASE + file)
    .then(r => r.arrayBuffer())
    // callback form of decodeAudioData for older Safari
    .then(ab => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
    .then(buf => { buffers.set(name, buf); return buf })
    .catch(err => { console.warn('[sound] failed to load', file, err); loading.delete(name); return null })
  loading.set(name, p)
  return p
}

function preloadSfx() {
  Object.entries(SFX).forEach(([name, file]) => load(name, file))
}

/* ---------- playing one-shots ---------- */
// opts: { rate: 1 | [min, max], volume: 1, minGap: ms }
// returns a handle with .stop(fadeSeconds) or null if nothing played
function play(name, { rate = 1, volume = 1, minGap = 0 } = {}) {
  if (!state.sfxOn || !ctx || ctx.state !== 'running') return null
  const buf = buffers.get(name)
  if (!buf) return null

  const now = performance.now()
  if (minGap && now - (lastPlayed[name] || 0) < minGap) return null
  lastPlayed[name] = now

  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = Array.isArray(rate) ? rate[0] + Math.random() * (rate[1] - rate[0]) : rate

  const g = ctx.createGain()
  g.gain.value = (GAIN[name] ?? 1) * volume
  src.connect(g)
  g.connect(sfxBus)
  src.start()

  return {
    stop(fade = 0.08) {
      try {
        g.gain.cancelScheduledValues(ctx.currentTime)
        g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3)
        src.stop(ctx.currentTime + fade + 0.05)
      } catch { /* already ended */ }
    },
  }
}

// Short synthesized "tock": a triangle wave with a quick downward pitch bend and fast decay.
// freq = starting pitch in Hz, volume = multiplier, dur = length in seconds
function tick({ freq = 1200, volume = 1, dur = 0.045 } = {}) {
  if (!state.sfxOn || !ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(freq, t)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.7, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(TICK_VOLUME * volume, t + 0.003)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g)
  g.connect(sfxBus)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/* ---------- Flashcount cues (called from app.js) ---------- */
const CUES = {
  flash: () => play('tilePop', { rate: POP_RATE }),   // any object flashes (target or not)
  count: () => tick(COUNT_TICK),                      // Ready? / 3 / 2 / 1
  go:    () => tick(GO_TICK),                         // Go!
}

function cue(name) {
  const fn = CUES[name]
  if (fn) fn()
}

/* ---------- unlock + automatic UI sounds ---------- */
function unlock() {
  const c = ensureCtx()
  if (!c) return
  if (c.state !== 'running') c.resume().catch(() => {})
  // silent blip fully unlocks iOS
  const s = c.createBufferSource()
  s.buffer = c.createBuffer(1, 1, 22050)
  s.connect(c.destination)
  s.start(0)
  preloadSfx()
}

// Radio-style pills: only make a sound when the selection actually changes
const RADIO_CLASSES = ['toggle-pill']
const LAUNCH_CLASSES = ['launch-btn']

// Runs before the click is applied, so .active / .selected still show the old state.
// A button can override all of this with data-sound="<name>" (or "none").
function onUiClick(e) {
  const el = e.target.closest?.('button')
  if (!el || el.disabled) return
  const cl = el.classList
  const forced = el.dataset.sound
  if (forced === 'none') return
  if (forced) { play(forced); return }

  if (LAUNCH_CLASSES.some(c => cl.contains(c))) { play('launch'); return }
  // Object tiles behave like radio pills
  if (cl.contains('obj-slot')) {
    if (!cl.contains('selected')) play('toggle', { rate: SELECT_RATE })
    return
  }
  if (RADIO_CLASSES.some(c => cl.contains(c))) {
    if (cl.contains('active')) return // already selected, nothing changes
    play('toggle', { rate: SELECT_RATE })
    return
  }
  play('tap', { rate: TAP_RATE })
}

export function installSound() {
  const unlockEvents = ['pointerup', 'click', 'keydown', 'touchend']
  const unlockHandler = () => {
    unlock()
    if (ctx && ctx.state === 'running') {
      unlockEvents.forEach(ev => window.removeEventListener(ev, unlockHandler, true))
    }
  }
  unlockEvents.forEach(ev => window.addEventListener(ev, unlockHandler, true))
  document.addEventListener('click', onUiClick, true)

  const onVisibility = () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend().catch(() => {})
    else ctx.resume().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  return () => {
    unlockEvents.forEach(ev => window.removeEventListener(ev, unlockHandler, true))
    document.removeEventListener('click', onUiClick, true)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

export const sound = { play, tick, cue, setSfxOn }
window.sound = sound
installSound()
export default sound