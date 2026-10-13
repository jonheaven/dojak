import { useCallback } from 'react';

export type DojakSoundType =
  | 'marketplace'
  | 'domain'
  | 'dogemap'
  | 'transfer'
  | 'mint'
  | 'personal'
  | 'swap'
  | 'incoming';

/** Short dual-tone ping when mp3 assets are missing (typical for embeds). */
async function playSynthesizedPing(): Promise<void> {
  if (typeof window === 'undefined') return;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const now = ctx.currentTime;
    const tones: Array<{ f: number; t: number; d: number }> = [
      { f: 880, t: 0, d: 0.09 },
      { f: 1174.7, t: 0.08, d: 0.14 },
    ];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.f;
      gain.gain.setValueAtTime(0.0001, now + tone.t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + tone.t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.t + tone.d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + tone.t);
      osc.stop(now + tone.t + tone.d + 0.02);
    }
    await new Promise((r) => setTimeout(r, 280));
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

export const useSoundEffects = () => {
  const playSound = useCallback(async (soundType: DojakSoundType) => {
    try {
      if (soundType === 'incoming') {
        try {
          const audio = new Audio('/sounds/chime.mp3');
          audio.volume = 0.85;
          await audio.play();
          return;
        } catch {
          await playSynthesizedPing();
          return;
        }
      }

      let soundFile = '';
      switch (soundType) {
        case 'marketplace':
          soundFile = '/sounds/cash-register.mp3';
          break;
        case 'domain':
          soundFile = '/sounds/stamp.mp3';
          break;
        case 'dogemap':
          soundFile = '/sounds/boom.mp3';
          break;
        case 'transfer':
          soundFile = '/sounds/whoosh.mp3';
          break;
        case 'mint':
          soundFile = '/sounds/ding.mp3';
          break;
        case 'personal':
          soundFile = '/sounds/chime.mp3';
          break;
        case 'swap':
          soundFile = '/sounds/swap.mp3';
          break;
        default:
          return;
      }

      const audio = new Audio(soundFile);
      if (soundType === 'personal' || soundType === 'swap') {
        audio.volume = 0.85;
      } else {
        audio.volume = 0.4;
      }
      await audio.play();
    } catch (error) {
      if (soundType === 'incoming' || soundType === 'personal') {
        try {
          await playSynthesizedPing();
          return;
        } catch {
          /* ignore */
        }
      }
      console.debug('Sound effect failed to play:', error);
    }
  }, []);

  return { playSound };
};
