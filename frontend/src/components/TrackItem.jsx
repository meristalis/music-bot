import React from 'react';
import { Pause } from 'lucide-react';

const TrackItem = ({ 
  track, 
  isFromQueue = false, 
  isActive, 
  isPlaying, 
  pendingData, 
  onClick,
  now 
}) => {
  const isPending = !!pendingData;
  const isDone = pendingData?.isDone;
  const size = isFromQueue ? 40 : 48;
  const ringSize = isFromQueue ? 20 : 24;
  const radius = isFromQueue ? 7 : 9;
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
        background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 0.2s ease'
      }}>
      
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px`, flexShrink: 0 }}>
        <img 
          src={track.cover_url} 
          style={{ 
            width: '100%', height: '100%', borderRadius: '6px', 
            objectFit: 'cover', opacity: (isPending && !isDone) ? 0.4 : 1 
          }} 
          alt="" 
        />
        
        {isPending && (
          <div style={styles.loaderOverlay}>
            <svg width={ringSize} height={ringSize}>
              <circle 
                stroke={isDone ? "transparent" : "rgba(255,255,255,0.2)"} 
                strokeWidth="2.5" fill={isDone ? "#fa2d48" : "transparent"} 
                r={radius} cx={ringSize/2} cy={ringSize/2} 
              />
              {!isDone ? (
                <circle 
                  stroke="#fa2d48" strokeWidth="2.5" fill="transparent" 
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
                  d={isFromQueue ? "M6 10l2 2 4-4" : "M7 12l3 3 7-7"} 
                  fill="none" stroke="#fff" strokeWidth="2.5" 
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ transformOrigin: 'center' }} // Убрали rotate(90deg)
                />
              )}
            </svg>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div style={{ 
          fontWeight: '500', fontSize: isFromQueue ? '14px' : '15px', 
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', 
          color: isActive ? '#fa2d48' : '#fff' 
        }}>
          {track.title}
        </div>
        <div style={{ fontSize: isFromQueue ? '12px' : '13px', color: '#8e8e93' }}>
          {track.artist} {isPending && (
            <span style={{color: '#fa2d48'}}>
              • {isDone ? 'готово!' : 'скачиваем...'}
            </span>
          )}
        </div>
      </div>

      {!isPending && isActive && isPlaying && (
        <div style={{ color: '#fa2d48' }}><Pause size={16} fill="currentColor" /></div>
      )}
    </div>
  );
};

const styles = {
  loaderOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    background: 'rgba(0,0,0,0.4)', borderRadius: '6px', backdropFilter: 'blur(2px)'
  }
};

export default TrackItem;