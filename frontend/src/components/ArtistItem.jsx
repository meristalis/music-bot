import React from 'react';

const ArtistItem = ({ artist, onClick }) => {
  return (
    <div 
      onClick={() => onClick(artist)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        width: '90px', // фиксированная ширина для сетки скролла
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 0.2s ease'
      }}
      className="artist-item-hover"
    >
      <div style={{
        position: 'relative',
        width: '80px',
        height: '80px',
        borderRadius: '50%', // Артисты всегда круглые
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: 'var(--bg-surface)'
      }}>
        <img 
          src={artist.picture_medium || artist.picture} 
          alt={artist.name}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>

      <div style={{
        fontSize: '13px',
        fontWeight: '500',
        textAlign: 'center',
        color: 'var(--text-primary)',
        width: '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 4px'
      }}>
        {artist.name}
      </div>
      
      <style>{`
        .artist-item-hover:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

// Вспомогательный компонент для горизонтального контейнера
export const ArtistsSection = ({ artists, onArtistClick }) => {
  if (!artists || artists.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ 
        fontSize: '18px', 
        fontWeight: '700', 
        marginBottom: '14px', 
        paddingLeft: '4px',
        color: 'var(--text-primary)' 
      }}>
        Артисты
      </h3>
      <div 
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '8px', // Отступ для тени
          paddingLeft: '4px',
          WebkitOverflowScrolling: 'touch' // Плавный скролл на iOS
        }}
      >
        {artists.map(artist => (
          <ArtistItem 
            key={artist.id} 
            artist={artist} 
            onClick={onArtistClick} 
          />
        ))}
      </div>
    </div>
  );
};

export default ArtistItem;