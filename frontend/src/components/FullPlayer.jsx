import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ChevronUp, ChevronDown } from 'lucide-react';

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

  useEffect(() => { 
    if (!isOpen) setShowLyrics(false); 
  }, [isOpen, currentTrack]);

  if (!isOpen || !currentTrack) return null;

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        .visual-layer {
          transition: transform 0.6s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.5s ease;
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
        }

        .lyric-line { transition: all 0.4s ease; cursor: pointer; color: var(--text-primary); }
        .lyric-line.active { color: var(--text-primary); text-shadow: 0 0 10px rgba(255,255,255,0.3); }

        .arrow-btn {
          transition: transform 0.2s ease;
          opacity: 0.5;
        }
        .arrow-btn:hover { transform: scale(1.1); opacity: 1; }
      `}</style>

      <div style={{ ...styles.backgroundBlur, backgroundImage: `url(${currentTrack.cover_url})` }} />
      
      <button onClick={onClose} style={styles.closeButton}>
        <X size={28} />
      </button>

      <div style={styles.contentContainer}>
        <div style={styles.topArea}>
            <div style={styles.visualStack}>
              
              <div 
                className="visual-layer"
                style={{ 
                  transform: showLyrics ? 'translateY(-110%)' : 'translateY(0)',
                  opacity: showLyrics ? 0 : 1,
                  pointerEvents: showLyrics ? 'none' : 'auto'
                }}
              >
                <div style={styles.coverView}>
                  <div onClick={() => setShowLyrics(true)} className="arrow-btn" style={styles.arrowWrapper}>
                    <ChevronUp size={42} />
                  </div>
                  <div style={styles.coverWrapper}>
                    <img src={currentTrack.cover_url} style={styles.coverImg} alt={currentTrack.title} />
                  </div>
                </div>
              </div>

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
                    <button onClick={() => setShowLyrics(false)} className="arrow-btn" style={styles.arrowWrapper}>
                      <ChevronDown size={42} />
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

            <div style={styles.trackInfoWrapper}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <h2 style={styles.title}>{currentTrack.title}</h2>
                <p style={styles.artist}>{currentTrack.artist}</p>
              </div>
              <Heart
  size={32}
  onClick={() => handleLike(currentTrack)}
  // Заливка цветом #ff4d4d, если трек в избранном
  fill={favoriteTrackIds.has(currentTrack.deezer_id) ? "#ff4d4d" : "none"}
  // Контур цветом #ff4d4d, если трек в избранном, иначе — основной цвет текста
  color={favoriteTrackIds.has(currentTrack.deezer_id) ? "#ff4d4d" : "var(--text-primary)"}
  style={{ 
    cursor: 'pointer',
    marginLeft: '10px',
    marginRight: '4px',
    flexShrink: 0
  }}
/>
            </div>
        </div>

        <div style={styles.bottomArea}>
          <div style={styles.progressWrapper}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (audioRef.current) { audioRef.current.currentTime = val; setCurrentTime(val); }
              }}
              style={{
                ...styles.rangeInput,
                background: `linear-gradient(to right, var(--text-primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`
              }}
            />
            <div style={styles.timeInfo}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div style={styles.controlsWrapper}>
            <Shuffle size={24} onClick={() => setIsShuffle(!isShuffle)} style={{ color: isShuffle ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer' }} />
            <SkipBack size={32} fill="currentColor" onClick={handlePrev} style={styles.controlIcon} />
            <div onClick={togglePlay} style={styles.playButton}>
              {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" style={{ marginLeft: '3px' }} />}
            </div>
            <SkipForward size={32} fill="currentColor" onClick={handleNext} style={styles.controlIcon} />
            <div onClick={toggleRepeat} style={{ color: repeatMode !== 'none' ? 'var(--accent-color)' : 'var(--text-primary)', cursor: 'pointer' }}>
              {repeatMode === 'one' ? <Repeat1 size={24} /> : <Repeat size={24} />}
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
    background: 'var(--bg-black)', zIndex: 2000, padding: '20px',
    display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'slideUp 0.3s ease-out'
  },
  backgroundBlur: {
    position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%',
    backgroundSize: 'cover', backgroundPosition: 'center',
    filter: 'blur(60px) brightness(0.25)', zIndex: -1
  },
  closeButton: {
    position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--text-secondary)', zIndex: 2001, cursor: 'pointer'
  },
  contentContainer: {
    display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '500px', margin: '0 auto', position: 'relative'
  },
  topArea: { 
    flex: 1, 
    display: 'flex',
    flexDirection: 'column',
    marginTop: '40px',
    width: '100%',
    position: 'relative',
    overflow: 'hidden'
  },
  visualStack: {
    flex: 1,
    position: 'relative',
    width: '100%',
  },
  arrowWrapper: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'var(--text-primary)',
    background: 'none',
    border: 'none'
  },
  coverView: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  coverWrapper: { 
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: '20px'
  },
  coverImg: { 
    width: '100%', 
    aspectRatio: '1/1',
    borderRadius: '16px', 
    objectFit: 'cover',
  },
  lyricsWrapperFull: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  lyricsHeader: {
    height: '60px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricsBody: {
    flex: 1,
    padding: '2vh 0',
    overflow: 'hidden',
  },
  trackInfoWrapper: { 
    width: '100%', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: '15px 5px',
    background: 'transparent',
    zIndex: 10,
  },
  title: { fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0' },
  artist: { fontSize: '18px', color: 'var(--text-secondary)', margin: 0 },
  bottomArea: { padding: '10px 0 20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  progressWrapper: { width: '100%', marginBottom: '30px' },
  rangeInput: { width: '100%', height: '4px', appearance: 'none', borderRadius: '5px', outline: 'none' },
  timeInfo: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' },
  controlsWrapper: { display: 'flex', alignItems: 'center', gap: '35px' },
  playButton: { background: 'var(--text-primary)', color: 'var(--bg-black)', borderRadius: '50%', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  controlIcon: { color: 'var(--text-primary)', cursor: 'pointer' },
  lyricsScroll: { 
    height: '100%', width: '100%', overflowY: 'auto',padding: '0 20px 0px 30px',
    maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)',
    WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)'
  },
  lyricLine: { 
    marginBottom: '32px', 
    fontWeight: '900', 
    lineHeight: '1.3',
    letterSpacing: '-1px',
    paddingRight: '40px',
    boxSizing: 'border-box', 
    display: 'block',
    wordBreak: 'break-word',
    textAlign: 'left'
  }
};

export default FullPlayer;  