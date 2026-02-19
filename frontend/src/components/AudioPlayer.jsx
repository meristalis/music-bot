import React from 'react';
import { Shuffle, SkipBack, Play, Pause, SkipForward, Repeat, Repeat1, Heart, AlignCenter } from 'lucide-react';

const AudioPlayer = ({
  currentTrack,
  audioRef,
  isPlaying,
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
  isShuffle,
  setIsShuffle,
  repeatMode,
  toggleRepeat,
  handleLike,
  favoriteTrackIds,
  volume,
  setVolume,
  formatTime,
  backendBaseUrl
}) => {
  if (!currentTrack) return null;

  if (isFullPlayerOpen) {
    return (
      <audio
        ref={audioRef}
        src={currentTrack.play_link || (currentTrack.file_id ? `${backendBaseUrl}/api/tracks/stream/${currentTrack.file_id}` : null)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNext}
        autoPlay
      />
    );
  }

  const renderProgress = (progress) => (
    <div style={{ height: '100%', width: `${progress * 100}%`, background: 'var(--text-primary)' }} />
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={currentTrack.play_link || (currentTrack.file_id ? `${backendBaseUrl}/api/tracks/stream/${currentTrack.file_id}` : null)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={handleNext}
        autoPlay
      />

      {isMobile ? (
        /* MOBILE MINI PLAYER */
        <div style={styles.mobileContainer}>
          <div style={styles.mobileProgressBar}>
            {renderProgress(currentTime / (duration || 1))}
          </div>

          <div onClick={() => setIsFullPlayerOpen(true)} style={styles.mobileTrackInfo}>
            <img src={currentTrack.cover_url} style={styles.mobileCover} alt="" />
            <div style={{ minWidth: 0 }}>
              <div style={styles.mobileTitle}>{currentTrack.title}</div>
              <div style={styles.mobileArtist}>{currentTrack.artist}</div>
            </div>
          </div>

          <div style={styles.mobileControls}>
            <Shuffle
              size={18}
              onClick={() => setIsShuffle(!isShuffle)}
              style={{ ...styles.icon, color: isShuffle ? 'var(--accent-color)' : 'var(--text-secondary)' }}
            />
            <SkipBack size={20} fill="currentColor" onClick={handlePrev} style={styles.icon} />
            <div onClick={togglePlay} style={styles.icon}>
              {loadingTrackId === currentTrack?.deezer_id ? (
                <div className="loader-spin"><AlignCenter size={24} /></div>
              ) : isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </div>
            <SkipForward size={20} fill="currentColor" onClick={handleNext} style={styles.icon} />
            <div onClick={toggleRepeat} style={{ ...styles.icon, color: repeatMode !== 'none' ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
              {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </div>
          </div>
        </div>
      ) : (
        /* DESKTOP PLAYER */
        <div style={styles.desktopContainer}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px' }}>
            <div onClick={() => setIsFullPlayerOpen(true)} style={styles.desktopTrackInfo}>
              <img src={currentTrack.cover_url} style={styles.desktopCover} alt="" />
              <div style={{ minWidth: 0 }}>
                <div style={styles.desktopTitle}>{currentTrack.title}</div>
                <div style={styles.desktopArtist}>{currentTrack.artist}</div>
              </div>
            </div>

            <div style={styles.desktopMainControls}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <SkipBack size={20} fill="currentColor" onClick={handlePrev} style={styles.icon} />
                <div onClick={togglePlay} style={styles.icon}>
                  {loadingTrackId === currentTrack?.deezer_id ? (
                    <div className="loader-spin"><AlignCenter size={24} /></div>
                  ) : isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </div>
                <SkipForward size={20} fill="currentColor" onClick={handleNext} style={styles.icon} />
              </div>

              <div style={styles.desktopProgressRow}>
                <span style={styles.timeLabel}>{formatTime(currentTime)}</span>
                <input
                  type="range" min="0" max={duration || 0} value={currentTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (audioRef.current) {
                      audioRef.current.currentTime = val;
                      setCurrentTime(val);
                    }
                  }}
                  style={{
                    ...styles.desktopRange,
                    background: `linear-gradient(to right, var(--text-primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTime / (duration || 1)) * 100}%)`
                  }}
                />
                <span style={styles.timeLabel}>{formatTime(duration)}</span>
              </div>
            </div>

            <div style={styles.desktopSideControls}>
              <Shuffle
                size={16} onClick={() => setIsShuffle(!isShuffle)}
                style={{ ...styles.icon, color: isShuffle ? 'var(--accent-color)' : 'var(--text-secondary)' }}
              />
              <div onClick={toggleRepeat} style={{ ...styles.icon, color: repeatMode !== 'none' ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
              </div>
              <Heart
                size={20} onClick={() => handleLike(currentTrack)}
                fill={favoriteTrackIds.has(currentTrack.deezer_id) ? "var(--accent-color)" : "none"}
                color={favoriteTrackIds.has(currentTrack.deezer_id) ? "var(--accent-color)" : "var(--text-primary)"}
                style={styles.icon}
              />
              <input
                type="range" min="0" max="1" step="0.01" value={volume}
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
    </>
  );
};

const styles = {
  icon: { cursor: 'pointer' },
  mobileContainer: {
    position: 'fixed', bottom: '6px', left: '6px', right: '6px',
    background: 'var(--bg-surface)', borderRadius: '12px', padding: '8px 12px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 1000,
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
    boxShadow: '0 8px 30px rgba(0,0,0,0.5)', zIndex: 1000,
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