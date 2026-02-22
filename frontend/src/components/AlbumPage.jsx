import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TrackItem from './TrackItem';

const AlbumPage = ({ 
  albumId, 
  backendBaseUrl, 
  onBack, 
  onTrackSelect, 
  currentTrack, 
  isPlaying, 
  pendingTracks, 
  now 
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
    <div style={{ position: 'fixed', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', zIndex: 1000 }}>
      <div style={{ color: 'var(--text-secondary)' }}>Загрузка альбома...</div>
    </div>
  );
  
  if (!album) return null;

  return (
    <div className="album-page-container">
      {/* Кнопка теперь вне потока скролла, чтобы быть всегда сверху */}
      <button className="close-album-btn" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>

      <div className="album-scroll-content">
        <div className="album-header">
          <div className="album-info-hero">
            <img src={album.cover_medium} alt={album.title} className="album-cover-main" />
            <div className="album-meta">
              <h1 className="album-title-main">{album.title}</h1>
              <p className="album-artist-name">{album.artist?.name}</p>
              <p className="album-release-info">
                  {album.release_date?.split('-')[0]} • {album.nb_tracks} треков
              </p>
            </div>
          </div>
        </div>

        <div className="album-tracks-list">
          {album.tracks?.data?.map((track, index) => (
            <div key={track.id} className="album-track-row">
              <span className="track-number">{index + 1}</span>
              <div style={{ flex: 1 }}>
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
        </div>
      </div>

      <style>{`
        .album-page-container {
          position: fixed; 
          inset: 0;
          background: var(--bg-color); 
          z-index: 999; 
        }

        /* Обертка для скролла с твоим стилем */
        .album-scroll-content {
          width: 100%;
          height: 100%;
          overflow-y: auto;
          padding-bottom: 150px;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        /* Твой стиль скроллбара */
        .album-scroll-content::-webkit-scrollbar {
          width: 6px;
        }
        .album-scroll-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .album-scroll-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .album-scroll-content:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
        }

        @media (hover: none) {
          .album-scroll-content::-webkit-scrollbar { display: none; }
        }

        .close-album-btn {
          position: absolute; 
          top: 20px; 
          right: 16px;
          background: rgba(0, 0, 0, 0.4); 
          backdrop-filter: blur(8px);
          border: none; 
          color: white; 
          width: 36px; 
          height: 36px; 
          border-radius: 50%;
          display: flex; 
          align-items: center; 
          justify-content: center;
          cursor: pointer; 
          z-index: 1010; /* Выше скролла */
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .album-header {
          padding: 80px 20px 24px;
          background: linear-gradient(to bottom, rgba(var(--accent-rgb), 0.2), var(--bg-color));
        }

        .album-info-hero { display: flex; gap: 20px; align-items: flex-end; }
        .album-cover-main {
          width: 120px; height: 120px; border-radius: 8px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .album-title-main { font-size: 24px; font-weight: 800; margin: 0; color: white; }
        .album-artist-name { font-size: 16px; color: var(--accent-color); font-weight: 600; margin: 6px 0; }
        .album-release-info { font-size: 12px; color: var(--text-secondary); margin: 0; }
        
        .album-tracks-list { padding: 0 16px; }
        .album-track-row { display: flex; align-items: center; margin-bottom: 2px; }
        .track-number { width: 28px; color: var(--text-secondary); font-size: 13px; text-align: left; flex-shrink: 0; }
      `}</style>
    </div>
  );
};

export default AlbumPage;