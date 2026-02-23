import React, { useState, useEffect, useMemo } from 'react';
import { X } from 'lucide-react'; 
import axios from 'axios';
import TrackItem, { TracksContainer } from './TrackItem';

const AlbumPage = ({ 
  albumId, backendBaseUrl, onBack, onTrackSelect, 
  currentTrack, isPlaying, pendingTracks, now 
}) => {
  const [album, setAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

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

  // Формируем список треков для очереди воспроизведения
  // Используем useMemo, чтобы не пересчитывать массив при каждом рендере
  const formattedTracks = useMemo(() => {
    if (!album || !album.tracks?.data) return [];
    return album.tracks.data.map(track => ({
      ...track,
      deezer_id: track.id,
      artist: album.artist?.name, 
      cover_url: album.cover_small || album.cover_medium
    }));
  }, [album]);

  const handleBackWithAnim = () => {
    setIsClosing(true);
    setTimeout(() => {
      onBack();
      setIsClosing(false);
    }, 400); 
  };

  if (loading) return (
    <div className="loader-container">
      Загрузка альбома...
    </div>
  );
  
  if (!album) return null;

  return (
    <div className={`album-page-root screen-overlay ${isClosing ? 'is-closing' : ''}`}>
      
      <button 
        className="ui-close-btn-minimal album-close-pos" 
        onClick={handleBackWithAnim}
      >
        <X size={32} />
      </button>

      <div className="album-scroll-area no-scrollbar">
        <div className="album-content-width">
          
          <div className="album-hero">
            <img 
              src={album.cover_medium} 
              alt={album.title} 
              className="album-cover-main"
            />
            <div className="album-meta text-contrast-wrapper">
              <h1 className="album-title">{album.title}</h1>
              <p className="album-artist-name">{album.artist?.name}</p>
              <p className="album-info-text">
                {album.release_date?.split('-')[0]} • {album.nb_tracks} треков
              </p>
            </div>
          </div>

          <div className="album-tracks-list">
            <TracksContainer>
                {formattedTracks.map((track, index) => (
                <div key={track.id} className="album-track-row">
                    <span className="album-index">{index + 1}</span>
                    <div className="album-track-wrapper">
                    <TrackItem 
                        track={track}
                        isActive={currentTrack?.deezer_id === track.id}
                        isPlaying={isPlaying}
                        pendingData={pendingTracks[track.id]}
                        now={now}
                        // Передаем сам трек и весь список альбома в качестве новой очереди
                        onClick={(t) => onTrackSelect(t, true, formattedTracks)}
                    />
                    </div>
                </div>
                ))}
            </TracksContainer>
          </div>
          
        </div>
      </div>

      <style>{`
        .album-page-root {
          display: flex;
          flex-direction: column;
          padding-bottom: 90px;
          z-index: 2000;
          background: var(--bg-color);
          position: fixed;
          inset: 0;
        }

        .ui-close-btn-minimal {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, opacity 0.2s ease;
          color: #ffffff;
          mix-blend-mode: difference;
          filter: brightness(1) contrast(100);
        }

        .album-close-pos {
          position: fixed;
          top: 25px;
          right: 25px;
          z-index: 2100;
        }

        .ui-close-btn-minimal:active {
          transform: scale(0.85);
          opacity: 0.7;
        }

        @media (min-width: 840px) {
          .album-close-pos {
            right: calc(50% - 375px);
          }
        }

        .album-scroll-area {
          flex: 1;
          overflow-y: auto;
          WebkitOverflowScrolling: touch;
          padding: 0 16px;
        }

        .album-content-width {
          max-width: 800px;
          margin: 0 auto;
        }

        .album-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 60px 0 30px;
          gap: 20px;
        }

        .album-cover-main {
          width: clamp(180px, 50vw, 240px);
          aspect-ratio: 1/1;
          border-radius: 12px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
          object-fit: cover;
        }

        .text-contrast-wrapper {
          mix-blend-mode: difference;
          filter: brightness(1) contrast(100);
          color: #ffffff;
        }

        .album-title { 
          font-size: 26px; 
          font-weight: 900; 
          margin: 0 0 6px; 
          letter-spacing: -0.5px;
        }

        .album-artist-name { 
          font-size: 18px; 
          font-weight: 700; 
          margin: 0 0 4px; 
        }

        .album-info-text { 
          font-size: 14px; 
          opacity: 0.8;
          margin: 0; 
        }

        .album-tracks-list {
          padding-top: 10px;
        }

        .album-track-row {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
        }

        .album-index {
          width: 24px;
          font-size: 13px;
          color: var(--text-secondary);
          text-align: center;
          flex-shrink: 0;
          font-weight: 500;
        }

        .album-track-wrapper {
          flex: 1;
          min-width: 0;
        }

        .loader-container {
          position: fixed; inset: 0; display: flex; 
          justify-content: center; alignItems: center; 
          background: var(--bg-color);
          color: var(--text-secondary);
          z-index: 2000;
        }
      `}</style>
    </div>
  );
};

export default AlbumPage;