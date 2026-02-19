import React from 'react';
import { User, ArrowDownToLine, Search, X } from 'lucide-react';

const Header = ({ 
  tgUser, 
  isDownloadPanelOpen, 
  setIsDownloadPanelOpen, 
  isSearchOpen, 
  setIsSearchOpen,
  pendingTracks = {}, 
  downloadQueue = [],
  accentColor = '#ff8a9a' // Дефолтный нежный цвет, если пропс не пришел
}) => {
  const isDownloading = Object.keys(pendingTracks).length > 0;
  const hasItemsInQueue = downloadQueue.length > 0;

  return (
    <div style={styles.headerContainer}>
      {/* ПРОФИЛЬ */}
      <div style={styles.profileSection}>
        <div style={styles.avatarWrapper}>
          {tgUser?.photo_url ? (
            <img 
              src={tgUser.photo_url} 
              alt="Avatar" 
              style={styles.avatarImage} 
              // Обработка ошибки загрузки (например, если ссылка протухла)
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={styles.avatarPlaceholder}>
              <User size={18} color="#8e8e93" />
            </div>
          )}
        </div>
        <div>
          <h2 style={styles.userName}>
            {tgUser?.first_name || 'Слушатель'}
          </h2>
          <p style={styles.userStatus}>
            {isDownloading ? 'Загрузка треков...' : 'Online'}
          </p>
        </div>
      </div>

      {/* КНОПКИ УПРАВЛЕНИЯ */}
      <div style={styles.actionsSection}>
        
        {/* ИКОНКА ЗАГРУЗОК */}
        {(hasItemsInQueue || isDownloading) && (
          <div 
            onClick={() => setIsDownloadPanelOpen(!isDownloadPanelOpen)} 
            style={styles.downloadIconWrapper}
          >
            {/* ФОНОВАЯ ИКОНКА */}
            <ArrowDownToLine 
              size={22} 
              style={{ 
                color: '#fff',
                opacity: isDownloading ? 0.2 : 0.8,
                position: 'absolute'
              }} 
            />

            {/* АНИМИРОВАННАЯ ИКОНКА (заполнение) */}
            {isDownloading && (
              <ArrowDownToLine 
                size={22} 
                style={{
                  ...styles.activeDownloadIcon,
                  color: accentColor,
                  filter: `drop-shadow(0 0 8px ${accentColor}44)` // 44 - это прозрачность
                }} 
                className="animate-pulse-subtle" 
              />
            )}
          </div>
        )}

        {/* ИКОНКА ПОИСКА */}
        <div 
          onClick={() => setIsSearchOpen(!isSearchOpen)} 
          style={{
            ...styles.searchIconWrapper,
            color: isSearchOpen ? accentColor : '#fff'
          }}
        >
          {isSearchOpen ? <X size={24} /> : <Search size={22} />}
        </div>
      </div>
    </div>
  );
};

const styles = {
  headerContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    padding: '4px 0'
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatarWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    overflow: 'hidden',
    background: '#1c1c1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.1)'
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  avatarPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '-0.3px'
  },
  userStatus: {
    margin: 0,
    fontSize: '11px',
    color: '#8e8e93',
    fontWeight: '400'
  },
  actionsSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  downloadIconWrapper: {
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '50%'
  },
  activeDownloadIcon: {
    position: 'absolute',
  },
  searchIconWrapper: {
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '50%',
    transition: 'all 0.2s ease'
  }
};

export default Header;