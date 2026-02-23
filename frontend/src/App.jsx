import React, { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import FullPlayer from './components/FullPlayer';
import AudioPlayer from './components/AudioPlayer';
import Header from './components/Header';
import ArtistItem, { ArtistsSection } from './components/ArtistItem';
import AlbumItem, { AlbumsSection } from './components/AlbumItem';
import AlbumPage from './components/AlbumPage';
import ArtistPage from './components/ArtistPage';
import { useAudioPlayer } from './hooks/useAudioPlayer'; 
import TrackItem, { TracksContainer } from './components/TrackItem';
import './App.css';
import './theme.css';

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
  const backendBaseUrl = "https://138.124.108.4.nip.io";

  // --- Состояния интерфейса и данных ---
  const [now, setNow] = useState(Date.now());
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [tgUser, setTgUser] = useState(null);
  const [manualChatId, setManualChatId] = useState('');
  const [library, setLibrary] = useState([]);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState(new Set());
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchArtists, setSearchArtists] = useState([]);
  const [searchAlbums, setSearchAlbums] = useState([]);
  const debouncedSearch = useDebounce(searchQuery, 500);

  const [activeArtistId, setActiveArtistId] = useState(null);
  const [activeAlbumId, setActiveAlbumId] = useState(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isDownloadPanelOpen, setIsDownloadPanelOpen] = useState(false);

  const [theme, setTheme] = useState('dark');
  const [isTelegram, setIsTelegram] = useState(true);

  // --- Состояния загрузки треков ---
  const [pendingTracks, setPendingTracks] = useState({});
  const [downloadQueue, setDownloadQueue] = useState([]);
  const loadingTimersRef = useRef({});

  // --- НОВОЕ: Состояние для текущей очереди треков ---
  const [currentQueue, setCurrentQueue] = useState([]);

  // Инициализация плеера (передаем currentQueue вместо library)
  const player = useAudioPlayer(currentQueue, (track) => handleTrackSelect(track, true, currentQueue));

  const handleNextRef = useRef(player.handleNext);
  const handlePrevRef = useRef(player.handlePrev);
  const togglePlayRef = useRef(player.togglePlay);

  useEffect(() => {
    handleNextRef.current = player.handleNext;
    handlePrevRef.current = player.handlePrev;
    togglePlayRef.current = player.togglePlay;
  }, [player.handleNext, player.handlePrev, player.togglePlay]);

  // MediaSession API
  useEffect(() => {
    const { currentTrack, isPlaying, duration, currentTime, audioRef } = player;
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album: 'Deezer Player',
        artwork: [{ src: currentTrack.cover_url || 'default_cover.png', sizes: '512x512', type: 'image/png' }]
      });
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      if (navigator.mediaSession.setPositionState && Number.isFinite(duration) && duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: 1,
            position: Math.min(currentTime, duration)
          });
        } catch (e) {}
      }
      navigator.mediaSession.setActionHandler('play', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('pause', () => togglePlayRef.current());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNextRef.current?.());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevRef.current?.());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && audioRef?.current) audioRef.current.currentTime = details.seekTime;
      });
    }
  }, [player.currentTrack, player.isPlaying, player.duration]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  // Auth & Theme
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const savedChatId = localStorage.getItem('custom_chat_id');
    const isActuallyInTg = !!(tg && tg.initData);
    setIsTelegram(isActuallyInTg);

    if (isActuallyInTg && tg.initDataUnsafe?.user) {
      tg.ready(); tg.expand();
      const tgTheme = tg.colorScheme || 'dark';
      document.documentElement.setAttribute('data-theme', tgTheme);
      setTheme(tgTheme);
      setTgUser(tg.initDataUnsafe.user);
      fetchLibrary(tg.initDataUnsafe.user.id);
    } else {
      const savedTheme = localStorage.getItem('app_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      setTheme(savedTheme);
      if (savedChatId) {
        setTgUser({ id: savedChatId, first_name: "User " + savedChatId });
        fetchLibrary(savedChatId);
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('app_theme', newTheme);
  };

  const handleAuth = () => {
    if (manualChatId.trim()) {
      localStorage.setItem('custom_chat_id', manualChatId);
      setTgUser({ id: manualChatId, first_name: "User " + manualChatId });
      fetchLibrary(manualChatId);
    }
  };

  const fetchLibrary = useCallback((userId) => {
    axios.get(`${backendBaseUrl}/api/tracks?user_id=${userId}`)
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setLibrary(data);
        setFavoriteTrackIds(new Set(data.map(t => t.deezer_id)));
        // Если очередь пустая (первый запуск), ставим библиотеку как очередь
        setCurrentQueue(prev => prev.length === 0 ? data : prev);
      })
      .catch(() => setLibrary([]));
  }, [backendBaseUrl]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Search Logic
  useEffect(() => {
    const cleanQuery = debouncedSearch.trim();
    if (cleanQuery.length > 1) {
      setIsSearching(true);
      Promise.all([
        axios.get(`${backendBaseUrl}/api/search/deezer?q=${encodeURIComponent(cleanQuery)}`),
        axios.get(`${backendBaseUrl}/api/search/artist?q=${encodeURIComponent(cleanQuery)}`),
        axios.get(`${backendBaseUrl}/api/search/album?q=${encodeURIComponent(cleanQuery)}`)
      ])
        .then(([tracksRes, artistsRes, albumsRes]) => {
          setSearchResults(Array.isArray(tracksRes.data) ? tracksRes.data : []);
          setSearchArtists(Array.isArray(artistsRes.data) ? artistsRes.data : []);
          setSearchAlbums(Array.isArray(albumsRes.data) ? albumsRes.data : []);
        })
        .catch(() => {
          setSearchResults([]); setSearchArtists([]); setSearchAlbums([]);
        })
        .finally(() => setIsSearching(false));
    } else {
      setSearchResults([]); setSearchArtists([]); setSearchAlbums([]); setIsSearching(false);
    }
  }, [debouncedSearch, backendBaseUrl]);

  const handleLike = async (track) => {
    if (!tgUser || !track) return;
    const isLiked = favoriteTrackIds.has(track.deezer_id);
    setFavoriteTrackIds(prev => {
        const next = new Set(prev);
        if (isLiked) next.delete(track.deezer_id); else next.add(track.deezer_id);
        return next;
    });
    try {
        await axios.post(`${backendBaseUrl}/api/tracks/${isLiked ? 'unlike' : 'like'}`, {
            user_id: Number(tgUser.id), 
            deezer_id: Number(track.deezer_id),
            title: track.title || "",
            artist: track.artist?.name || track.artist || "",
            cover_url: track.album?.cover_big || track.cover_url || ""
        });
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    } catch (err) { console.error(err); } 
    finally { fetchLibrary(tgUser.id); }
  };

  const requestTrack = useCallback(async (track, isRetry = false, autoPlay = true) => {
    const trackId = track.deezer_id;
    try {
      const response = await axios.post(`${backendBaseUrl}/api/tracks/play`, track);
      if (response.status === 200) {
        if (isRetry) {
          setPendingTracks(prev => ({ ...prev, [trackId]: { ...prev[trackId], isDone: true } }));
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
          if (autoPlay) {
            player.setIsPlaying(true); 
          } else {
            player.setIsPlaying(false); 
          } 
        }
      } else if (response.status === 202) {
        setDownloadQueue(prev => prev.find(t => t.deezer_id === trackId) ? prev : [track, ...prev]);
        setPendingTracks(prev => prev[trackId] ? prev : ({ 
          ...prev, 
          [trackId]: { finishTime: Date.now() + 15000, totalWait: 15000, isDone: false } 
        }));
        loadingTimersRef.current[trackId] = setTimeout(() => requestTrack(track, true), 5000);
      }
    } catch (err) { 
      clearLoadingState(trackId); 
    }
  }, [backendBaseUrl, tgUser, player, fetchLibrary]);

  // --- ИСПРАВЛЕННЫЙ handleTrackSelect ---
  // Теперь принимает третий аргумент - список треков, из которого был запущен текущий трек
  const handleTrackSelect = useCallback(async (track, autoPlay = true, newQueue = null) => {
    if (!track) return;
    
    player.prepareAudio();

    // Если передан новый список (например, из поиска или альбома), обновляем текущую очередь в App
    if (newQueue && Array.isArray(newQueue)) {
      setCurrentQueue(newQueue);
    }

    const isSameTrack = player.currentTrack?.deezer_id === track.deezer_id;
    if (isSameTrack) {
      player.togglePlay();
      return;
    }

    if (pendingTracks[track.deezer_id]) return;
    await requestTrack(track, false, autoPlay);
  }, [
    player.currentTrack?.deezer_id, 
    player.togglePlay,
    pendingTracks, 
    requestTrack,
    player.prepareAudio
  ]);

  const clearLoadingState = (trackId) => {
    setPendingTracks(prev => { const newState = { ...prev }; delete newState[trackId]; return newState; });
    if (loadingTimersRef.current[trackId]) { clearTimeout(loadingTimersRef.current[trackId]); delete loadingTimersRef.current[trackId]; }
  };

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;
    if (isFullPlayerOpen) {
      tg.BackButton.show();
      tg.BackButton.onClick(() => setIsFullPlayerOpen(false));
    } else tg.BackButton.hide();
  }, [isFullPlayerOpen]);

  const wasLinkProcessed = useRef(false);
  useEffect(() => {
    if (wasLinkProcessed.current) return;
    const tg = window.Telegram?.WebApp;
    const startParam = tg?.initDataUnsafe?.start_param;
    const params = new URLSearchParams(window.location.search);
    const trackIdFromUrl = startParam || params.get('track');
    if (trackIdFromUrl && tgUser) {
      const fetchAndPlay = async () => {
        try {
          const statusRes = await axios.get(`${backendBaseUrl}/api/tracks/status/${trackIdFromUrl}`);
          if (statusRes.data && statusRes.data.status !== 'not_found') handleTrackSelect(statusRes.data, false);
          else {
            const searchRes = await axios.get(`${backendBaseUrl}/api/search/deezer?q=${trackIdFromUrl}`);
            const found = searchRes.data.find(t => String(t.deezer_id) === String(trackIdFromUrl));
            handleTrackSelect(found || { deezer_id: parseInt(trackIdFromUrl) }, false);
          }
        } catch (err) { handleTrackSelect({ deezer_id: parseInt(trackIdFromUrl), title: "Загрузка..." }); }
      };
      fetchAndPlay(); setIsFullPlayerOpen(true); wasLinkProcessed.current = true;
      if (params.get('track')) window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    }
  }, [tgUser, handleTrackSelect, backendBaseUrl]);

    if (!tgUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-color)', padding: '20px', textAlign: 'center' }}>
        {!isTelegram && (
          <div style={{ position: 'absolute', top: '20px', right: '20px' }} onClick={toggleTheme}>
            <div style={{ width: '40px', height: '20px', background: 'var(--bg-surface)', borderRadius: '20px', position: 'relative', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: '16px', height: '16px', background: 'var(--accent-color)', borderRadius: '50%', position: 'absolute', top: '1px', left: theme === 'dark' ? '21px' : '1px', transition: 'all 0.2s ease' }} />
            </div>
          </div>
        )}
        <h3>Вход в систему</h3>
        <input type="text" placeholder="Введите Telegram Chat ID" value={manualChatId} onChange={(e) => setManualChatId(e.target.value)} style={{ background: 'var(--bg-surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '12px', color: 'var(--text-color)', fontSize: '16px', width: '100%', maxWidth: '300px', marginBottom: '15px' }} />
        <button onClick={handleAuth} style={{ background: 'var(--accent-color)', border: 'none', borderRadius: '10px', padding: '12px 30px', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>Войти</button>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ background: 'var(--bg-color)', color: 'var(--text-color)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      
      {!isTelegram && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <div onClick={toggleTheme} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <span>{theme === 'dark' ? '🌙 Темная' : '☀️ Светлая'}</span>
            <div style={{ width: '34px', height: '18px', background: 'var(--bg-surface)', borderRadius: '18px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: '14px', height: '14px', background: 'var(--accent-color)', borderRadius: '50%', position: 'absolute', top: '1px', left: theme === 'dark' ? '17px' : '1px', transition: 'all 0.2s ease' }} />
            </div>
          </div>
        </div>
      )}
      
      <Header 
        tgUser={tgUser}
        isDownloadPanelOpen={isDownloadPanelOpen}
        setIsDownloadPanelOpen={setIsDownloadPanelOpen}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchQuery={searchQuery}       
        setSearchQuery={setSearchQuery}
        pendingTracks={pendingTracks}
        downloadQueue={downloadQueue}
        backendBaseUrl={backendBaseUrl}
      />

      <div>
        <TracksContainer maxHeight={"calc(88vh)"}>
        {isDownloadPanelOpen && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Загрузки</h3>
            <span onClick={() => setDownloadQueue([])} style={{ color: 'var(--accent-color)', fontSize: '15px', fontWeight: '500', cursor: 'pointer' }}>Очистить</span>
          </div>
          <TracksContainer>
            {downloadQueue.map(track => (
              <TrackItem 
                key={`q-${track.deezer_id}`} 
                track={track} 
                isFromQueue={true} 
                isActive={player.currentTrack?.deezer_id === track.deezer_id} 
                isPlaying={player.currentTrack?.deezer_id === track.deezer_id && player.isPlaying}
                pendingData={pendingTracks[track.deezer_id]} 
                now={now} 
                onClick={(t) => handleTrackSelect(t, true, downloadQueue)} 
              />
            ))}
          </TracksContainer>
        </div>
      )}
          <h3 style={{ fontSize: '20px', fontWeight: '700' }}>
            {isSearchOpen ? (isSearching ? 'Поиск...' : 'Результаты') : 'Медиатека'}
          </h3>
          <div>
            {isSearchOpen && (
              <>
                <ArtistsSection artists={searchArtists} onArtistClick={(artist) => setActiveArtistId(artist.id)} onAlbumClick={(album) => setActiveAlbumId(album.id)} />
                <AlbumsSection albums={searchAlbums} onAlbumClick={(album) => setActiveAlbumId(album.id)} />
              </>
            )}

            {(isSearchOpen ? searchResults : library).map(track => (
              <TrackItem 
                key={`lib-${track.deezer_id}`} 
                track={track} 
                isActive={player.currentTrack?.deezer_id === track.deezer_id} 
                isPlaying={player.isPlaying} 
                pendingData={pendingTracks[track.deezer_id]} 
                now={now} 
                onClick={(t) => handleTrackSelect(t, true, isSearchOpen ? searchResults : library)} 
              />
            ))}

            {!isSearchOpen && library.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>Ваша медиатека пуста</p>
            )}
          </div>
          <div style={{ height: player.currentTrack ? '80px' : '0px', transition: 'height 0.3s ease', flexShrink: 0 }} />
        </TracksContainer>

        {activeArtistId && (
          <ArtistPage 
            artistId={activeArtistId} 
            onAlbumClick={setActiveAlbumId} 
            backendBaseUrl={backendBaseUrl} 
            onBack={() => setActiveArtistId(null)} 
            onTrackSelect={handleTrackSelect} // AlbumPage/ArtistPage внутри вызовут handleTrackSelect с нужным списком
            currentTrack={player.currentTrack} 
            isPlaying={player.isPlaying} 
            pendingTracks={pendingTracks} 
            now={now} 
          />
        )}
        {activeAlbumId && (
          <AlbumPage 
            albumId={activeAlbumId} 
            onBack={() => setActiveAlbumId(null)} 
            backendBaseUrl={backendBaseUrl} 
            onTrackSelect={handleTrackSelect} 
            currentTrack={player.currentTrack} 
            isPlaying={player.isPlaying} 
            pendingTracks={pendingTracks} 
            now={now} 
          />
        )}
      </div>

      {player.currentTrack && (
        <FullPlayer 
    {...player}         
    isOpen={isFullPlayerOpen}
    onClose={() => setIsFullPlayerOpen(false)} 
    formatTime={formatTime} 
    handleLike={handleLike} 
    favoriteTrackIds={favoriteTrackIds} 
    onArtistClick={(id) => {
      setActiveArtistId(id);
      setIsFullPlayerOpen(false);
    }} 
    backendBaseUrl={backendBaseUrl}
  />
      )}

      <AudioPlayer 
  {...player}             // Это тоже содержит и volume, и setVolume внутри
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