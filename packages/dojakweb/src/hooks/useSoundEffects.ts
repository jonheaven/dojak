import { useCallback } from 'react';

export const useSoundEffects = () => {
  const playSound = useCallback(async (soundType: 'marketplace' | 'domain' | 'dogemap' | 'transfer' | 'mint' | 'personal') => {
    try {
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
        default:
          return;
      }

      const audio = new Audio(soundFile);

      // Adjust volume based on sound type
      if (soundType === 'personal') {
        audio.volume = 0.8; // Louder for personal events
      } else {
        audio.volume = 0.4; // Quieter for general activity
      }

      await audio.play();
    } catch (error) {
      // Silently fail if audio can't play (browser restrictions, missing files, etc.)
      console.debug('Sound effect failed to play:', error);
    }
  }, []);

  return { playSound };
};
