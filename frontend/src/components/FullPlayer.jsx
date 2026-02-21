import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ChevronUp, ChevronDown, Volume2, Share2 } from 'lucide-react';

// --- КОМПОНЕНТ ДЛЯ ТЕКСТА С КЭШИРОВАНИЕМ ---
const LyricsView = ({ currentTrack, currentTime, audioRef, isActive }) => {
  const [lyrics, setLyrics] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchLyrics = async () => {
      if (!currentTrack) return;

      const cacheKey = `lyrics_${currentTrack.deezer_id || (currentTrack.artist + currentTrack.title).replace(/\s/g, '')}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const { lyrics: cachedLyrics, isSynced: cachedSynced } = JSON.parse(cached);
        setLyrics(cachedLyrics);
        setIsSynced(cachedSynced);
        return;
      }

      try {
        const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(currentTrack.artist)}&track_name=${encodeURIComponent(currentTrack.title)}`);
        const data = await res.json();

        let finalLyrics = [];
        let synced = false;

        if (data.syncedLyrics) {
          finalLyrics = data.syncedLyrics.split('\n').map(line => {
            const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
            if (match) {
              return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
            }
            return null;
          }).filter(l => l && l.text);
          synced = true;
        } else if (data.plainLyrics) {
          finalLyrics = data.plainLyrics.split('\n').map(t => ({ time: -1, text: t.trim() })).filter(l => l.text);
          synced = false;
        } else {
          finalLyrics = [{ time: -1, text: "Текст не найден" }];
        }

        localStorage.setItem(cacheKey, JSON.stringify({ lyrics: finalLyrics, isSynced: synced }));
        setLyrics(finalLyrics);
        setIsSynced(synced);
      } catch (e) {
        setLyrics([{ time: -1, text: "Текст не найден" }]);
        setIsSynced(false);
      }
    };

    fetchLyrics();
  }, [currentTrack]);

  const activeIndex = useMemo(() => {
    if (!isSynced) return -1;
    return lyrics.reduce((acc, line, index) => (currentTime >= line.time ? index : acc), -1);
  }, [currentTime, lyrics, isSynced]);

  useEffect(() => {
    if (isSynced && activeIndex !== -1 && isActive) {
      const container = scrollRef.current;
      const activeEl = container?.children[activeIndex + 1]; 
      
      if (activeEl) {
        const parentRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const offset = activeRect.top - parentRect.top - (parentRect.height / 2) + (activeRect.height / 2);
        container.scrollBy({ top: offset, behavior: 'smooth' });
      }
    }
  }, [activeIndex, isSynced, isActive]);

  return (
    <div style={styles.lyricsScroll} ref={scrollRef} className="no-scrollbar">
      <div style={{ height: '5vh', flexShrink: 0 }} />
      {lyrics.map((line, i) => (
        <div
          key={i}
          onClick={() => isSynced && line.time !== -1 && (audioRef.current.currentTime = line.time)}
          className={`lyric-line ${i === activeIndex ? 'active' : ''}`}
          style={{
            ...styles.lyricLine,
            opacity: isSynced ? (i === activeIndex ? 1 : 0.3) : 0.8,
            fontSize: 'clamp(24px, 8vw, 38px)', 
            transform: i === activeIndex ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          {line.text}
        </div>
      ))}
      <div style={{ height: '10vh', flexShrink: 0 }} />
    </div>
  );
};

// --- ОСНОВНОЙ ПЛЕЕР ---

const FullPlayer = ({
  isOpen, currentTrack, onClose, isPlaying, togglePlay,
  currentTime, setCurrentTime, duration, formatTime,
  audioRef, handleNext, handlePrev, isShuffle, setIsShuffle,
  repeatMode, toggleRepeat, handleLike, favoriteTrackIds
}) => {
  const [showLyrics, setShowLyrics] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const volumeTimerRef = useRef(null);
  const volumeContainerRef = useRef(null); // Реф для отслеживания клика вне области
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  useEffect(() => { 
    if (!isOpen) setShowLyrics(false); 
  }, [isOpen, currentTrack]);

  // Обработка закрытия громкости при клике вне её области
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showVolumeBar && volumeContainerRef.current && !volumeContainerRef.current.contains(event.target)) {
        setShowVolumeBar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeBar]);

  // Обработка громкости
  // Добавь реф в начало компонента FullPlayer
