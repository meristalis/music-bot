import { useState, useRef, useCallback, useEffect } from 'react';

export const useAudioPlayer = (library, handleTrackSelect) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none');
  const [currentTrack, setCurrentTrack] = useState(null);

  const audioRef = useRef(null);
  // Флаг для разблокировки аудио-контекста (особенно важно для iOS/Telegram)
  const isUnlocked = useRef(false);

  // --- 1. Подготовка аудио (разблокировка) ---
  const prepareAudio = useCallback(() => {
    if (isUnlocked.current || !audioRef.current) return;

    console.log("[AudioPlayer] Unlocking context...");
    audioRef.current.play()
      .then(() => {
        audioRef.current.pause();
        isUnlocked.current = true;
        console.log("[AudioPlayer] Context unlocked successfully.");
      })
      .catch((e) => {
        console.warn("[AudioPlayer] Unlock failed (waiting for user interaction):", e.message);
      }); 
  }, []);

  // --- 2. Управление воспроизведением ---
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !audio.src || audio.src === window.location.href) {
      return;
    }

    if (audio.paused) {
      audio.play().catch(e => console.error("Play error:", e));
    } else {
      audio.pause();
    }
  }, []);

  // --- 3. Синхронизация состояния через нативные события ---
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => {
      setIsPlaying(true);
    };

    const onPause = () => {
      // Игнорируем паузу, если трек еще не начал реально играть (для корректной работы prepareAudio)
      if (audio.currentTime > 0.1) {
        setIsPlaying(false);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      // Здесь можно вызвать handleNext(), если нужна автопрокрутка
    };

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
    };
  }, []);

  // --- 4. Логика переключения треков ---
  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const modes = { none: 'all', all: 'one', one: 'none' };
      return modes[prev];
    });
  }, []);

  const handleNext = useCallback(() => {
    if (!currentTrack || library.length === 0) return;
    
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    let nextTrack;
    if (isShuffle) {
      nextTrack = library[Math.floor(Math.random() * library.length)];
    } else {
      const currentIndex = library.findIndex(t => t.deezer_id === currentTrack.deezer_id);
      if (currentIndex !== -1 && currentIndex < library.length - 1) {
        nextTrack = library[currentIndex + 1];
      } else if (repeatMode === 'all') {
        nextTrack = library[0];
      } else {
        setIsPlaying(false);
        return;
      }
    }
    if (nextTrack) handleTrackSelect(nextTrack);
  }, [currentTrack, library, isShuffle, repeatMode, handleTrackSelect]);

  const handlePrev = useCallback(() => {
    if (!currentTrack || library.length === 0) return;
    const currentIndex = library.findIndex(t => t.deezer_id === currentTrack.deezer_id);
    const prevTrack = currentIndex > 0 
      ? library[currentIndex - 1] 
      : library[library.length - 1];
    if (prevTrack) handleTrackSelect(prevTrack);
  }, [currentTrack, library, handleTrackSelect]);

  // Синхронизация громкости
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  return {
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    setVolume,
    isShuffle,
    setIsShuffle,
    repeatMode,
    toggleRepeat,
    audioRef,
    togglePlay,
    handleNext,
    handlePrev,
    prepareAudio
  };
};