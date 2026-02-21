import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ChevronUp, ChevronDown, Volume2, Share } from 'lucide-react';

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
  const volumeContainerRef = useRef(null);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const lastVolumeUpdateRef = useRef(0);

  useEffect(() => { 
    if (!isOpen) setShowLyrics(false); 
  }, [isOpen, currentTrack]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showVolumeBar && volumeContainerRef.current && !volumeContainerRef.current.contains(event.target)) {
        setShowVolumeBar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeBar]);

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    const now = Date.now();
    setVolume(newVol);
    if (now - lastVolumeUpdateRef.current > 50) {
      if (audioRef.current) {
        audioRef.current.volume = newVol;
      }
      lastVolumeUpdateRef.current = now;
    }
    resetVolumeTimer();
  };

  const resetVolumeTimer = () => {
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolumeBar(false), 5000);
  };

  const toggleVolumeBar = (e) => {
    e.stopPropagation();
    setShowVolumeBar(!showVolumeBar);
    if (!showVolumeBar) resetVolumeTimer();
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const tg = window.Telegram?.WebApp;
    const isTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');
    const botUsername = 'music_player_vufik_bot';
    const appShortName = 'play'; 
    
    const shareUrl = isTelegram 
        ? `https://t.me/${botUsername}/${appShortName}?startapp=${currentTrack.deezer_id}`
        : `${window.location.origin}${window.location.pathname}?track=${currentTrack.deezer_id}`;
    
    const shareText = `Послушай этот трек: ${currentTrack.artist} - ${currentTrack.title}`;

    if (isTelegram) {
        const tgLink = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        tg.openTelegramLink(tgLink);
        if (tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    } else {
        if (navigator.share) {
            try {
                await navigator.share({ title: currentTrack.title, text: shareText, url: shareUrl });
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
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        
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

        .header-btn {
          color: var(--text-primary);
          opacity: 0.8;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }
        .header-btn:active { transform: scale(0.9); }

        .ios-volume-popover {
          position: absolute;
          top: 45px;
          left: 0;
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(25px);
          -webkit-backdrop-filter: blur(25px);
          width: 36px;
          height: 140px;
          border-radius: 10px;
          overflow: hidden;
          animation: slideDown 0.2s ease-out;
          z-index: 100;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.2);
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
          width: 140px;
          height: 36px;
          appearance: none;
          -webkit-appearance: none;
          background: transparent;
          transform: rotate(-90deg) translateX(-140px);
          transform-origin: top left;
          cursor: pointer;
          margin: 0;
          z-index: 5;
        }

        /* ... ваши существующие стили ... */

.track-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px; /* Чуть увеличим высоту для удобства */
  border-radius: 10px;
  background: var(--progress-bg);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  position: relative;
}

/* Стили для Chrome, Safari, Edge */
.track-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  width: 14px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--accent-color); /* Кольцо вокруг белой точки */
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s;
  opacity: 0; /* Скрываем в обычном состоянии */
}

/* Показываем ползунок при наведении на весь контейнер или при активном использовании */
.progress-wrapper:hover .track-slider::-webkit-slider-thumb,
.track-slider:active::-webkit-slider-thumb {
  opacity: 1;
  transform: scale(1.2);
}

/* Стили для Firefox */
.track-slider::-moz-range-thumb {
  height: 14px;
  width: 14px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--accent-color);
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  border: none;
  opacity: 0;
  transition: transform 0.2s ease, opacity 0.2s;
}

