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
  const backendBaseUrl = "http://localhost:8080";

  // --- Состояния интерфейса и данных ---
  const [now, setNow] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [tgUser, setTgUser] = useState(null);
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

  // --- ИНИЦИАЛИЗАЦИЯ ПЛЕЕРА ЧЕРЕЗ ХУК ---
  // Мы передаем библиотеку и функцию выбора, чтобы хук знал, как переключать треки
  const player = useAudioPlayer(library, (track) => handleTrackSelect(track));

  // Обновление времени для анимаций (100мс)
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  // Telegram Init
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.setHeaderColor('secondary_bg_color');
      const user = tg.initDataUnsafe?.user || { id: 690431190, first_name: "Dev_User" };
      setTgUser(user);
      fetchLibrary(user.id);
    } else {
      setTgUser(mockUser);
      fetchLibrary(mockUser.id);
    }
  }, []);

  const fetchLibrary = useCallback((userId) => {
    axios.get(`${backendBaseUrl}/api/tracks?user_id=${userId}`)
      .then(res => {
        setLibrary(res.data);
        setFavoriteTrackIds(new Set(res.data.map(t => t.deezer_id)));
      })
      .catch(err => console.error("Ошибка загрузки медиатеки:", err));
  }, [backendBaseUrl]);

  // Resize listener
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
          setSearchResults(res.data);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [debouncedSearch, backendBaseUrl]);

  // --- Логика Лайков ---
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
      window.Telegram?.WebApp?.HapticFeedback?.[isLiked ? 'impactOccurred' : 'notificationOccurred'](isLiked ? 'light' : 'success');
    } catch (err) {
      console.error(err);
    } finally {
      fetchLibrary(tgUser.id);
    }
  };

  // --- Логика Загрузки Треков ---
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
          setPendingTracks(prev => ({ ...prev, [trackId]: { ...prev[trackId], isDone: true } }));
          setTimeout(() => {
            clearLoadingState(trackId);
            player.setCurrentTrack({ ...track, play_link: response.data.play_link, track_id: response.data.track_id });
            player.setIsPlaying(true);
          }, 1500);
        } else {
          clearLoadingState(trackId);
          player.setCurrentTrack({ ...track, play_link: response.data.play_link, track_id: response.data.track_id });
          player.setIsPlaying(true);
        }
      } else if (response.status === 202) {
        setDownloadQueue(prev => prev.find(t => t.deezer_id === trackId) ? prev : [track, ...prev]);
        setPendingTracks(prev => ({
          ...prev,
          [trackId]: { finishTime: Date.now() + 15000, totalWait: 15000, isDone: false }
        }));
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

  // BackButton Telegram
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

  return (
    <div style={{
      padding: '16px', paddingBottom: player.currentTrack ? '140px' : '20px',
      maxWidth: '600px', margin: '0 auto', minHeight: '100vh',
      background: 'var(--tg-theme-bg-color, #000)', color: 'var(--tg-theme-text-color, #fff)',
      fontFamily: '-apple-system, system-ui, sans-serif'
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
        <div style={{ marginBottom: '20px' }}>
          <input
            autoFocus type="text" placeholder="Артисты, песни..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: 'none', background: '#1c1c1e', color: '#fff', fontSize: '16px', outline: 'none' }}
          />
        </div>
      )}

      {isDownloadPanelOpen && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '22px', fontWeight: '700' }}>Загрузки</h3>
            <span onClick={() => setDownloadQueue([])} style={{ color: '#fa2d48', cursor: 'pointer' }}>Очистить</span>
          </div>
          {downloadQueue.map(track => (
            <TrackItem key={`q-${track.deezer_id}`} track={track} isFromQueue={true} isActive={player.currentTrack?.deezer_id === track.deezer_id} isPlaying={player.isPlaying} pendingData={pendingTracks[track.deezer_id]} now={now} onClick={handleTrackSelect} />
          ))}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '16px' }}>
          {isSearchOpen ? 'Поиск' : 'Медиатека'}
        </h3>
        {(isSearchOpen ? searchResults : library).map(track => (
          <TrackItem key={`lib-${track.deezer_id}`} track={track} isActive={player.currentTrack?.deezer_id === track.deezer_id} isPlaying={player.isPlaying} pendingData={pendingTracks[track.deezer_id]} now={now} onClick={handleTrackSelect} />
        ))}
      </div>

      <FullPlayer 
        {...player} 
        isOpen={isFullPlayerOpen} 
        onClose={() => setIsFullPlayerOpen(false)} 
        formatTime={formatTime} 
        handleLike={handleLike} 
        favoriteTrackIds={favoriteTrackIds} 
      />

      <AudioPlayer 
        {...player} 
        isMobile={isMobile} 
        isFullPlayerOpen={isFullPlayerOpen} 
        setIsFullPlayerOpen={setIsFullPlayerOpen} 
        formatTime={formatTime} 
        handleLike={handleLike} 
        favoriteTrackIds={favoriteTrackIds} 
        backendBaseUrl={backendBaseUrl} 
      />
    </div>
  );
}

export default App;