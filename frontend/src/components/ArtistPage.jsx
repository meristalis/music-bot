import React, { useState, useEffect } from 'react'; // ОБЯЗАТЕЛЬНО
import axios from 'axios'; // ОБЯЗАТЕЛЬНО
import TrackItem from './TrackItem';
import AlbumItem, { AlbumsSection } from './AlbumItem';


const ArtistPage = ({ 
  artistId, 
  backendBaseUrl, 
  onBack, 
  onTrackSelect, 
  onAlbumClick, // передаем функцию для поиска по альбому
  currentTrack, 
  isPlaying, 
  pendingTracks, 
  now 
}) => {
  const [artist, setArtist] = useState(null);
  const [topTracks, setTopTracks] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

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
        console.error("Failed to fetch artist data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchArtistData();
    
    // Скролл вверх при открытии страницы артиста
    window.scrollTo(0, 0);
  }, [artistId, backendBaseUrl]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '50px', color: 'var(--text-secondary)' }}>
      Загрузка...
    </div>
  );
  
  if (!artist) return null;

  return (
    <div className="artist-page-container">
      {/* Шапка: Hero-секция в стиле Spotify/Twitter */}
      <div 
        className="artist-hero" 
        style={{ 
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.2), var(--bg-color)), url(${artist.picture_xl})` 
        }}
      >
        <button className="artist-back-btn" onClick={onBack}>✕</button>
        
        <div className="artist-hero-info">
          <img src={artist.picture_medium} alt={artist.name} className="artist-profile-pic" />
          <div className="artist-text-meta">
            <span className="verified-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#3d91f4" style={{marginRight: '4px'}}>
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.9 14.6L6.3 12.8l1.4-1.4 2.4 2.4 5.6-5.6 1.4 1.4-7 7z"/>
              </svg>
              Подтвержденный артист
            </span>
            <h1 className="artist-main-name">{artist.name}</h1>
            <p className="artist-fans">{Number(artist.nb_fan).toLocaleString()} слушателей</p>
          </div>
        </div>
      </div>

      <div className="artist-body-content">
        {/* Секция популярных треков: используем твой TrackItem */}
        <section className="artist-section">
          <h2 className="section-h">Популярно</h2>
          <div className="top-tracks-grid">
            {topTracks.slice(0, 5).map((track, index) => (
              <div key={track.deezer_id} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ width: '24px', flexShrink: 0, color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1 }}>
                  <TrackItem 
                    track={{
                      ...track,
                      // Нормализация: топ-треки из эндпоинта артиста иногда имеют поле id вместо deezer_id
                      deezer_id: track.deezer_id || track.id 
                    }}
                    isActive={currentTrack?.deezer_id === (track.deezer_id || track.id)}
                    isPlaying={isPlaying}
                    pendingData={pendingTracks[track.deezer_id || track.id]}
                    now={now}
                    onClick={onTrackSelect}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Секция альбомов: используем твой AlbumItem */}
        <section className="artist-section" style={{ marginTop: '20px' }}>
          <h2 className="section-h">Альбомы</h2>
          <div 
            className="hide-scrollbar"
            style={{
              display: 'flex',
              gap: '16px',
              overflowX: 'auto',
              paddingBottom: '10px',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {albums.map(album => (
              <AlbumItem 
                key={album.id} 
                album={{
                  ...album,
                  artist_name: artist.name // прокидываем имя артиста, так как в API альбомов его может не быть
                }} 
                onClick={(alb) => {
                   onAlbumClick(alb);
                   onBack(); // закрываем страницу артиста, чтобы перейти к поиску альбома
                }} 
              />
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .artist-page-container {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: var(--bg-color);
          z-index: 999;
          overflow-y: auto;
          padding-bottom: 150px;
        }
        .artist-hero {
          height: 320px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          padding: 20px;
          position: relative;
        }
        .artist-back-btn {
          position: absolute;
          top: 20px; right: 20px;
          background: rgba(0,0,0,0.5);
          border: none; color: white;
          width: 36px; height: 36px;
          border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          z-index: 10;
        }
        .artist-profile-pic {
          width: 90px; height: 90px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          margin-bottom: 10px;
        }
        .artist-main-name {
          font-size: 32px;
          font-weight: 800;
          margin: 0;
          color: white;
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .verified-badge {
          display: flex; align-items: center;
          font-size: 12px; color: white; font-weight: 600;
          margin-bottom: 4px;
        }
        .artist-fans {
          font-size: 13px; color: rgba(255,255,255,0.8); margin: 4px 0 0;
        }
        .artist-section { padding: 20px 16px 0; }
        .section-h { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default ArtistPage;