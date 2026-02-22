import React, { useRef, useEffect } from 'react';

const AlbumItem = ({ album, onClick }) => {
  return (
    <div 
      onClick={() => onClick(album)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '120px',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'transform 0.2s ease'
      }}
      className="album-item-hover"
    >
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '12px',
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
  const scrollRef = useRef(null);

  // Добавляем обработку колесика мыши для горизонтального скролла
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (e.deltaY === 0) return;
      // Если прокрутка вертикальная, переводим её в горизонтальную
      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.5; // Коэффициент скорости прокрутки
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [albums]);

  if (!albums || albums.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '14px', paddingLeft: '4px' }}>
        Альбомы
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
        {albums.map(album => (
          <AlbumItem key={album.id} album={album} onClick={onAlbumClick} />
        ))}
      </div>

      {/* Стили для скроллбара, чтобы он был аккуратным на ПК */}
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
        /* Скрываем скроллбар на мобилках (iOS/Android), оставляем только на ПК */
        @media (hover: none) {
          .custom-horizontal-scroll::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default AlbumItem;