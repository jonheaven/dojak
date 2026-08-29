import { useCallback } from 'react';

export const useSoundEffects = () => {
  const playSound = useCallback(
    async (
      soundType:
        | 'marketplace'
        | 'domain'
        | 'dogemap'
        | 'transfer'
        | 'mint'
        | 'personal'
        | 'swap',
    ) => {
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
        console.debug('Sound effect failed to play:', error);
      }
    },
    [],
  );

  return { playSound };
};
