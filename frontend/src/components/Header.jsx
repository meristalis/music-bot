import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, ArrowDownToLine, Search, X } from 'lucide-react';

const Header = ({ 
  tgUser, 
  isDownloadPanelOpen, 
  setIsDownloadPanelOpen, 
  isSearchOpen, 
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
  pendingTracks = {}, 
  downloadQueue = [],
  backendBaseUrl 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [isArtistFixed, setIsArtistFixed] = useState(false);
  const [hasJustSelected, setHasJustSelected] = useState(false); 
  const inputRef = useRef(null);

  const isDownloading = Object.keys(pendingTracks).length > 0;
  const hasItemsInQueue = downloadQueue.length > 0;

  useEffect(() => {
    const fetchSuggestions = async () => {
      const cleanQuery = searchQuery.trim();
      
      // Скрываем если мало букв или был нажат Enter/Трек
      if (cleanQuery.length < 2 || hasJustSelected) {
        setSuggestions([]);
        return;
      }

      try {
        const res = await axios.get(`${backendBaseUrl}/api/search/deezer?q=${encodeURIComponent(cleanQuery)}`);
        
        let artists = [];
        let tracks = [];

        res.data.forEach(item => {
          const artistName = item.artist?.name || item.artist;
          const trackTitle = item.title;
          if (artistName) artists.push({ text: artistName, type: 'artist' });
          if (trackTitle) tracks.push({ text: trackTitle, type: 'track' });
        });

        const uniqueArtists = Array.from(new Map(artists.map(a => [a.text.toLowerCase(), a])).values());
        const uniqueTracks = Array.from(new Map(tracks.map(t => [t.text.toLowerCase(), t])).values());

        let finalSuggestions = [];
        if (isArtistFixed) {
          finalSuggestions = uniqueTracks.slice(0, 6);
        } else {
          finalSuggestions = [...uniqueArtists.slice(0, 2), ...uniqueTracks.slice(0, 4)];
        }

        setSuggestions(finalSuggestions);
      } catch (err) {
        console.error("Autocomplete error:", err);
      }
    };

    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, backendBaseUrl, isArtistFixed, hasJustSelected]);

  const selectSuggestion = (suggestion) => {
    const input = searchQuery; 
    const words = input.split(/\s+/); 
    const lastWord = words[words.length - 1]; 
    const suggestionText = suggestion.text;

    let newQuery = "";

    const isPrefixOfLastWord = lastWord.length > 0 && 
      suggestionText.toLowerCase().startsWith(lastWord.toLowerCase());

    if (isPrefixOfLastWord) {
      words[words.length - 1] = suggestionText;
      newQuery = words.join(' ');
    } else {
      const cleanInput = input.trim();
      if (!cleanInput.toLowerCase().includes(suggestionText.toLowerCase())) {
        newQuery = `${cleanInput} ${suggestionText}`;
      } else {
        newQuery = cleanInput;
      }
    }

    setSearchQuery(newQuery);

    if (suggestion.type === 'artist') {
      setIsArtistFixed(true);
      setHasJustSelected(false); // НЕ скрываем подсказки, даем выбрать трек
    } else {
      setHasJustSelected(true); // Скрываем, так как выбрали конкретный трек
      setSuggestions([]);
    }
    
    if (inputRef.current) inputRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      setHasJustSelected(true);
      setSuggestions([]);
      // Здесь можно вызвать функцию самого поиска (fetch результатов)
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (hasJustSelected) setHasJustSelected(false);
    if (value.trim() === '') setIsArtistFixed(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
    setIsArtistFixed(false);
    setHasJustSelected(false);
  };

  return (
    <div style={styles.headerWrapper}>
      <div style={styles.headerContainer}>
        <div style={styles.leftSection}>
          {!isSearchOpen ? (
            <div style={styles.profileSection}>
              <div style={styles.avatarWrapper}>
                {tgUser?.photo_url ? (
                  <img src={tgUser.photo_url} alt="Avatar" style={styles.avatarImage} />
                ) : (
                  <User size={18} color="var(--text-secondary)" />
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
          ) : (
            <div style={styles.searchBarWrapper}>
              <div 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                onClick={() => { setHasJustSelected(true); setSuggestions([]); }}
              >
                {isArtistFixed ? (
                  <User size={18} color="var(--accent-color)" style={{ marginLeft: '12px' }} />
                ) : (
                  <Search size={18} color="var(--accent-color)" style={{ marginLeft: '12px' }} />
                )}
              </div>
              <input 
                ref={inputRef}
                autoFocus
                type="text" 
                placeholder="Поиск..." 
                value={searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                style={{ ...styles.searchInput, color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <X 
                  size={18} 
                  onClick={handleClearSearch} 
                  style={{ marginRight: '12px', cursor: 'pointer', color: 'var(--text-secondary)' }} 
                />
              )}
            </div>
          )}
        </div>

        <div style={styles.actionsSection}>
          <div 
            onClick={() => setIsDownloadPanelOpen(!isDownloadPanelOpen)} 
            style={{...styles.iconBtn, background: isDownloadPanelOpen ? 'rgba(255,107,129,0.1)' : 'rgba(128,128,128,0.05)'}}
          >
            <ArrowDownToLine size={22} style={{ color: 'var(--text-primary)', opacity: 0.15, position: 'absolute' }} />
            <div style={{
                position: 'absolute',
                color: 'var(--accent-color)',
                opacity: (isDownloading || hasItemsInQueue) ? 1 : 0,
            }} className={isDownloading ? "download-fill-active" : ""}>
                <ArrowDownToLine size={22} />
            </div>
          </div>

          <div 
            onClick={() => {
                const newState = !isSearchOpen;
                setIsSearchOpen(newState);
                if (!newState) handleClearSearch();
            }} 
            style={{
              ...styles.iconBtn,
              background: isSearchOpen ? 'rgba(255,107,129,0.1)' : 'rgba(128,128,128,0.05)',
              color: isSearchOpen ? 'var(--accent-color)' : 'var(--text-primary)'
            }}
          >
            {isSearchOpen ? <X size={24} /> : <Search size={22} />}
          </div>
        </div>
      </div>

      {isSearchOpen && !hasJustSelected && suggestions.length > 0 && (
        <div style={styles.suggestionsDropdown}>
          {suggestions.map((item, i) => (
            <div 
              key={i} 
              style={styles.suggestionItem}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(item);
              }}
            >
              {item.type === 'artist' ? (
                <User size={14} color="var(--accent-color)" style={{ marginRight: '10px' }} />
              ) : (
                <Search size={14} color="var(--text-secondary)" style={{ marginRight: '10px' }} />
              )}
              <span style={styles.suggestionText}>{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  headerWrapper: { position: 'relative', marginBottom: '24px', zIndex: 100 },
  headerContainer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  leftSection: { flex: 1, minWidth: 0 },
  profileSection: { display: 'flex', alignItems: 'center', gap: '12px' },
  searchBarWrapper: { 
    display: 'flex', alignItems: 'center', background: 'var(--bg-surface)', 
    borderRadius: '12px', height: '40px', border: '1px solid rgba(128,128,128,0.1)' 
  },
  searchInput: { flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '0 8px', fontSize: '16px', minWidth: 0 },
  avatarWrapper: { width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarImage: { width: '100%', height: '100%', objectFit: 'cover' },
  userName: { margin: 0, fontSize: '16px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userStatus: { margin: 0, fontSize: '11px' },
  actionsSection: { display: 'flex', gap: '10px' },
  iconBtn: { width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0 },
  suggestionsDropdown: {
    position: 'absolute',
    top: '45px',
    left: 0,
    right: 0,
    background: 'var(--bg-surface)',
    borderRadius: '12px',
    border: '1px solid rgba(128,128,128,0.1)',
    zIndex: 1000,
    overflow: 'hidden',
    boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
    marginTop: '4px'
  },
  suggestionItem: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '15px',
    borderBottom: '1px solid rgba(128,128,128,0.05)',
    transition: 'background 0.2s'
  },
  suggestionText: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};

export default Header;