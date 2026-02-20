import React from 'react';
import { Pause } from 'lucide-react';

const TrackItem = ({ 
  track, 
  isActive, 
  isPlaying, 
  pendingData, 
  onClick,
  now 
}) => {
  const isPending = !!pendingData;
  const isDone = pendingData?.isDone;

  // Устанавливаем единые размеры для всех типов списков
  const size = 48;
  const ringSize = 24;
  const radius = 9;
  const circumference = 2 * Math.PI * radius;

  const getStrokeOffset = () => {
    if (!pendingData || isDone) return 0;
    const remaining = pendingData.finishTime - now;
    const progress = Math.max(0, Math.min(1, 1 - (remaining / pendingData.totalWait)));
    return circumference * (1 - progress);
  };

  return (
    <div 
      onClick={() => onClick(track)}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '8px',
        borderRadius: '8px', cursor: 'pointer',
        background: isActive ? 'rgba(128, 128, 128, 0.15)' : 'transparent',
        transition: 'background 0.2s ease'
      }}>
      
      {/* Контейнер обложки */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <img 
          src={track.cover_url} 
          style={{ 
            width: '100%', height: '100%', borderRadius: '6px', 
            objectFit: 'cover', opacity: (isPending && !isDone) ? 0.4 : 1 
          }} 
          alt="" 
        />
        
        {/* Оверлей загрузки */}
        {isPending && (
          <div style={styles.loaderOverlay}>
            <svg width={ringSize} height={ringSize}>
              <circle 
                stroke={isDone ? "transparent" : "rgba(128,128,128,0.3)"} 
                strokeWidth="2.5" fill={isDone ? "var(--accent-color)" : "transparent"} 
                r={radius} cx={ringSize/2} cy={ringSize/2} 
              />
              {!isDone ? (
                <circle 
                  stroke="var(--accent-color)" strokeWidth="2.5" fill="transparent" 
                  r={radius} cx={ringSize/2} cy={ringSize/2}
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: getStrokeOffset(),
                    transition: 'stroke-dashoffset 0.1s linear', 
                    strokeLinecap: 'round'
                  }}
                />
              ) : (
                <path 
                  d="M7 12l3 3 7-7" // Единая траектория галочки для размера 24px
                  fill="none" stroke="#fff" strokeWidth="2.5" 
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ transformOrigin: 'center' }}
                />
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Инфо о треке */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          fontWeight: '600', fontSize: '15px', 
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
          color: isActive ? 'var(--accent-color)' : 'var(--text-primary)' 
        }}>
          {track.title}
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: 'var(--text-secondary)' 
        }}>
          {track.artist} {isPending && (
            <span style={{ color: 'var(--accent-color)', fontWeight: '500' }}>
              • {isDone ? 'готово!' : 'скачиваем...'}
            </span>
          )}
        </div>
      </div>

      {/* Иконка паузы при воспроизведении */}
      {!isPending && isActive && isPlaying && (
        <div style={{ color: 'var(--accent-color)' }}>
          <Pause size={18} fill="currentColor" />
        </div>
      )}
    </div>
  );
};

const styles = {
  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    background: 'rgba(0,0,0,0.5)', borderRadius: '6px', backdropFilter: 'blur(2px)'
  }
};

export default TrackItem;