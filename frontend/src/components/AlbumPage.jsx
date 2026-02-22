import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TrackItem, { TracksContainer } from './TrackItem';

const AlbumPage = ({ 
  albumId, backendBaseUrl, onBack, onTrackSelect, 
  currentTrack, isPlaying, pendingTracks, now 
}) => {
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!albumId) return;
      setLoading(true);
      try {
        const res = await axios.get(`${backendBaseUrl}/api/album/${albumId}`);
        setAlbum(res.data);
      } catch (err) {
        console.error("Failed to fetch album data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAlbumData();
  }, [albumId, backendBaseUrl]);

  if (loading) return (
    <div style={{ 
      position: 'fixed', inset: 0, display: 'flex', 
      justifyContent: 'center', alignItems: 'center', 
      background: 'var(--bg-color)',
      color: 'var(--text-secondary)' 
    }}>
      Загрузка альбома...
    </div>
  );
  
  if (!album) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-color)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: '85px' // Место для плеера
    }}>
      
      {/* Кнопка закрытия */}
      <button 
        onClick={onBack}
        style={{
          position: 'absolute', top: '15px', right: '15px',
          background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(10px)',
          border: 'none', color: 'white', width: '36px', height: '36px',
          borderRadius: '50%', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', cursor: 'pointer', zIndex: 100
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      {/* Основной скролл-контейнер */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '0 16px'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Шапка альбома (Герой) */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            padding: '40px 0 24px',
            gap: '16px'
          }}>
            <img 
              src={album.cover_medium} 
              alt={album.title} 
              style={{
                width: '180px',
                height: '180px',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                objectFit: 'cover'
              }} 
            />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 4px', color: 'var(--text-primary)' }}>
                {album.title}
              </h1>
              <p style={{ fontSize: '16px', color: 'var(--accent-color)', fontWeight: '600', margin: '0 0 4px' }}>
                {album.artist?.name}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {album.release_date?.split('-')[0]} • {album.nb_tracks} треков
              </p>
            </div>
          </div>

          {/* Список треков */}
          <TracksContainer>
            {album.tracks?.data?.map((track, index) => (
              <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ 
                  width: '24px', 
                  fontSize: '13px', 
                  color: 'var(--text-secondary)', 
                  textAlign: 'right',
                  flexShrink: 0 
                }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <TrackItem 
                    track={{
                      ...track,
                      deezer_id: track.id,
                      artist: album.artist?.name, 
                      cover_url: album.cover_small || album.cover_medium
                    }}
                    isActive={currentTrack?.deezer_id === track.id}
                    isPlaying={isPlaying}
                    pendingData={pendingTracks[track.id]}
                    now={now}
                    onClick={onTrackSelect}
                  />
                </div>
              </div>
            ))}
          </TracksContainer>
          
        </div>
      </div>
    </div>
  );
};

export default AlbumPage;