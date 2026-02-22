import React, { useRef, useEffect } from 'react';

const ArtistItem = ({ artist, onClick }) => {
  return (
    <div 
      onClick={() => onClick(artist)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        width: '90px',
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
        borderRadius: '50%',
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

export const ArtistsSection = ({ artists, onArtistClick }) => {
  const scrollRef = useRef(null);

  // Добавляем горизонтальный скролл колесиком
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.5;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [artists]);

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
        ref={scrollRef}
        className="custom-horizontal-scroll"
        style={{
          display: 'flex',
          gap: '16px',
          overflowX: 'auto',
          paddingBottom: '12px',
          paddingLeft: '4px',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth'
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

      <style>{`
        .custom-horizontal-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .custom-horizontal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-horizontal-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-horizontal-scroll:hover::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
        }
        
        @media (hover: none) {
          .custom-horizontal-scroll::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default ArtistItem;