import React, { useState, useEffect } from 'react'; 
import { SkipBack, Play, Pause, SkipForward, Heart, AlignCenter } from 'lucide-react';

const AudioPlayer = ({
  currentTrack,
  audioRef,
  isPlaying: isPlayingProp,
  currentTime,
  setCurrentTime,
  duration,
  setDuration,
  handleNext,
  handlePrev,
  togglePlay,
  isMobile,
  isFullPlayerOpen,
  setIsFullPlayerOpen,
  loadingTrackId,
  handleLike,
  favoriteTrackIds,
  volume,
  setVolume,
  formatTime,
  backendBaseUrl,
}) => {
  // --- ЛОКАЛЬНАЯ СИНХРОНИЗАЦИЯ (Сердце плеера) ---
  const [localIsPlaying, setLocalIsPlaying] = useState(isPlayingProp);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncState = () => setLocalIsPlaying(!audio.paused);

    audio.addEventListener('play', syncState);
    audio.addEventListener('pause', syncState);
    audio.addEventListener('playing', syncState);

    setLocalIsPlaying(!audio.paused);

    return () => {
      audio.removeEventListener('play', syncState);
      audio.removeEventListener('pause', syncState);
      audio.removeEventListener('playing', syncState);
    };
  }, [audioRef, currentTrack]);

  useEffect(() => {
    setLocalIsPlaying(isPlayingProp);
  }, [isPlayingProp]);

  if (!currentTrack) return null;

  // Универсальный обработчик клика по Play/Pause
  const handleToggle = (e) => {
    e.stopPropagation();
    togglePlay();
    setLocalIsPlaying(!localIsPlaying);
  };

  const renderProgress = (progress) => (
    <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--text-primary)', transition: 'width 0.1s linear' }} />
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack.play_link || (currentTrack.file_id ? `${backendBaseUrl}/api/tracks/stream/${currentTrack.file_id}` : null)}
        playsInline
        preload="auto"
        autoPlay
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNext}
      />
      
      <style>{`
        @keyframes slideUpPlayer {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-player { animation: slideUpPlayer 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; will-change: transform; }
        .loader-spin { animation: spin 2s linear infinite; display: flex; align-items: center; justify-content: center; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        /* Стили для ползунков (Input Range) */
        .player-range { 
          appearance: none; 
          -webkit-appearance: none;
          outline: none; 
          border-radius: 2px;
          height: 4px;
        }
        .player-range::-webkit-slider-thumb { 
          appearance: none; 
          -webkit-appearance: none;
          width: 12px; 
          height: 12px; 
          background: var(--text-primary); 
          border-radius: 50%; 
          cursor: pointer;
          border: none;
          box-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        
        .icon-hover:hover { opacity: 0.8; transform: scale(1.05); }
        .icon-hover:active { transform: scale(0.95); }
      `}</style>

      {!isFullPlayerOpen && (
        <div className="animate-player" style={isMobile ? styles.mobileContainer : styles.desktopContainer}>
          {isMobile ? (
            /* --- MOBILE VIEW --- */
            <>
              <div style={styles.mobileProgressBar}>
                {renderProgress(currentTime / (duration || 1))}
              </div>

              <div onClick={() => setIsFullPlayerOpen(true)} style={styles.mobileTrackInfo}>
                <img src={currentTrack.cover_url} style={styles.mobileCover} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div style={styles.mobileTitle}>{currentTrack.title}</div>
                  <div style={styles.mobileArtist}>
                    {typeof currentTrack.artist === 'object' ? currentTrack.artist.name : currentTrack.artist}
                  </div>
                </div>
              </div>

              <div style={styles.mobileControls}>
                <SkipBack className="icon-hover" size={22} fill="currentColor" onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={styles.icon} />
                <div onClick={handleToggle} className="icon-hover" style={styles.icon}>
                  {loadingTrackId === currentTrack?.deezer_id ? (
                    <div className="loader-spin"><AlignCenter size={24} /></div>
                  ) : localIsPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                </div>
                <SkipForward className="icon-hover" size={22} fill="currentColor" onClick={(e) => { e.stopPropagation(); handleNext(); }} style={styles.icon} />
              </div>
            </>
          ) : (
            /* --- DESKTOP VIEW --- */
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '24px' }}>
              
              {/* Левая часть: Инфо */}
              <div onClick={() => setIsFullPlayerOpen(true)} style={styles.desktopTrackInfo}>
                <img src={currentTrack.cover_url} style={styles.desktopCover} alt="" />
                <div style={{ minWidth: 0 }}>
                  <div style={styles.desktopTitle}>{currentTrack.title}</div>
                  <div style={styles.desktopArtist}>
                    {typeof currentTrack.artist === 'object' ? currentTrack.artist.name : currentTrack.artist}
                  </div>
                </div>
              </div>

              {/* Центральная часть: Управление */}
              <div style={styles.desktopMainControls}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <SkipBack className="icon-hover" size={20} fill="currentColor" onClick={handlePrev} style={styles.icon} />
                  <div onClick={handleToggle} className="icon-hover" style={styles.icon}>
                    {loadingTrackId === currentTrack?.deezer_id ? (
                      <div className="loader-spin"><AlignCenter size={24} /></div>
                    ) : localIsPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" />}
                  </div>
                  <SkipForward className="icon-hover" size={20} fill="currentColor" onClick={handleNext} style={styles.icon} />
                </div>

                <div style={styles.desktopProgressRow}>
                  <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
                  <input
                    type="range" min="0" max={duration || 0} value={currentTime}
                    className="player-range"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (audioRef.current) audioRef.current.currentTime = val;
                      setCurrentTime(val);
                    }}
                    style={{
                      ...styles.desktopRange,
                      background: `linear-gradient(to right, var(--text-primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`
                    }}
                  />
                  <span style={styles.timeLabel}>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Правая часть: Доп. управление */}
              <div style={styles.desktopSideControls}>
                <Heart
                  className="icon-hover"
                  size={20} onClick={() => handleLike(currentTrack)}
                  fill={favoriteTrackIds.has(currentTrack.deezer_id) ? "var(--accent-color)" : "none"}
                  color={favoriteTrackIds.has(currentTrack.deezer_id) ? "var(--accent-color)" : "var(--text-primary)"}
                  style={styles.icon}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                   <input
                    type="range" min="0" max="1" step="0.01" value={volume}
                    className="player-range"
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setVolume(val);
                      if (audioRef.current) audioRef.current.volume = val;
                    }}
                    style={{
                      ...styles.volumeRange,
                      background: `linear-gradient(to right, var(--text-primary) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
const styles = {
  icon: { cursor: 'pointer' },
  mobileContainer: {
    position: 'fixed', bottom: '6px', left: '6px', right: '6px',
    background: 'var(--bg-surface)', borderRadius: '12px', padding: '8px 12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 10000,
    border: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  mobileProgressBar: { position: 'absolute', top: 0, left: '0', right: '0', height: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', borderRadius: '12px 12px 0 0' },
  mobileTrackInfo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' },
  mobileCover: { width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', marginTop: '4px' },
  mobileTitle: { fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' },
  mobileArtist: { fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  mobileControls: { display: 'flex', alignItems: 'center', gap: '16px', marginLeft: '10px', color: 'var(--text-primary)' },
  
  desktopContainer: {
    position: 'fixed', bottom: '6px', left: '6px', right: '6px',
    background: 'var(--bg-surface)', borderRadius: '12px', padding: '12px 16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 10000,
    border: '1px solid rgba(255,255,255,0.05)',
    color: 'var(--text-primary)'
  },
  desktopTrackInfo: { display: 'flex', alignItems: 'center', gap: '12px', flex: '0 1 25%', cursor: 'pointer' },
  desktopCover: { width: '45px', height: '45px', borderRadius: '5px', flexShrink: 0 },
  desktopTitle: { fontWeight: '600', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  desktopArtist: { fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  desktopMainControls: { flex: '1 1 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', maxWidth: '600px' },
  desktopProgressRow: { width: '100%', display: 'flex', alignItems: 'center', gap: '10px' },
  timeLabel: { fontSize: '12px', color: 'var(--text-secondary)', minWidth: '35px' },
  desktopRange: { flex: 1, height: '4px', cursor: 'pointer', appearance: 'none', outline: 'none', borderRadius: '2px' },
  desktopSideControls: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '16px', flex: '0 1 25%' },
  volumeRange: { width: '60px', height: '3px', appearance: 'none', outline: 'none', cursor: 'pointer' }
};

export default AudioPlayer;