import React, { useState, useEffect } from 'react';
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
    
    const container = document.querySelector('.artist-page-scroll-container');
    if (container) container.scrollTop = 0;
  }, [artistId, backendBaseUrl]);

  if (loading) return <div className="loader">Загрузка...</div>;
  if (!artist) return null;

  return (
    <div className="artist-page-scroll-container">
        <button className="artist-close-btn" onClick={onBack}>✕</button>
      {/* Ограничивающий контейнер, как в App.js */}
      <div className="artist-page-content">
        
        {/* 1. Фоновая обложка (Banner) */}
        <div 
          className="artist-banner" 
          style={{ backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, var(--bg-color) 100%), url(${artist.picture_xl})` }}
        >
          
          
          <div className="banner-content">
             <div className="avatar-wrapper">
                <img src={artist.picture_medium} alt={artist.name} className="artist-avatar-circle" />
             </div>
             <div className="artist-info-block">
                <span className="verified-label">✓ Подтвержденный артист</span>
                <h1 className="artist-title">{artist.name}</h1>
                <p className="stats">{Number(artist.nb_fan).toLocaleString()} слушателей</p>
             </div>
          </div>
        </div>

        {/* 2. Основной контент */}
        <div className="artist-content-body">
          <section className="tracks-section">
  <h2 className="section-title">Популярные треки</h2>
  <TracksContainer>
    {topTracks.slice(0, 10).map((track, index) => (
      /* Добавляем width: 100% для строки */
      <div key={track.id || track.deezer_id} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
        <span className="index-num">{index + 1}</span>
        
        {/* Добавляем flex: 1, чтобы трек заполнил всю оставшуюся ширину после номера */}
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

          {/* Внутри ArtistPage.js */}
<section className="albums-section">
  <h2 className="section-title">Альбомы</h2>
  <AlbumsSection 
    // Мы прокидываем массив альбомов
    albums={albums.map(a => ({ ...a, artist_name: artist.name }))} 
    // При клике берем только ID и отправляем его в App.js
    onAlbumClick={(album) => onAlbumClick(album.id)} 
  />
</section>
        </div>
        
      </div>

      <style>{`
        /* Внешний слой на весь экран */
        .artist-page-scroll-container {
    position: fixed; 
    top: 0; 
    left: 0; 
    width: 100%; 
    height: 100%;
    background: var(--bg-color);
    /* Выше основного контента, но ниже альбома */
    z-index: 1000; 
    overflow-y: auto;
  }

        /* ОГРАНИЧЕНИЕ ШИРИНЫ И ЦЕНТРИРОВАНИЕ */
        .artist-page-content {
          max-width: 800px; /* Согласуется с вашим MOBILE_BREAKPOINT или дизайном */
          margin: 0 auto;
          min-height: 100%;
          background: var(--bg-color);
          padding-bottom: 120px;
          position: relative;
        }

        .artist-banner {
          position: relative;
          width: 100%;
          height: 380px;
          background-size: cover;
          background-position: center;
          display: flex;
          align-items: flex-end;
          padding: 24px;
        }

        .artist-close-btn {
  position: fixed; /* Фиксирует кнопку на экране */
  top: 20px;
  /* Центрируем относительно max-width контента */
  right: 20px; 
  
  width: 40px; 
  height: 40px; 
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5); 
  backdrop-filter: blur(10px); /* Добавим эффект стекла для красоты */
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff; 
  font-size: 20px; 
  cursor: pointer;
  display: flex; 
  align-items: center; 
  justify-content: center;
  z-index: 1100; /* Выше чем баннер и все остальное */
  transition: all 0.2s ease;
}

/* На больших экранах, чтобы кнопка не прилипала к краю окна браузера, 
а держалась края контента (800px) */
@media (min-width: 840px) {
  .artist-close-btn {
    right: calc(50% - 380px); /* 400px (половина контента) - 20px отступ */
  }
}

.artist-close-btn:active { 
  transform: scale(0.9); 
  background: rgba(0, 0, 0, 0.8);
}

        .banner-content { display: flex; align-items: center; gap: 20px; width: 100%; }

        .artist-avatar-circle {
          width: 100px; height: 100px; border-radius: 50%;
          object-fit: cover; border: 4px solid rgba(255,255,255,0.1);
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }

        .artist-title {
          font-size: clamp(24px, 8vw, 42px);
          font-weight: 900; margin: 4px 0; color: #fff;
          line-height: 1.1;
        }

        .verified-label { font-size: 12px; color: #3d91ff; font-weight: bold; }
        .stats { color: rgba(255,255,255,0.7); font-size: 14px; margin: 0; }

        .artist-content-body { padding: 0 16px; }

        .section-title { font-size: 20px; margin: 30px 0 15px; font-weight: 700; }

        .index-num {
          width: 35px;
          flex-shrink: 0;
          color: var(--text-secondary);
          font-size: 14px;
          text-align: center;
        }

        .loader {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          color: #fff; font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default ArtistPage;