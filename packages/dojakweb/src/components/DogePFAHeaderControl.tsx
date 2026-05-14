import React, { useRef, useState } from 'react';
import { MusicalNoteIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { useDogePFA } from '../hooks/useDogePFA';
import { useDojakwebI18n } from '../contexts/DojakwebLocaleContext';

/**
 * Compact play/pause for ÐPFA (profile audio) when a content URL is known.
 */
export const DogePFAHeaderControl: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { pfaInscriptionId, pfaContentUrl } = useDogePFA();
  const { t } = useDojakwebI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  if (!pfaInscriptionId || !pfaContentUrl) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    void el.play().then(() => setPlaying(true)).catch(() => {
      toast.error(t('modal.profileDpfa.playError'));
      setPlaying(false);
    });
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={pfaContentUrl}
        loop
        playsInline
        preload="none"
        className="hidden"
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-amber-200/90 transition hover:bg-amber-500/15 hover:text-amber-100 ${className}`}
        aria-label={playing ? t('modal.profileDpfa.pauseAria') : t('modal.profileDpfa.playAria')}
        title={playing ? t('modal.profileDpfa.pauseAria') : t('modal.profileDpfa.playAria')}
      >
        <MusicalNoteIcon className={`h-4 w-4 ${playing ? 'animate-pulse' : ''}`} aria-hidden />
      </button>
    </>
  );
};
