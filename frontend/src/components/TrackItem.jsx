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
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        padding: '8px 4px 8px 12px', // Увеличили правый отступ внутри контейнера
        borderRadius: '12px', 
        cursor: 'pointer',
        background: isActive ? 'rgba(128, 128, 128, 0.12)' : 'transparent',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
      
      <style>{`
        @keyframes pause-pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      
      {/* Контейнер обложки */}
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <img 
          src={track.cover_url} 
          style={{ 
            width: '100%', height: '100%', borderRadius: '8px', 
            objectFit: 'cover', 
            opacity: (isPending && !isDone) ? 0.4 : 1,
            boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
          }} 
          alt="" 
        />
        
        {isPending && (
          <div style={styles.loaderOverlay}>
            <svg width={ringSize} height={ringSize}>
              <circle 
                stroke={isDone ? "transparent" : "rgba(255,255,255,0.2)"} 
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
                  d="M7 12l3 3 7-7"
                  fill="none" stroke="#fff" strokeWidth="2.5" 
                  strokeLinecap="round" strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Инфо о треке */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <div style={{ 
          fontWeight: '600', 
          fontSize: '15px', 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          color: isActive ? 'var(--accent-color)' : 'var(--text-primary)'
        }}>
          {track.title}
        </div>
        <div style={{ 
          fontSize: '13px', 
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {track.artist} {isPending && (
            <span style={{ color: 'var(--accent-color)', fontWeight: '500', marginLeft: '4px' }}>
              • {isDone ? 'готово!' : 'скачиваем...'}
            </span>
          )}
        </div>
      </div>

      {/* Правая часть: Иконка с отступом 10px от края */}
      <div style={{ 
        width: '24px', 
        height: '24px',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexShrink: 0,
        marginRight: '10px' // Тот самый отступ от правого края
      }}>
        {!isPending && isActive && isPlaying && (
          <div style={{ 
            color: 'var(--accent-color)',
            animation: 'pause-pulse 2s infinite ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Pause size={18} fill="currentColor" />
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    background: 'rgba(0,0,0,0.4)', borderRadius: '8px', backdropFilter: 'blur(1px)'
  }
};

export default TrackItem;