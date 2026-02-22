import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Heart, Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, ChevronUp, Volume2, Share } from 'lucide-react';
import axios from 'axios';

// --- МЕМОИЗИРОВАННЫЙ ФОН (Чтобы не мигал при обновлении currentTime) ---
const PlayerBackground = React.memo(({ coverUrl }) => {
  return (
    <>
      <div style={{ 
        ...styles.backgroundBlur, 
        backgroundImage: `url(${coverUrl})`,
        filter: `blur(80px) brightness(var(--bg-brightness)) saturate(var(--bg-saturate))`,
        opacity: `var(--bg-blur-opacity)`,
        animation: 'fadeIn 1.2s ease-out'
      }} />
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: `var(--bg-overlay-gradient)`,
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        zIndex: -1
      }} />
    </>
  );
}, (prev, next) => prev.coverUrl === next.coverUrl);

// --- КОМПОНЕНТ ДЛЯ ТЕКСТА ---
const LyricsView = ({ currentTrack, currentTime, audioRef, isActive, onSwipeDownAtTop }) => {
  const [lyrics, setLyrics] = useState([]);
  const [isSynced, setIsSynced] = useState(false);
  const scrollRef = useRef(null);
  const touchStartRef = useRef(null);

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
            if (match) return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() };
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

  const handleTouchStart = (e) => { touchStartRef.current = e.touches[0].clientY; };
  const handleTouchMove = (e) => {
    if (!touchStartRef.current || !scrollRef.current) return;
    const diff = e.touches[0].clientY - touchStartRef.current;
    if (scrollRef.current.scrollTop <= 0 && diff > 50) {
      onSwipeDownAtTop();
      touchStartRef.current = null;
    }
  };

  return (
    <div style={styles.lyricsScroll} ref={scrollRef} className="no-scrollbar" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
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
  isOpen, currentTrack, onClose, isPlaying: isPlayingProp, togglePlay,
  currentTime, setCurrentTime, duration, formatTime,
  audioRef, handleNext, handlePrev, isShuffle, setIsShuffle,
  repeatMode, toggleRepeat, handleLike, favoriteTrackIds, onArtistClick,
  backendBaseUrl
}) => {
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlayingProp);
  const [showLyrics, setShowLyrics] = useState(false);
  const [volume, setVolume] = useState(1);
  const [showVolumeBar, setShowVolumeBar] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const volumeTimerRef = useRef(null);
  const volumeContainerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const lastVolumeUpdateRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const syncState = () => setLocalIsPlaying(!audio.paused);
    audio.addEventListener('play', syncState);
    audio.addEventListener('pause', syncState);
    return () => {
      audio.removeEventListener('play', syncState);
      audio.removeEventListener('pause', syncState);
    };
  }, [audioRef, currentTrack]);

  useEffect(() => { setLocalIsPlaying(isPlayingProp); }, [isPlayingProp]);
  useEffect(() => { if (!isOpen) setShowLyrics(false); }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showVolumeBar && volumeContainerRef.current && !volumeContainerRef.current.contains(e.target)) {
        setShowVolumeBar(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVolumeBar]);

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (Date.now() - lastVolumeUpdateRef.current > 50) {
      if (audioRef.current) audioRef.current.volume = newVol;
      lastVolumeUpdateRef.current = Date.now();
    }
    if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
    volumeTimerRef.current = setTimeout(() => setShowVolumeBar(false), 5000);
  };

  const handleTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping || showLyrics) return;
    setSwipeX(e.touches[0].clientX - touchStartRef.current.x);
  };

  const handleTouchEnd = (e) => {
    if (!isSwiping) return;
    setIsSwiping(false);
    const diffX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const diffY = touchStartRef.current.y - e.changedTouches[0].clientY;

    if (diffY > 50 && Math.abs(diffX) < 30 && !showLyrics) {
      setShowLyrics(true);
    } else if (!showLyrics) {
      if (diffX > 100) handlePrev();
      else if (diffX < -100) handleNext();
    }
    setSwipeX(0);
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    const tg = window.Telegram?.WebApp;
    const isTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');
    const shareUrl = isTelegram 
        ? `https://t.me/music_player_vufik_bot/play?startapp=${currentTrack.deezer_id}`
        : `${window.location.origin}${window.location.pathname}?track=${currentTrack.deezer_id}`;
    const shareText = `Послушай этот трек: ${currentTrack.artist} - ${currentTrack.title}`;

    if (isTelegram) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`);
    } else if (navigator.share) {
        try { await navigator.share({ title: currentTrack.title, text: shareText, url: shareUrl }); } catch {}
    } else {
        navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        alert('Ссылка скопирована!');
    }
  };

  if (!isOpen || !currentTrack) return null;
  const isLiked = favoriteTrackIds.has(currentTrack.deezer_id);

  return (
    <div className={`full-player-overlay ${isClosing ? 'closing' : ''}`} style={styles.overlay }>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .visual-layer { transition: transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease; position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; }
        .cover-layer-anim { transition: ${isSwiping ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease'}; }
        .lyric-line { transition: all 0.4s ease; cursor: pointer; color: var(--text-primary); }
        .lyric-line.active { color: var(--text-primary); text-shadow: 0 0 15px var(--lyric-shadow); }
        .header-btn { color: var(--text-primary); opacity: 0.8; cursor: pointer; transition: all 0.2s; }
        .header-btn:active { transform: scale(0.9); }
        .track-slider { -webkit-appearance: none; width: 100%; height: 5px; border-radius: 10px; outline: none; background: transparent; cursor: pointer; }
        .track-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; opacity: 0.01; }
        .ios-volume-popover { position: absolute; top: 45px; left: 0; background: rgba(255, 255, 255, 0.25); backdrop-filter: blur(25px); width: 36px; height: 140px; border-radius: 10px; overflow: hidden; animation: slideDown 0.2s ease-out; z-index: 100; }
        .ios-volume-track { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column-reverse; }
        .ios-volume-fill { width: 100%; background: #fff; transition: height 0.1s ease-out; }
        .ios-volume-input { position: absolute; top: 0; left: 0; width: 140px; height: 36px; appearance: none; background: transparent; transform: rotate(-90deg) translateX(-140px); transform-origin: top left; cursor: pointer; z-index: 5; outline: none; }
        .full-player-overlay { animation: slideInUp 0.5s cubic-bezier(0.32, 0.72, 0, 1); will-change: transform; }
        @keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* МЕМОИЗИРОВАННЫЙ ФОН */}
      <PlayerBackground coverUrl={currentTrack.cover_url} />
      
      <div style={styles.headerRow}>
        <div ref={volumeContainerRef} style={{ position: 'relative' }} className="icon-center">
          <Volume2 size={28} onClick={() => setShowVolumeBar(!showVolumeBar)} className="header-btn" />
          {showVolumeBar && (
            <div className="ios-volume-popover">
              <div className="ios-volume-track">
                <div className="ios-volume-fill" style={{ height: `${volume * 100}%` }} />
                <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} className="ios-volume-input" />
              </div>
            </div>
          )}
        </div>
        <div className="icon-center" onClick={() => setShowLyrics(!showLyrics)}>
          <ChevronUp size={36} className={`header-btn ${showLyrics ? 'lyrics-toggle-rotated' : ''}`} style={{ transform: showLyrics ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
        </div>
        <button onClick={() => { setIsClosing(true); setTimeout(onClose, 500); }} style={styles.closeButton} className="icon-center">
          <X size={32} className="header-btn" />
        </button>
      </div>

      <div style={styles.contentContainer}>
        <div style={styles.topArea}>
          <div style={styles.visualStack} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
            <div className="visual-layer cover-layer-anim" style={{ transform: showLyrics ? 'translateY(-110%)' : `translateX(${swipeX}px) rotate(${swipeX * 0.05}deg)`, opacity: showLyrics ? 0 : 1 }}>
              <div style={styles.coverView}>
                <div style={styles.coverContainer}>
                  <div style={styles.coverResponsiveBox}>
                    <img src={currentTrack.cover_url} style={{ ...styles.coverImg, boxShadow: `var(--cover-shadow)`, transform: `scale(${1 - Math.abs(swipeX) / 2000})` }} alt={currentTrack.title} />
                    <button onClick={handleShare} style={styles.shareOnCover} className="icon-center"><Share size={20} style={{ transform: 'scaleX(-1)' }} /></button>
                  </div>
                </div>
              </div>
            </div>
            <div className="visual-layer" style={{ transform: showLyrics ? 'translateY(0)' : 'translateY(110%)', opacity: showLyrics ? 1 : 0, pointerEvents: showLyrics ? 'auto' : 'none' }}>
              <div style={styles.lyricsWrapperFull}><div style={styles.lyricsBody}>
                <LyricsView currentTrack={currentTrack} currentTime={currentTime} audioRef={audioRef} isActive={showLyrics} onSwipeDownAtTop={() => setShowLyrics(false)} />
              </div></div>
            </div>
          </div>

          <div style={styles.trackInfoWrapper}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <h2 style={styles.title}>{currentTrack.title}</h2>
              <p style={styles.artist} className="artist-clickable" onClick={() => onArtistClick?.(currentTrack.artist_id || currentTrack.artist?.id)}>{typeof currentTrack.artist === 'object' ? currentTrack.artist.name : currentTrack.artist}</p>
            </div>
            <Heart size={32} onClick={() => handleLike(currentTrack)} fill={isLiked ? "var(--accent-color)" : "none"} stroke={isLiked ? "var(--accent-color)" : "var(--text-primary)"} style={{ cursor: 'pointer', transition: 'all 0.3s' }} />
          </div>
        </div>

        <div style={styles.bottomArea}>
          <div style={styles.progressWrapper}>
            <input type="range" min="0" max={duration || 0} value={currentTime} step="1" className="track-slider" 
              onInput={(e) => setCurrentTime(Number(e.target.value))} 
              onChange={(e) => { audioRef.current.currentTime = Number(e.target.value); }}
              style={{ background: `linear-gradient(to right, var(--accent-color) 0%, var(--accent-color) ${(currentTime / (duration || 1)) * 100}%, rgba(200, 200, 200, 0.2) 0%)` }} 
            />
            <div style={styles.timeInfo}><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
          </div>
          <div style={styles.mainControlsRow}>
            <div style={styles.controlsWrapper}>
              <Shuffle size="24px" onClick={() => setIsShuffle(!isShuffle)} style={{ color: isShuffle ? 'var(--accent-color)' : 'var(--text-primary)', opacity: isShuffle ? 1 : 0.6 }} />
              <SkipBack size="42px" fill="currentColor" onClick={handlePrev} />
              <div onClick={() => { togglePlay(); setLocalIsPlaying(!localIsPlaying); }} style={styles.playButtonRaw} className="icon-center">
                {localIsPlaying ? <Pause size="75" fill="currentColor" /> : <Play size="75" fill="currentColor" />}
              </div>
              <SkipForward size="42px" fill="currentColor" onClick={handleNext} />
              <div onClick={toggleRepeat}>{repeatMode === 'one' ? <Repeat1 size="26px" color="var(--accent-color)" /> : <Repeat size="26px" style={{ opacity: repeatMode !== 'none' ? 1 : 0.6 }} />}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--bg-color)', zIndex: 2000, padding: '1.5vh 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', zIndex: 2001, padding: '15px 10px' },
  backgroundBlur: { position: 'absolute', top: '-15%', left: '-15%', width: '130%', height: '130%', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: -2, willChange: 'filter' },
  closeButton: { background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' },
  contentContainer: { display: 'flex', flexDirection: 'column', height: '100%', width: '100%', maxWidth: '500px', margin: '0 auto', position: 'relative' },
  topArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0 },
  visualStack: { flex: 1, position: 'relative', touchAction: 'none' },
  coverView: { height: '100%', display: 'flex', flexDirection: 'column' },
  coverContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  coverResponsiveBox: { width: '100%', maxWidth: '85vw', aspectRatio: '1/1', position: 'relative' },
  coverImg: { width: '100%', height: '100%', borderRadius: '24px', objectFit: 'cover' },
  shareOnCover: { position: 'absolute', top: '15px', right: '15px', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', border: 'none', color: '#fff', borderRadius: '50%', width: '40px', height: '40px' },
  trackInfoWrapper: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1vh 0' },
  title: { fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: '800', margin: '0 0 4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  artist: { fontSize: 'clamp(16px, 4.5vw, 20px)', color: 'var(--text-secondary)', margin: 0 },
  bottomArea: { padding: '1vh 0 4vh 0' },
  progressWrapper: { width: '100%', marginBottom: '2vh' },
  timeInfo: { display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '13px', fontWeight: '500' },
  mainControlsRow: { display: 'flex', justifyContent: 'center', width: '100%' },
  controlsWrapper: { display: 'flex', alignItems: 'center', gap: '20px' },
  playButtonRaw: { cursor: 'pointer', opacity: 0.9 },
  lyricsWrapperFull: { height: '100%', display: 'flex', flexDirection: 'column' },
  lyricsBody: { flex: 1, display: 'flex', justifyContent: 'center' },
  lyricsScroll: { height: '100%', width: '100%', overflowY: 'auto', padding: '0 20px', maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' },
  lyricLine: { marginBottom: '25px', fontWeight: '800', textAlign: 'left', lineHeight: '1.2' }
};

export default FullPlayer;