import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import FullPlayer from './components/FullPlayer';
import TrackItem from './components/TrackItem';
import AudioPlayer from './components/AudioPlayer';
import Header from './components/Header';
import { useAudioPlayer } from './hooks/useAudioPlayer'; 
import './App.css';

// --- Утилиты ---
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const formatTime = (seconds) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

function App() {
  const MOBILE_BREAKPOINT = 780;
  const backendBaseUrl = "/api";

  // --- Состояния интерфейса и данных ---
  const [now, setNow] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [tgUser, setTgUser] = useState(null);
  const [manualChatId, setManualChatId] = useState(''); // Для ввода ID вручную
  const [library, setLibrary] = useState([]);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState(new Set());
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);

  // --- Состояния загрузки треков ---
  const [pendingTracks, setPendingTracks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const loadingTimersRef = useRef({});

  // Инициализация плеера
  const player = useAudioPlayer(library, (track) => handleTrackSelect(track));

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // Telegram Init + Manual Auth Check
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const savedChatId = localStorage.getItem('custom_chat_id');

    if (tg && tg.initDataUnsafe?.user) {
      tg.ready();
      tg.setHeaderColor('#1c1c1e');
      tg.setBackgroundColor('#000000');
      const user = tg.initDataUnsafe.user;
      setTgUser(user);
      fetchLibrary(user.id);
    } else if (savedChatId) {
      const user = { id: savedChatId, first_name: "User " + savedChatId };
      setTgUser(user);
      fetchLibrary(savedChatId);
    }
  }, []);

  const handleAuth = () => {
    if (manualChatId.trim()) {
      localStorage.setItem('custom_chat_id', manualChatId);
      const user = { id: manualChatId, first_name: "User " + manualChatId };
      setTgUser(user);
      fetchLibrary(manualChatId);
    }
  };

  const fetchLibrary = useCallback((userId) => {
    axios.get(`${backendBaseUrl}/api/tracks?user_id=${userId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setLibrary(data);
        setFavoriteTrackIds(new Set(data.map(t => t.deezer_id)));
      })
      .catch(err => {
        console.error("Ошибка загрузки медиатеки:", err);
        setLibrary([]);
      });
  }, [backendBaseUrl]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Search Logic
  useEffect(() => {
    const cleanQuery = debouncedSearch.trim();
    if (cleanQuery) {
      setIsSearching(true);
      axios.get(`${backendBaseUrl}/api/search/deezer?q=${encodeURIComponent(cleanQuery)}`)
        .then(res => {
          setSearchResults(Array.isArray(res.data) ? res.data : []);
          setIsSearching(false);
        })
        .catch(() => {
          setSearchResults([]);
          setIsSearching(false);
        });
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearch, backendBaseUrl]);

  const handleLike = async (track) => {
    if (!tgUser || !track) return;
    const isLiked = favoriteTrackIds.has(track.deezer_id);
    setFavoriteTrackIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(track.deezer_id);
      else next.add(track.deezer_id);
      return next;
    });

    try {
      await axios.post(`${backendBaseUrl}/api/tracks/${isLiked ? 'unlike' : 'like'}`, {
        user_id: tgUser.id,
        deezer_id: track.deezer_id
      });
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch (err) {
      console.error(err);
    } finally {
      fetchLibrary(tgUser.id);
    }
  };

  const handleTrackSelect = useCallback(async (track) => {
    if (player.currentTrack?.deezer_id === track.deezer_id && player.currentTrack.play_link) {
      player.togglePlay();
      return;
    }
    if (pendingTracks[track.deezer_id]) return;
    await requestTrack(track);
  }, [player, pendingTracks]);

 const requestTrack = async (track, isRetry = false) => {
    const trackId = track.deezer_id;
    try {
      const response = await axios.post(`${backendBaseUrl}/api/tracks/play`, track);
      
      if (response.status === 200) {
        if (isRetry) {
          setPendingTracks(prev => ({ 
            ...prev, 
            [trackId]: { ...prev[trackId], isDone: true } 
          }));
          setTimeout(() => {
            clearLoadingState(trackId);
            fetchLibrary(tgUser.id);
          }, 1500);
        } else {
          clearLoadingState(trackId);
          player.setCurrentTrack({ 
            ...track, 
            play_link: response.data.play_link, 
            track_id: response.data.track_id 
          });
          player.setIsPlaying(true);
        }
      } else if (response.status === 202) {
        setDownloadQueue(prev => prev.find(t => t.deezer_id === trackId) ? prev : [track, ...prev]);
        setPendingTracks(prev => {
          if (prev[trackId]) return prev;
          return {
            ...prev,
            [trackId]: { 
              finishTime: Date.now() + 15000,
              totalWait: 15000, 
              isDone: false 
            }
          };
        });
        loadingTimersRef.current[trackId] = setTimeout(() => requestTrack(track, true), 5000);
      }
    } catch (err) {
      clearLoadingState(trackId);
    }
  };

  const clearLoadingState = (trackId) => {
    setPendingTracks(prev => {
      const newState = { ...prev };
      delete newState[trackId];
      return newState;
    });
    if (loadingTimersRef.current[trackId]) {
      clearTimeout(loadingTimersRef.current[trackId]);
      delete loadingTimersRef.current[trackId];
    }
  };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    if (isFullPlayerOpen) {
      tg.BackButton.show();
      tg.BackButton.onClick(() => setIsFullPlayerOpen(false));
    } else {
      tg.BackButton.hide();
    }
  }, [isFullPlayerOpen]);

  // Если пользователь не определен (ни ТГ, ни сохраненного ID)
  if (!tgUser) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#000', color: '#fff', padding: '20px', textAlign: 'center'
      }}>
        <h3 style={{ marginBottom: '20px' }}>Вход в систему</h3>
        <input 
          type="text" 
          placeholder="Введите Telegram Chat ID" 
          value={manualChatId}
          onChange={(e) => setManualChatId(e.target.value)}
          style={{
            background: '#1c1c1e', border: 'none', borderRadius: '10px', padding: '12px',
            color: '#fff', fontSize: '16px', width: '100%', maxWidth: '300px', marginBottom: '15px'
          }}
        />
        <button 
          onClick={handleAuth}
          style={{
            background: '#fa2d48', border: 'none', borderRadius: '10px', padding: '12px 30px',
            color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer'
          }}
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="app-container" style={{
      padding: '16px', paddingBottom: player.currentTrack ? '140px' : '20px',
      maxWidth: '600px', margin: '0 auto', minHeight: '100vh',
      background: '#000', color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
    }}>
      
      <Header 
        tgUser={tgUser}
        isDownloadPanelOpen={isDownloadPanelOpen}
        setIsDownloadPanelOpen={setIsDownloadPanelOpen}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        pendingTracks={pendingTracks}
        downloadQueue={downloadQueue}
      />

     {isSearchOpen && (
      <div style={{ marginBottom: '20px', transition: 'all 0.3s ease' }}>
        <div style={{
          display: 'flex', alignItems: 'center', background: '#1c1c1e',
          borderRadius: '10px', padding: '8px 12px', height: '36px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>

          <input
            autoFocus type="text" placeholder="Поиск" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'transparent', color: '#fff', fontSize: '17px', border: 'none', outline: 'none', padding: '0', caretColor: '#007aff' }}
          />

          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: '8px', padding: '4px', borderRadius: '6px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    )}

      {isDownloadPanelOpen && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Загрузки</h3>
            <span onClick={() => setDownloadQueue([])} style={{ color: '#fa2d48', fontSize: '15px', fontWeight: '500' }}>Очистить</span>
          </div>
          {(downloadQueue || []).map(track => (
            <TrackItem 
              key={`q-${track.deezer_id}`} track={track} isFromQueue={true} 
              isActive={player.currentTrack?.deezer_id === track.deezer_id} 
              isPlaying={player.isPlaying} pendingData={pendingTracks[track.deezer_id]} 
              now={now} onClick={handleTrackSelect} 
            />
          ))}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>
          {isSearchOpen ? (isSearching ? 'Поиск...' : 'Результаты') : 'Медиатека'}
        </h3>
        {(isSearchOpen ? (searchResults || []) : (library || [])).map(track => (
          <TrackItem 
            key={`lib-${track.deezer_id}`} track={track} 
            isActive={player.currentTrack?.deezer_id === track.deezer_id} 
            isPlaying={player.isPlaying} pendingData={pendingTracks[track.deezer_id]} 
            now={now} onClick={handleTrackSelect} 
          />
        ))}
        {!isSearchOpen && library.length === 0 && (
          <p style={{ color: '#8e8e93', textAlign: 'center', marginTop: '40px' }}>Ваша медиатека пуста</p>
        )}
      </div>

      <FullPlayer 
        {...player} isOpen={isFullPlayerOpen} onClose={() => setIsFullPlayerOpen(false)} 
        formatTime={formatTime} handleLike={handleLike} favoriteTrackIds={favoriteTrackIds} 
      />

      <AudioPlayer 
        {...player} isMobile={isMobile} isFullPlayerOpen={isFullPlayerOpen} 
        setIsFullPlayerOpen={setIsFullPlayerOpen} formatTime={formatTime} 
        handleLike={handleLike} favoriteTrackIds={favoriteTrackIds} backendBaseUrl={backendBaseUrl} 
      />
    </div>
  );
}

export default App;