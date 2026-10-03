type AmbientState = { context: AudioContext; master: GainNode; nodes: OscillatorNode[]; lfo?: OscillatorNode; lfoGain?: GainNode };

let state: AmbientState | null = null;

export async function startJarvisAmbient(): Promise<boolean> {
  try {
    if (state) {
      if (state.context.state === "suspended") await state.context.resume();
      return true;
    }

    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return false;

    const context: AudioContext = new Ctx();
    await context.resume();

    const master = context.createGain();
    master.gain.value = 0.018;
    master.connect(context.destination);

    const nodes: OscillatorNode[] = [];
    const frequencies = [55, 82.41, 110, 164.81];

    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.34 : 0.10;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      nodes.push(oscillator);
    });

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = 0.009;
    lfo.connect(lfoGain);
    lfoGain.connect(master.gain);
    lfo.start();

    state = { context, master, nodes, lfo, lfoGain };
    return true;
  } catch {
    state = null;
    return false;
  }
}

export async function stopJarvisAmbient(): Promise<void> {
  if (!state) return;
  const current = state;
  state = null;
  current.nodes.forEach((node) => {
    try { node.stop(); } catch {}
  });
  try { current.lfo?.stop(); } catch {}
  try { await current.context.close(); } catch {}
}

export async function toggleJarvisAmbient(enabled: boolean): Promise<boolean> {
  if (enabled) return startJarvisAmbient();
  await stopJarvisAmbient();
  return false;
}

export function isJarvisAmbientRunning(): boolean {
  return state !== null;
}
