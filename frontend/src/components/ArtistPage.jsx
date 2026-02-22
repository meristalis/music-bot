import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import TrackItem, { TracksContainer } from './TrackItem';
import AlbumItem, { AlbumsSection } from './AlbumItem';

const ArtistPage = ({ 
  artistId, backendBaseUrl, onBack, onTrackSelect, onAlbumClick, 
  currentTrack, isPlaying, pendingTracks, now 
}) => {
  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const handleBackWithAnim = () => {
    setIsClosing(true);
    setTimeout(() => {
      onBack();
      setIsClosing(false);
    }, 400);
  };

  useEffect(() => {
    const fetchArtistData = async () => {
      setLoading(true);
      try {
        const [details, top, alb] = await Promise.all([
          axios.get(`${backendBaseUrl}/api/artist/${artistId}`),
          axios.get(`${backendBaseUrl}/api/artist/${artistId}/top`),
          axios.get(`${backendBaseUrl}/api/artist/${artistId}/albums`)
        ]);
        setArtist(details.data);
        setTopTracks(top.data);
        setAlbums(alb.data);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtistData();
  }, [artistId, backendBaseUrl]);

  if (loading) return <div className="loader">Загрузка...</div>;
  if (!artist) return null;

  return (
    <div className={`artist-page-scroll-container screen-overlay ${isClosing ? 'is-closing' : ''}`}>
        
      {/* КНОПКА ЗАКРЫТИЯ С АНИМАЦИЕЙ */}
      <button 
        onClick={handleBackWithAnim} 
        className={`ui-close-btn-minimal artist-close-pos ${isClosing ? 'btn-exit' : 'btn-enter'}`}
      >
          <X size={32} />
      </button>

      <div className="artist-page-content">
        <div 
          className="artist-banner" 
          style={{ 
            backgroundImage: `
              linear-gradient(to bottom, 
                rgba(0,0,0,0) 10%,
                rgba(0,0,0,0) 30%, 
                var(--bg-color) 100%
              ), 
              url(${artist.picture_xl})` 
          }}
        >
          <div className="banner-content">
            <div className="avatar-wrapper">
              <img src={artist.picture_medium} alt={artist.name} className="artist-avatar-circle" />
            </div>
            <div className="artist-info-block text-contrast-wrapper">
              <h1 className="artist-name-heading">{artist.name}</h1>
              <p className="artist-stats-text">
                {Number(artist.nb_fan).toLocaleString()} слушателей
              </p>
            </div>
          </div>
        </div>

        <div className="artist-content-body">
          <section className="tracks-section">
            <h2 className="section-title">Популярные треки</h2>
            <TracksContainer>
              {topTracks.slice(0, 10).map((track, index) => (
                <div key={track.id || track.deezer_id} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <span className="index-num">{index + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}> 
                    <TrackItem 
                      track={{ ...track, deezer_id: track.deezer_id || track.id }}
                      isActive={currentTrack?.deezer_id === (track.deezer_id || track.id)}
                      isPlaying={isPlaying}
                      pendingData={pendingTracks[track.deezer_id || track.id]}
                      now={now}
                      onClick={onTrackSelect}
                    />
                  </div>
                </div>
              ))}
            </TracksContainer>
          </section>

          <section className="albums-section">
            <h2 className="section-title">Альбомы</h2>
            <AlbumsSection 
              albums={albums.map(a => ({ ...a, artist_name: artist.name }))} 
              onAlbumClick={(album) => onAlbumClick(album.id)} 
            />
          </section>
        </div>
      </div>

      <style>{`
        .artist-page-scroll-container {
          position: fixed; 
          top: 0; left: 0; width: 100%; height: 100%;
          background: var(--bg-color);
          z-index: 1500;
          overflow-y: auto;
          overscroll-behavior-y: none;
        }

        /* МИНИМАЛИСТИЧНЫЙ КРЕСТИК */
        .ui-close-btn-minimal {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          
          color: #ffffff;
          mix-blend-mode: difference;
          filter: brightness(1) contrast(100);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        }

        /* Анимация появления */
        .btn-enter {
          animation: btnAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;
          animation-delay: 0.2s;
        }

        /* Анимация исчезновения */
        .btn-exit {
          opacity: 0;
          transform: scale(0.5) rotate(-45deg);
        }

        @keyframes btnAppear {
          from { opacity: 0; transform: scale(0.5) rotate(-90deg); }
          to { opacity: 1; transform: scale(1) rotate(0deg); }
        }

        .artist-close-pos {
          position: fixed;
          top: 25px;
          right: 25px;
          z-index: 1600;
        }

        /* Эффект при нажатии */
        .ui-close-btn-minimal:active {
          transform: scale(0.8) rotate(90deg);
          opacity: 0.5;
        }

        @media (min-width: 840px) {
          .artist-close-pos { right: calc(50% - 375px); }
        }

        /* Стили контента... */
        .artist-page-content { max-width: 800px; margin: 0 auto; padding-bottom: 120px; }
        .artist-banner { height: 420px; background-size: cover; background-position: center 20%; display: flex; align-items: flex-end; padding: 32px 24px; }
        .banner-content { display: flex; align-items: center; gap: 16px; width: 100%; }
        .artist-avatar-circle { width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.2); box-shadow: 0 8px 25px rgba(0,0,0,0.2); }
        .text-contrast-wrapper { color: #ffffff; mix-blend-mode: difference; filter: brightness(1) contrast(100); }
        .artist-name-heading { font-size: clamp(28px, 8vw, 48px); font-weight: 900; margin: 0; line-height: 1; letter-spacing: -0.5px; }
        .artist-stats-text { font-size: 15px; font-weight: 500; margin: 4px 0 0 0; opacity: 0.8; }
        .artist-content-body { padding: 0 16px; }
        .section-title { font-size: 22px; margin: 32px 0 16px; font-weight: 700; color: var(--text-primary); }
        .index-num { width: 35px; color: var(--text-secondary); font-size: 14px; text-align: center; }
        .loader { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); color: var(--text-primary); font-size: 18px; }
      `}</style>
    </div>
  );
};

export default ArtistPage;