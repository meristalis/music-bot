import React from 'react';

const AlbumItem = ({ album, onClick }) => {
  return (
    <div 
      onClick={() => onClick(album)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '120px', // Альбомы чуть шире артистов
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 0.2s ease'
      }}
      className="album-item-hover"
    >
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '12px', // Скругленные углы, но не круг
        overflow: 'hidden',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        background: 'var(--bg-surface)'
      }}>
        <img 
          src={album.cover_medium} 
          alt={album.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 4px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {album.title}
        </div>
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {album.artist_name}
        </div>
      </div>
      
      <style>{`
        .album-item-hover:active { transform: scale(0.96); }
      `}</style>
    </div>
  );
};

export const AlbumsSection = ({ albums, onAlbumClick }) => {
  if (!albums || albums.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px', paddingLeft: '4px' }}>
        Альбомы
      </h3>
      <div 
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '10px',
          paddingLeft: '4px',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {albums.map(album => (
          <AlbumItem key={album.id} album={album} onClick={onAlbumClick} />
        ))}
      </div>
    </div>
  );
};

export default AlbumItem;