type FeedbackKind = "correct" | "wrong" | "advance";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
}

function createBalancedOutput(context: AudioContext) {
  const compressor = context.createDynamicsCompressor();
  const output = context.createGain();

  compressor.threshold.setValueAtTime(-18, context.currentTime);
  compressor.knee.setValueAtTime(9, context.currentTime);
  compressor.ratio.setValueAtTime(4, context.currentTime);
  compressor.attack.setValueAtTime(0.003, context.currentTime);
  compressor.release.setValueAtTime(0.14, context.currentTime);
  output.gain.setValueAtTime(0.9, context.currentTime);

  compressor.connect(output);
  output.connect(context.destination);
  return compressor;
}

function playCorrectTone(context: AudioContext, startAt: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.24, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
  gain.connect(createBalancedOutput(context));

  [659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteStart = startAt + index * 0.075;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.18);
  });
}

function playWrongTone(context: AudioContext, startAt: number) {
  const body = context.createOscillator();
  const overtone = context.createOscillator();
  const overtoneGain = context.createGain();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  body.type = "triangle";
  body.frequency.setValueAtTime(196, startAt);
  body.frequency.exponentialRampToValueAtTime(130, startAt + 0.34);
  overtone.type = "sine";
  overtone.frequency.setValueAtTime(293.66, startAt);
  overtone.frequency.exponentialRampToValueAtTime(196, startAt + 0.34);
  overtoneGain.gain.setValueAtTime(0.34, startAt);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(760, startAt);
  filter.Q.setValueAtTime(0.7, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.34, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.38);

  body.connect(filter);
  overtone.connect(overtoneGain);
  overtoneGain.connect(filter);
  filter.connect(gain);
  gain.connect(createBalancedOutput(context));
  body.start(startAt);
  overtone.start(startAt);
  body.stop(startAt + 0.4);
  overtone.stop(startAt + 0.4);
}

function playAdvanceTone(context: AudioContext, startAt: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.23, startAt + 0.016);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
  gain.connect(createBalancedOutput(context));

  [440, 587.33].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteStart = startAt + index * 0.08;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.18);
  });
}

export function playFeedbackSound(kind: FeedbackKind) {
  try {
    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      const startAt = context.currentTime + 0.01;
      if (kind === "correct") playCorrectTone(context, startAt);
      else if (kind === "wrong") playWrongTone(context, startAt);
      else playAdvanceTone(context, startAt);
    };

    if (context.state === "suspended") {
      void context.resume().then(play).catch(() => undefined);
    } else {
      play();
    }
  } catch {
    // Audio feedback is optional; unsupported or blocked audio must not interrupt play.
  }
}
