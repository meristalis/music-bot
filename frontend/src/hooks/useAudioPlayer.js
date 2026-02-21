import { useState, useRef, useCallback } from 'react';

export const useAudioPlayer = (library, handleTrackSelect) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none');
  const [currentTrack, setCurrentTrack] = useState(null);

  const audioRef = useRef(null);

  // --- НОВОЕ: Подготовка аудио для мобильных WebView ---
  const prepareAudio = useCallback(() => {
    if (audioRef.current) {
      // Пытаемся запустить пустой звук. Это дает сигнал системе:
      // "Это приложение сейчас будет управлять звуком!"
      audioRef.current.play()
        .then(() => audioRef.current.pause())
        .catch(() => {}); 
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // play() возвращает promise, стоит это учитывать
      audioRef.current.play().catch(e => console.error("Play error:", e));
    }
    // Мы не будем ставить setIsPlaying здесь, 
    // а сделаем это в обработчиках onPlay/onPause в AudioPlayer.jsx
  }, [isPlaying]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'none') return 'all';
      if (prev === 'all') return 'one';
      return 'none';
    });
  }, []);

  const handleNext = useCallback(() => {
    if (!currentTrack || library.length === 0) return;
    
    if (repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
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
      } else {
        // Если дошли до конца, а repeatMode 'all' — идем в начало
        if (repeatMode === 'all') {
          nextTrack = library[0];
        } else {
          setIsPlaying(false);
          return;
        }
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