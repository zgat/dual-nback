type FeedbackKind = "correct" | "wrong";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined" || !window.AudioContext) return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
}

function playCorrectTone(context: AudioContext, startAt: number) {
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.15, startAt + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.24);
  gain.connect(context.destination);

  [659.25, 880].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteStart = startAt + index * 0.075;
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.16);
  });
}

function playWrongTone(context: AudioContext, startAt: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(125, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(72, startAt + 0.34);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(380, startAt);
  filter.Q.setValueAtTime(0.7, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.38);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + 0.4);
}

export function playFeedbackSound(kind: FeedbackKind) {
  try {
    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      const startAt = context.currentTime + 0.01;
      if (kind === "correct") playCorrectTone(context, startAt);
      else playWrongTone(context, startAt);
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