const lastVolumeUpdateRef = useRef(0);

const handleVolumeChange = (e) => {
  const newVol = parseFloat(e.target.value);
  const now = Date.now();
  
  // Обновляем аудио не чаще чем раз в 50мс
  if (now - lastVolumeUpdateRef.current > 50) {
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    lastVolumeUpdateRef.current = now;
  } else {
    // Состояние ползунка (визуал) обновляем всегда для плавности
    setVolume(newVol);
  }
  resetVolumeTimer();
};

  const resetVolumeTimer = () => {
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolumeBar(false), 5000); // 5 сек для удобства
  };

  const toggleVolumeBar = (e) => {
    e.stopPropagation();
    setShowVolumeBar(!showVolumeBar);
    if (!showVolumeBar) resetVolumeTimer();
  };

  // Поделиться треком в Telegram
const handleShare = async () => {
    // Безопасно берем объект WebApp
    const tg = window.Telegram?.WebApp;
    
    // Проверяем платформу. Если мы в ТГ, там будет 'android', 'ios', 'tdesktop' и т.д.
    const isTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');
    
    const botUsername = 'music_player_vufik_bot';
    const appShortName = 'play'; 
    
    // Формируем ссылку
    const shareUrl = isTelegram 
        ? `https://t.me/${botUsername}/${appShortName}?startapp=${currentTrack.deezer_id}`
        : `${window.location.origin}${window.location.pathname}?track=${currentTrack.deezer_id}`;
    
    const shareText = `Послушай этот трек: ${currentTrack.artist} - ${currentTrack.title}`;

    if (isTelegram) {
        // Нативный шаринг внутри Telegram
        const tgLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        tg.openTelegramLink(tgLink);
        
        // Вибрация — важная мелочь для "нативности"
        if (tg.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('medium');
        }
    } else {
        // Браузерный вариант
        if (navigator.share) {
            try {
                await navigator.share({
                    title: currentTrack.title,
                    text: shareText,
                    url: shareUrl,
                });
            } catch (err) { console.log("Отмена"); }
        } else {
            navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
            alert('Ссылка скопирована!');
        }
    }
};
  if (!isOpen || !currentTrack) return null;

  const isLiked = favoriteTrackIds.has(currentTrack.deezer_id);

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        
        .visual-layer {
          transition: transform 0.6s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.5s ease;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
        }

        .lyric-line { transition: all 0.4s ease; cursor: pointer; color: var(--text-primary); }
        .lyric-line.active { 
          color: var(--text-primary); 
          text-shadow: 0 0 15px var(--lyric-shadow); 
        }

        .arrow-btn {
          color: var(--text-primary);
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }

        /* iOS Volume Slider Styles */
        .ios-volume-popover {
          position: absolute;
          bottom: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          width: 42px;
          height: 160px;
          border-radius: 14px;
          overflow: hidden;
          animation: slideUp 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: 100;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .ios-volume-track {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column-reverse;
        }

        .ios-volume-fill {
          width: 100%;
          background: #fff;
          transition: height 0.1s ease-out;
        }

        .ios-volume-input {
          position: absolute;
          top: 0;
          left: 0;
          width: 160px; /* Высота контейнера */
          height: 42px; /* Ширина контейнера */
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          transform: rotate(-90deg) translateX(-160px);
          transform-origin: top left;
          cursor: pointer;
          margin: 0;
          z-index: 5;
        }

        .ios-volume-input::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 42px; /* Ширина контейнера громкости */
  height: 42px;
  background: transparent;
  border: none; /* Убираем возможные рамки */
  cursor: pointer;
}
  .ios-volume-input::-moz-range-thumb {
  width: 42px;
  height: 42px;
  background: transparent;
  border: none;
  cursor: pointer;
}
  .ios-volume-input:focus {
  outline: none;
}

        /* Основной прогресс-бар трека */
        .track-slider::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: var(--text-primary);
          cursor: pointer;
          border: 2px solid var(--bg-color);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .ios-volume-popover, .ios-volume-input {
  touch-action: none; /* Запрещает системе обрабатывать жесты внутри этой области */
}
      `}</style>

      {/* СЛОЙ 1: Фон */}
      <div style={{ 
        ...styles.backgroundBlur, 
        backgroundImage: `url(${currentTrack.cover_url})`,
        filter: `blur(80px) brightness(${isDark ? '0.6' : '1.2'}) saturate(1.5)`,
        opacity: 0.8,
        animation: 'fadeIn 1s ease'
      }} />

      {/* СЛОЙ 2: Оверлей */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: isDark 
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.8) 100%)' 
            : 'linear-gradient(to bottom, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.7) 100%)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        zIndex: -1
      }} />
      
      <button onClick={onClose} style={styles.closeButton}>
        <X size={28} />
      </button>

      <div style={styles.contentContainer}>
        <div style={styles.topArea}>
            <div style={styles.visualStack}>
              {/* Слой с ОБЛОЖКОЙ */}
              <div 
                className="visual-layer"
                style={{ 
                  transform: showLyrics ? 'translateY(-110%)' : 'translateY(0)',
                  opacity: showLyrics ? 0 : 1,
                  pointerEvents: showLyrics ? 'none' : 'auto',
                }}
              >
                <div style={styles.coverView}>
                  <div onClick={() => setShowLyrics(true)} style={styles.arrowWrapper}>
                    <ChevronUp size={42} className="arrow-btn" />
                  </div>
                  
                  <div style={styles.coverContainer}>
                     <div style={styles.coverResponsiveBox}>
                        <img 
                            src={currentTrack.cover_url} 
                            style={{...styles.coverImg, position: 'absolute', filter: 'blur(30px) opacity(0.3)', transform: 'translateY(10px) scale(0.9)'}} 
                            alt="" 
                        />
                        <img 
                            src={currentTrack.cover_url} 
                            style={styles.coverImg} 
                            alt={currentTrack.title} 
                        />
                     </div>
                  </div>
                </div>
              </div>

              {/* Слой с ТЕКСТОМ */}
              <div 
                className="visual-layer"
                style={{ 
                  transform: showLyrics ? 'translateY(0)' : 'translateY(100%)',
                  opacity: showLyrics ? 1 : 0,
                  pointerEvents: showLyrics ? 'auto' : 'none'
                }}
              >
                <div style={styles.lyricsWrapperFull}>
                  <div style={styles.lyricsHeader}>
                    <button onClick={() => setShowLyrics(false)} style={styles.arrowWrapperLyrics}>
                      <ChevronDown size={42} className="arrow-btn" />
                    </button>
                  </div>
                  <div style={styles.lyricsBody}>
                    <LyricsView 
                      currentTrack={currentTrack} 
                      currentTime={currentTime} 
                      audioRef={audioRef}
                      isActive={showLyrics}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ИНФО О ТРЕКЕ */}
            <div style={styles.trackInfoWrapper}>
              <div style={{ flex: 1, overflow: 'hidden', paddingRight: '10px' }}>
                <h2 style={styles.title}>{currentTrack.title}</h2>
                <p style={styles.artist}>{currentTrack.artist}</p>
              </div>
              <Heart
                size={32}
                onClick={() => handleLike(currentTrack)}
                fill={isLiked ? "var(--accent-color)" : "none"}
                stroke={isLiked ? "var(--accent-color)" : "var(--text-primary)"}
                strokeWidth={2}
                style={{ 
                  cursor: 'pointer',
                  flexShrink: 0,
                  opacity: isLiked ? 1 : 0.7,
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
        </div>

        {/* НИЖНЯЯ ПАНЕЛЬ */}
        <div style={styles.bottomArea}>
          <div style={styles.progressWrapper}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              className="track-slider"
              onChange={(e) => {
                const val = Number(e.target.value);
                if (audioRef.current) { audioRef.current.currentTime = val; setCurrentTime(val); }
              }}
              style={{
                ...styles.rangeInput,
                background: `linear-gradient(to right, var(--accent-color) ${(currentTime / (duration || 1)) * 100}%, var(--progress-bg) ${(currentTime / (duration || 1)) * 100}%)`
              }}
            />
            <div style={styles.timeInfo}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div style={styles.mainControlsRow}>
            <div style={styles.controlsWrapper}>
              
              {/* ГРОМКОСТЬ В СТИЛЕ IOS */}
              <div 
                ref={volumeContainerRef}
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
              >
                {showVolumeBar && (
                  <div className="ios-volume-popover">
                    <div className="ios-volume-track">
                      <div className="ios-volume-fill" style={{ height: `${volume * 100}%` }} />
                      <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={volume} 
                        onChange={handleVolumeChange}
                        className="ios-volume-input"
                      />
                    </div>
                  </div>
                )}
                <Volume2 
                  size={24} 
                  onClick={toggleVolumeBar}
                  style={{ 
                    ...styles.controlIcon, 
                    color: showVolumeBar ? 'var(--accent-color)' : 'var(--text-primary)',
                    opacity: volume > 0 ? 0.8 : 0.3,
                    transition: 'all 0.2s ease',
                    transform: showVolumeBar ? 'scale(1.1)' : 'scale(1)'
                  }} 
                />
              </div>

              <Shuffle 
                size={22} 
                onClick={() => setIsShuffle(!isShuffle)} 
                style={{ color: isShuffle ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer', opacity: isShuffle ? 1 : 0.6 }} 
              />
              
              <SkipBack size={32} fill="currentColor" onClick={handlePrev} style={styles.controlIcon} />
              
              <div 
                  onClick={togglePlay} 
                  style={styles.playButton}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                  {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '4px' }} />}
              </div>
              
              <SkipForward size={32} fill="currentColor" onClick={handleNext} style={styles.controlIcon} />
              
              <div onClick={toggleRepeat} style={{ color: repeatMode !== 'none' ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer', opacity: repeatMode !== 'none' ? 1 : 0.6 }}>
                {repeatMode === 'one' ? <Repeat1 size={22} /> : <Repeat size={22} />}
              </div>

              <Share2 
                size={22} 
                onClick={handleShare}
                style={{ ...styles.controlIcon, opacity: 0.6 }} 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'var(--bg-color)', zIndex: 2000, padding: '20px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  backgroundBlur: {
    position: 'absolute', top: '-20%', left: '-20%', width: '140%', height: '140%',
    backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -2
  },
  closeButton: {
    position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', zIndex: 2001, cursor: 'pointer'
  },
  contentContainer: {
    display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '500px', margin: '0 auto', position: 'relative'
  },
  topArea: { 
    flex: 1, display: 'flex', flexDirection: 'column', marginTop: '10px', width: '100%', minHeight: 0
  },
  visualStack: { 
    flex: 1, position: 'relative', width: '100%', minHeight: 0 
  },
  coverView: { 
    height: '100%', display: 'flex', flexDirection: 'column', position: 'relative'
  },
  arrowWrapper: { 
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    cursor: 'pointer', background: 'none', border: 'none', zIndex: 10
  },
  arrowWrapperLyrics: {
    height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'none', border: 'none', flexShrink: 0
  },
  coverContainer: {
    flex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0,
    width: '100%',
    padding: '40px 0 20px 0', 
  },
  coverResponsiveBox: {
    width: '100%', 
    maxWidth: '85vw', 
    aspectRatio: '1/1',
    maxHeight: '100%', 
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: { 
    width: '100%', 
    height: '100%',
    borderRadius: '16px', 
    objectFit: 'cover', 
    boxShadow: '0 10px 30px rgba(0,0,0,0.3)', 
  },
  trackInfoWrapper: { 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
    padding: '10px 0', flexShrink: 0 
  },
  title: { fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  artist: { fontSize: '17px', color: 'var(--text-secondary)', margin: 0 },
  bottomArea: { padding: '10px 0 10px 0', flexShrink: 0 },
  progressWrapper: { width: '100%', marginBottom: '20px' },
  rangeInput: { width: '100%', height: '4px', appearance: 'none', borderRadius: '5px', outline: 'none' },
  timeInfo: { display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' },
  mainControlsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  controlsWrapper: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    width: '100%',
    maxWidth: '400px'
  },
  playButton: { 
    background: 'var(--accent-color)', color: '#fff', borderRadius: '50%', 
    width: '65px', height: '65px', display: 'flex', alignItems: 'center', justifyContent: 'center', 
    cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.2)', transition: 'transform 0.1s'
  },
  controlIcon: { color: 'var(--text-primary)', cursor: 'pointer' },
  lyricsWrapperFull: { height: '100%', display: 'flex', flexDirection: 'column' },
  lyricsHeader: { flexShrink: 0 },
  lyricsBody: { flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' },
  lyricsScroll: { 
    height: '100%', width: '100%', maxWidth: '400px', overflowY: 'auto', padding: '0 30px',
    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
  },
  lyricLine: { marginBottom: '25px', fontWeight: '800', textAlign: 'left' }
};

export default FullPlayer;