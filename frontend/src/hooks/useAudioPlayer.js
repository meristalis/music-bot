import { useState, useRef, useCallback } from 'react';

export const useAudioPlayer = (library, handleTrackSelect) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('none'); // 'none' | 'all' | 'one'
  const [currentTrack, setCurrentTrack] = useState(null);

  const audioRef = useRef(null);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
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
    
    // Если стоит повтор одного трека
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
        nextTrack = library[0]; // В начало списка
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
    handlePrev
  };
};