import React from 'react';
import { User, ArrowDownToLine, Search, X } from 'lucide-react';

const Header = ({ 
  tgUser, 
  isDownloadPanelOpen, 
  setIsDownloadPanelOpen, 
  isSearchOpen, 
  setIsSearchOpen,
  pendingTracks, // Передаем, чтобы знать, крутить ли анимацию
  downloadQueue  // Передаем, чтобы знать, показывать ли иконку вообще
}) => {
  const isDownloading = Object.keys(pendingTracks).length > 0;
  const hasItemsInQueue = downloadQueue.length > 0;

  return (
    <div style={styles.headerContainer}>
      {/* ПРОФИЛЬ */}
      <div style={styles.profileSection}>
        <div style={styles.avatarCircle}>
          <User size={18} />
        </div>
        <div>
          <h2 style={styles.userName}>
            {tgUser?.first_name || 'Слушатель'}
          </h2>
        </div>
      </div>

      {/* КНОПКИ УПРАВЛЕНИЯ */}
      <div style={styles.actionsSection}>
        
        {/* ИКОНКА ЗАГРУЗОК */}
        <div 
          onClick={() => setIsDownloadPanelOpen(!isDownloadPanelOpen)} 
          style={styles.downloadIconWrapper}
        >
          {/* ФОНОВАЯ ИКОНКА (подложка) */}
          <ArrowDownToLine 
            size={22} 
            style={{ 
              color: '#fff',
              opacity: isDownloading ? 0.3 : (hasItemsInQueue ? 0.8 : 0.3),
              position: 'absolute'
            }} 
          />

          {/* АНИМИРОВАННАЯ ИКОНКА (заполнение) */}
          {isDownloading && (
            <ArrowDownToLine 
              size={22} 
              style={styles.activeDownloadIcon} 
              className="animate-fill" 
            />
          )}
        </div>

        {/* ИКОНКА ПОИСКА */}
        <div 
          onClick={() => setIsSearchOpen(!isSearchOpen)} 
          style={styles.searchIconWrapper}
        >
          {isSearchOpen ? <X size={22} /> : <Search size={22} />}
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
    marginBottom: '24px'
  },
  profileSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatarCircle: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#222',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  userName: {
    margin: 0,
    fontSize: '15px',
    fontWeight: '600'
  },
  actionsSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px'
  },
  downloadIconWrapper: {
    position: 'relative',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px'
  },
  activeDownloadIcon: {
    color: '#fa2d48',
    position: 'absolute',
    filter: 'drop-shadow(0 0 5px rgba(250, 45, 72, 0.5))'
  },
  searchIconWrapper: {
    cursor: 'pointer',
    opacity: 0.8
  }
};

export default Header;