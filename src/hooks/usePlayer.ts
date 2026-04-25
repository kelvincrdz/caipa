import { useState, useEffect, useRef } from 'react';

export function usePlayer(previewUrl: string | undefined | null, onEnded: () => void) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setProgress(0);
    setIsPlaying(false);
    setAutoplayBlocked(false);

    if (!previewUrl) return;

    const audio = new Audio(previewUrl);
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const onEnd = () => {
      setProgress(0);
      setIsPlaying(false);
      onEndedRef.current();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('play', () => setIsPlaying(true));
    audio.addEventListener('pause', () => setIsPlaying(false));

    audio.play().catch(() => setAutoplayBlocked(true));

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnd);
      audio.pause();
    };
  }, [previewUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
      setAutoplayBlocked(false);
    }
  };

  return { isPlaying, progress, autoplayBlocked, togglePlay };
}
