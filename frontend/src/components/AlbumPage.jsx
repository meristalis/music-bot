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
    window.scrollTo(0, 0);
  }, [albumId, backendBaseUrl]);

  if (loading) return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-color)', zIndex: 1000 }}>
      <div style={{ color: 'var(--text-secondary)' }}>Загрузка альбома...</div>
    </div>
  );
  
  if (!album) return null;

  return (
    <div className="album-page-container">
      <div className="album-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
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
                  cover_url: album.cover_small || album.cover_medium // У треков в альбоме часто нет своего cover_url
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

      <style>{`
        .album-page-container {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: var(--bg-color); z-index: 999; overflow-y: auto; padding-bottom: 150px;
        }
        .album-header {
          padding: 60px 20px 20px;
          background: linear-gradient(to bottom, rgba(var(--accent-rgb), 0.3), var(--bg-color));
          position: relative;
        }
        .back-btn {
          position: absolute; top: 20px; left: 16px;
          background: none; border: none; color: var(--text-color); cursor: pointer;
        }
        .album-info-hero { display: flex; gap: 20px; align-items: flex-end; }
        .album-cover-main {
          width: 120px; height: 120px; border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .album-title-main { font-size: 24px; font-weight: 800; margin: 0; }
        .album-artist-name { font-size: 16px; color: var(--accent-color); font-weight: 600; margin: 4px 0; }
        .album-release-info { font-size: 13px; color: var(--text-secondary); margin: 0; }
        .album-tracks-list { padding: 10px 16px; }
        .album-track-row { display: flex; align-items: center; margin-bottom: 4px; }
        .track-number { width: 30px; color: var(--text-secondary); font-size: 14px; text-align: center; flex-shrink: 0; }
      `}</style>
    </div>
  );
};

export default AlbumPage;