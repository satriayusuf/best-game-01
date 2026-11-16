// Procedural sound with the Web Audio API: every effect is synthesised from oscillators and a
// little filtered noise, so the game ships no audio files. The context is created lazily on the
// first user gesture (browsers refuse to start one before that), and every call is safe before
// then — it simply stays silent.

export function createAudio() {
  let ctx = null;
  let master = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** One oscillator note: frequency glides from f0 to f1 over the note's life. */
  function tone(f0, f1, seconds, type, volume, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** A burst of white noise through a band-pass filter: impacts and explosions. */
  function noise(seconds, centreFreq, volume, when = 0) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + when;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = centreFreq;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    source.connect(filter).connect(gain).connect(master);
    source.start(t0);
  }

  return {
    /** Call from any click or key press so the context unlocks. */
    unlock() {
      ensure();
    },
    /** A meteor pinged off the shield; the pitch climbs with the combo. */
    deflect(combo) {
      const base = 340 + Math.min(combo, 30) * 14;
      tone(base, base * 1.6, 0.09, 'square', 0.16);
      tone(base * 2, base * 2.4, 0.06, 'sine', 0.10);
    },
    /** A seed reached the soil: a soft two-note chime. */
    bloom() {
      tone(659, 659, 0.12, 'sine', 0.16);
      tone(880, 880, 0.16, 'sine', 0.14, 0.07);
    },
    /** A heart reached the planet: a warm lift. */
    heart() {
      tone(523, 784, 0.18, 'triangle', 0.18);
    },
    /** A meteor got through: a low thud and a crunch. */
    damage() {
      tone(130, 44, 0.28, 'sawtooth', 0.22);
      noise(0.22, 300, 0.20);
    },
    /** A seed or heart wasted on the shield: a dull puff. */
    blocked() {
      tone(210, 140, 0.10, 'triangle', 0.12);
      noise(0.08, 700, 0.06);
    },
    /** Full bloom: a little rising arpeggio. */
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => tone(f, f, 0.22, 'triangle', 0.16, i * 0.09));
    },
    /** The planet falls: a descending sweep into noise. */
    gameOver() {
      tone(392, 55, 0.9, 'sawtooth', 0.18);
      noise(0.7, 180, 0.16, 0.1);
    },
    /** Level up: two quick bright notes. */
    levelUp() {
      tone(740, 740, 0.08, 'square', 0.10);
      tone(1108, 1108, 0.12, 'square', 0.10, 0.08);
    },
  };
}
