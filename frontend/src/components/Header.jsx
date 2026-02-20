import React from 'react';
import { User, ArrowDownToLine, Search, X } from 'lucide-react';

const Header = ({ 
  tgUser, 
  isDownloadPanelOpen, 
  setIsDownloadPanelOpen, 
  isSearchOpen, 
  setIsSearchOpen,
  pendingTracks = {}, 
  downloadQueue = []
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
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div style={styles.avatarPlaceholder}>
              <User size={18} color="var(--text-secondary)" />
            </div>
          )}
        </div>
        <div>
          <h2 style={{ ...styles.userName, color: 'var(--text-primary)' }}>
            {tgUser?.first_name || 'Слушатель'}
          </h2>
          <p style={{ ...styles.userStatus, color: isDownloading ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
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
            {/* ФОНОВАЯ ИКОНКА (тусклая) */}
            <ArrowDownToLine 
              size={22} 
              style={{ 
                color: 'var(--text-primary)',
                opacity: 0.2,
                position: 'absolute'
              }} 
            />

            {/* АНИМИРОВАННАЯ ИКОНКА */}
            {isDownloading && (
              <div className="animate-download" style={{ display: 'flex' }}>
                <ArrowDownToLine 
                  size={22} 
                  style={{
                    color: 'var(--accent-color)',
                    filter: `drop-shadow(0 0 5px var(--accent-color))`
                  }} 
                />
              </div>
            )}
          </div>
        )}

        {/* ИКОНКА ПОИСКА */}
        <div 
          onClick={() => setIsSearchOpen(!isSearchOpen)} 
          style={{
            ...styles.searchIconWrapper,
            color: isSearchOpen ? 'var(--accent-color)' : 'var(--text-primary)',
            background: isSearchOpen ? 'rgba(128,128,128,0.1)' : 'rgba(128,128,128,0.05)'
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
    background: 'var(--bg-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(128,128,128,0.1)'
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
    fontWeight: '400',
    transition: 'color 0.3s ease'
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
    width: '38px',
    height: '38px',
    background: 'rgba(128,128,128,0.05)',
    borderRadius: '50%'
  },
  searchIconWrapper: {
    cursor: 'pointer',
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    transition: 'all 0.2s ease'
  }
};

export default Header;