.progress-wrapper:hover .track-slider::-moz-range-thumb,
.track-slider:active::-moz-range-thumb {
  opacity: 1;
  transform: scale(1.2);
}

        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        .icon-center {
          display: flex;
          align-items: center;
          justify-content: center;
          outline: none !important;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>

      {/* ФОН */}
 <div style={{ 
  ...styles.backgroundBlur, 
  backgroundImage: `url(${currentTrack.cover_url})`,
  filter: `blur(80px) brightness(var(--bg-brightness)) saturate(var(--bg-saturate))`,
  opacity: `var(--bg-blur-opacity)`,
  animation: 'fadeIn 1s ease'
}} />

<div style={{
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  background: `var(--bg-overlay-gradient)`, // Градиент тоже из CSS
  backdropFilter: 'blur(30px)',
  WebkitBackdropFilter: 'blur(30px)',
  zIndex: -1
}} />
      
      {/* ВЕРХНЯЯ ПАНЕЛЬ С КНОПКАМИ (Громкость, Текст, Закрыть) */}
      <div style={styles.headerRow}>
        <div ref={volumeContainerRef} style={{ position: 'relative' }} className="icon-center">
            <Volume2 
                size={28} 
                onClick={toggleVolumeBar}
                className="header-btn"
                style={{ opacity: showVolumeBar ? 1 : 0.7 }} 
            />
            {showVolumeBar && (
                <div className="ios-volume-popover">
                    <div className="ios-volume-track">
                        <div className="ios-volume-fill" style={{ height: `${volume * 100}%` }} />
                        <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="ios-volume-input" />
                    </div>
                </div>
            )}
        </div>

        {/* НОВАЯ КНОПКА ПЕРЕКЛЮЧЕНИЯ ТЕКСТА */}
        <div className="icon-center" onClick={() => setShowLyrics(!showLyrics)}>
             {showLyrics ? (
                 <ChevronDown size={36} className="header-btn" />
             ) : (
                 <ChevronUp size={36} className="header-btn" />
             )}
        </div>

        <button onClick={onClose} style={styles.closeButton} className="icon-center">
            <X size={32} className="header-btn" />
        </button>
      </div>

      <div style={styles.contentContainer}>
        <div style={styles.topArea}>
            <div style={styles.visualStack}>
              {/* СЛОЙ ОБЛОЖКИ — без теней и лишних слоев */}
<div 
  className="visual-layer"
  style={{ 
    transform: showLyrics ? 'translateY(-110%)' : 'translateY(0)',
    opacity: showLyrics ? 0 : 1,
    pointerEvents: showLyrics ? 'none' : 'auto',
  }}
>
  <div style={styles.coverView}>
    <div style={styles.coverContainer}>
       <div style={styles.coverResponsiveBox}>
          {/* Мы удалили вторую картинку с блюром, которая была тут */}
          <img 
             src={currentTrack.cover_url} 
    style={{
      ...styles.coverImg,
      boxShadow: `var(--cover-shadow)`, // Тень теперь зависит от темы
    }} 
    alt={currentTrack.title}
          />
          <button onClick={handleShare} style={styles.shareOnCover} className="icon-center">
              <Share size={20} style={{ transform: 'scaleX(-1)' }} />
          </button>
       </div>
    </div>
  </div>
</div>

              {/* СЛОЙ ТЕКСТА */}
              <div 
                className="visual-layer"
                style={{ 
                  transform: showLyrics ? 'translateY(0)' : 'translateY(110%)',
                  opacity: showLyrics ? 1 : 0,
                  pointerEvents: showLyrics ? 'auto' : 'none'
                }}
              >
                <div style={styles.lyricsWrapperFull}>
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

            <div style={styles.trackInfoWrapper}>
              <div style={{ flex: 1, overflow: 'hidden', paddingRight: '15px' }}>
                <h2 style={styles.title}>{currentTrack.title}</h2>
                <p style={styles.artist}>{currentTrack.artist}</p>
              </div>
              <div className="icon-center" style={{ width: 42, height: 42 }}>
                <Heart
                  size={32}
                  onClick={() => handleLike(currentTrack)}
                  fill={isLiked ? "var(--accent-color)" : "none"}
                  stroke={isLiked ? "var(--accent-color)" : "var(--text-primary)"}
                  strokeWidth={2}
                  style={{ 
                    cursor: 'pointer',
                    opacity: isLiked ? 1 : 0.8,
                    transition: 'all 0.3s ease',
                    display: 'block'
                  }}
                />
              </div>
            </div>
        </div>

        <div style={styles.bottomArea}>
          <div style={styles.progressWrapper} className="progress-wrapper">
    <input
      type="range"
      min="0"
      max={duration || 0}
      value={currentTime}
      className="track-slider"
      onChange={(e) => {
        const val = Number(e.target.value);
        if (audioRef.current) { 
          audioRef.current.currentTime = val; 
          setCurrentTime(val); 
        }
      }}
      style={{
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
              <div className="icon-center" style={styles.sideControlBox}>
                <Shuffle 
                  size="24px" 
                  onClick={() => setIsShuffle(!isShuffle)} 
                  style={{ color: isShuffle ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer', opacity: isShuffle ? 1 : 0.6 }} 
                />
              </div>
              
              <div className="icon-center" style={styles.stepControlBox}>
                <SkipBack size="42px" fill="currentColor" onClick={handlePrev} style={styles.controlIcon} />
              </div>
              
              <div className="icon-center" style={styles.playControlBox}>
                <div onClick={togglePlay} style={styles.playButtonRaw} className="icon-center">
                    {isPlaying ? <Pause size="75" fill="currentColor" stroke="none" /> : <Play size="75" fill="currentColor" stroke="none" />}
                </div>
              </div>
              
              <div className="icon-center" style={styles.stepControlBox}>
                <SkipForward size="42px" fill="currentColor" onClick={handleNext} style={styles.controlIcon} />
              </div>
              
              <div className="icon-center" onClick={toggleRepeat} style={{ ...styles.sideControlBox, color: repeatMode !== 'none' ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer', opacity: repeatMode !== 'none' ? 1 : 0.6 }}>
                {repeatMode === 'one' ? <Repeat1 size="26px" /> : <Repeat size="26px" />}
              </div>
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
    background: 'var(--bg-color)', zIndex: 2000, padding: '1.5vh 20px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden'
  },
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', zIndex: 2001, padding: '15px 10px',
  },
  backgroundBlur: {
    position: 'absolute', top: '-15%', left: '-15%', width: '130%', height: '130%',
    backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -2
  },
  closeButton: {
    background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
  },
  contentContainer: {
    display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '500px', margin: '0 auto', position: 'relative',padding: '15px 10px'
  },
  topArea: { 
    flex: 1, display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0,gap: '20px'
  },
  visualStack: { 
    flex: 1, position: 'relative', width: '100%', minHeight: 0 
  },
  coverView: { 
    height: '100%', display: 'flex', flexDirection: 'column', position: 'relative'
  },
  coverContainer: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', minHeight: 0
  },
  coverResponsiveBox: {
    width: '100%', maxWidth: '85vw', aspectRatio: '1/1', maxHeight: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  coverImg: { 
    width: '100%', height: '100%', borderRadius: '24px', objectFit: 'cover', 
  },
  shareOnCover: {
    position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', zIndex: 5, outline: 'none'
  },
  trackInfoWrapper: { 
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1vh 0', flexShrink: 0 
  },
  title: { fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  artist: { fontSize: 'clamp(16px, 4.5vw, 20px)', color: 'var(--text-secondary)', margin: 0, opacity: 0.8 },
  bottomArea: { padding: '1vh 0 4vh 0', flexShrink: 0 },
  progressWrapper: { width: '100%', marginBottom: '2vh' },
  rangeInput: { width: '100%', height: '4px', appearance: 'none', borderRadius: '5px', outline: 'none' },
  timeInfo: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' },
  mainControlsRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%'
  },
  controlsWrapper: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: '12px',              
    width: '100%'
  },
  sideControlBox: { width: '40px' },
  stepControlBox: { width: '60px' },
  playControlBox: { width: '80px' },
  playButtonRaw: { 
    color: 'var(--text-primary)', cursor: 'pointer', transition: 'transform 0.1s', border: 'none', background: 'none', padding: 0, outline: 'none', opacity: 0.9
  },
  controlIcon: { 
    color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s ease', display: 'block', outline: 'none', opacity: 0.95
  },
  lyricsWrapperFull: { height: '100%', display: 'flex', flexDirection: 'column' },
  lyricsBody: { flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' },
  lyricsScroll: { 
    height: '100%', width: '100%', maxWidth: '400px', overflowY: 'auto', padding: '0 20px',
    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
  },
  lyricLine: { marginBottom: '25px', fontWeight: '800', textAlign: 'left', lineHeight: '1.2' }
};

export default FullPlayer;