import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings,
  SkipBack, SkipForward, Check, Loader2,
} from 'lucide-react';
import Hls from 'hls.js';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface Props {
  videoSrc: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
  qualityLevels?: { label: string; src: string; default?: boolean }[];
}

const SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 1.75, 2];

const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function VideoPlayer({ videoSrc, poster, title, onEnded, qualityLevels }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);
  const [qualities, setQualities] = useState<{ label: string; index: number; active: boolean }[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'speed' | 'quality'>('speed');
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCenterButton, setShowCenterButton] = useState(false);
  const centerTimerRef = useRef<number | null>(null);
  const plyrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onEndedRef.current = onEnded; }, [onEnded]);

  const flashCenterButton = useCallback(() => {
    setShowCenterButton(true);
    if (centerTimerRef.current) clearTimeout(centerTimerRef.current);
    centerTimerRef.current = window.setTimeout(() => setShowCenterButton(false), 700);
  }, []);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => { if (playing) setControlsVisible(false); }, 2500);
  }, [playing]);

  useEffect(() => { resetHideTimer(); return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }; }, [playing, resetHideTimer]);

  // Init Plyr + HLS
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Destroy old
    if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

    const initPlyr = () => {
      const plyr = new Plyr(video, {
        controls: [],
        clickToPlay: false,
        disableContextMenu: false,
        hideControls: false,
      });
      plyrRef.current = plyr;

      plyr.on('play', () => setPlaying(true));
      plyr.on('pause', () => setPlaying(false));
      plyr.on('ended', () => { setPlaying(false); onEndedRef.current?.(); });
      plyr.on('waiting', () => setLoading(true));
      plyr.on('canplay', () => setLoading(false));
      plyr.on('error', () => { setError('Не удалось загрузить видео'); setLoading(false); });
    };

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false, lowLatencyMode: false });
      hlsRef.current = hls;

      if (qualityLevels && qualityLevels.length > 0) {
        // Use an HLS master playlist build from quality sources
        hls.loadSource(videoSrc);
      } else {
        hls.loadSource(videoSrc);
      }

      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const qs: { label: string; index: number; active: boolean }[] = [];
        qs.push({ label: 'Авто', index: -1, active: true });
        hls.levels.forEach((level, i) => {
          qs.push({ label: `${level.height}p`, index: i, active: false });
        });
        setQualities(qs);
        setCurrentQuality(-1);
        setLoading(false);
        initPlyr();
        setTimeout(() => video.play().catch(() => {}), 100);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError('Ошибка загрузки видео');
          setLoading(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = videoSrc;
      video.addEventListener('loadedmetadata', () => {
        setDuration(video.duration || 0);
        setLoading(false);
        initPlyr();
        setTimeout(() => video.play().catch(() => {}), 100);
      });
    } else {
      // Plain MP4
      video.src = videoSrc;
      video.addEventListener('loadedmetadata', () => {
        setDuration(video.duration || 0);
        setLoading(false);
        initPlyr();
        setTimeout(() => video.play().catch(() => {}), 100);
      });
      // Build quality from qualityLevels
      if (qualityLevels && qualityLevels.length > 0) {
        const qs = qualityLevels.map((q, i) => ({ label: q.label, index: i, active: q.default || i === 0 }));
        setQualities(qs);
        setCurrentQuality(qualityLevels.findIndex(q => q.default) || 0);
      }
    }

    return () => {
      if (plyrRef.current) { plyrRef.current.destroy(); plyrRef.current = null; }
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [videoSrc, qualityLevels]);

  // Time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setPosition(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);
    const onEnd = () => { setPlaying(false); onEndedRef.current?.(); };
    const onWait = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onErr = () => { setError('Не удалось загрузить видео'); setLoading(false); };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('durationchange', onMeta);
    video.addEventListener('ended', onEnd);
    video.addEventListener('waiting', onWait);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onErr);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('durationchange', onMeta);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onErr);
    };
  }, [videoSrc]);

  // Speed
  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed]);
  // Volume
  useEffect(() => { const v = videoRef.current; if (v) { v.volume = volume; v.muted = muted; } }, [volume, muted]);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const v = videoRef.current; if (!v) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play().catch(() => {}) : v.pause(); flashCenterButton(); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + 10); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 10); break;
        case 'm': e.preventDefault(); setMuted(m => !m); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        default: if (e.key >= '0' && e.key <= '9' && v.duration) v.currentTime = v.duration * parseInt(e.key) / 10;
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current; if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen().catch(() => {}); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  }, []);
  useEffect(() => { const h = () => setIsFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; v.paused ? v.play().catch(() => {}) : v.pause(); };

  // Quality switch
  const switchQuality = (index: number) => {
    setCurrentQuality(index);
    if (index === -1 && hlsRef.current) {
      hlsRef.current.currentLevel = -1; // Auto
    } else if (hlsRef.current && hlsRef.current.levels[index] != null) {
      hlsRef.current.currentLevel = index;
    } else if (qualityLevels && qualityLevels[index] != null && videoRef.current) {
      const wasPlaying = !videoRef.current.paused;
      const pos = videoRef.current.currentTime;
      videoRef.current.src = qualityLevels[index].src;
      videoRef.current.currentTime = pos;
      if (wasPlaying) videoRef.current.play().catch(() => {});
    }
    setQualities(qs => qs.map(q => ({ ...q, active: q.index === index })));
    setShowSettings(false);
  };

  // Seek click only
  const seekBarRef = useRef<HTMLDivElement>(null);
  const onSeekClick = (e: React.MouseEvent) => {
    const v = videoRef.current; const bar = seekBarRef.current; if (!v || !v.duration || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = v.duration * pct;
    setPosition(v.currentTime);
  };

  const showUI = controlsVisible || !playing;
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <div ref={containerRef}
      className="group/player relative mx-auto w-full overflow-hidden bg-black shadow-2xl select-none rounded-lg sm:rounded-xl"
      style={{ aspectRatio: '16/9', maxHeight: 'calc(100vh - 140px)' }}
      onMouseEnter={resetHideTimer} onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setControlsVisible(false); }}>
      <div ref={plyrContainerRef} className="plyr__video-wrapper h-full w-full" style={{ aspectRatio: '16/9' }}>
        <video ref={videoRef} poster={poster}
          className="block h-full w-full bg-black object-contain"
          playsInline preload="metadata"
          onClick={() => { togglePlay(); flashCenterButton(); }}
          onDoubleClick={toggleFullscreen}
        />
      </div>

      {/* Center flash */}
      <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 ${showCenterButton ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50">
          {playing ? <Pause className="h-6 w-6 fill-white text-white" /> : <Play className="h-6 w-6 fill-white text-white ml-0.5" />}
        </div>
      </div>

      {!playing && !loading && !error && !showCenterButton && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60"><Play className="h-7 w-7 fill-white text-white ml-0.5" /></div>
        </div>
      )}

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-white/70" /></div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <div className="text-center"><p className="px-4 text-sm text-zinc-300">{error}</p>
            <button onClick={() => { setError(null); setLoading(true); videoRef.current?.load(); }} className="mt-3 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-zinc-900">Повторить</button></div>
        </div>
      )}

      {/* Title — fullscreen only */}
      {isFullscreen && title && (
        <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pointer-events-none transition-opacity duration-200 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
          <p className="text-white text-sm font-semibold drop-shadow-lg">{title}</p>
        </div>
      )}

      {/* Controls */}
      <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-200 sm:px-4 ${showUI ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div ref={seekBarRef} className="relative flex items-center cursor-pointer py-1.5" onClick={onSeekClick}>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
          <button onClick={() => { togglePlay(); flashCenterButton(); }} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 sm:flex"><SkipBack className="h-4 w-4" /></button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 sm:flex"><SkipForward className="h-4 w-4" /></button>

          <div className="flex items-center">
            <button onClick={() => setMuted(m => !m)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <div className="relative ml-1 w-16 sm:w-20 h-5 flex items-center cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setVolume(pct); setMuted(false);
              }}>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[6px] rounded-full bg-white/20">
                <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
              </div>
            </div>
          </div>

          <div className="ml-1 font-mono text-xs tabular-nums text-white/95">
            {formatTime(position)} <span className="text-white/60">/ {formatTime(duration)}</span>
          </div>
          <div className="flex-1" />

          {/* Settings: speed + quality */}
          <div className="relative">
            <button onClick={() => setShowSettings(s => !s)} className={`flex h-8 w-8 items-center justify-center rounded-full ${showSettings ? 'bg-white/20' : 'hover:bg-white/15'}`}>
              <Settings className="h-4 w-4" />
            </button>
            {showSettings && (
              <div className="absolute bottom-10 right-0 z-40 w-44 overflow-hidden rounded-xl bg-black/95 text-white shadow-2xl ring-1 ring-white/10">
                {settingsTab === 'speed' ? (
                  <>
                    <div className="flex border-b border-white/10">
                      <button onClick={() => setSettingsTab('speed')} className="flex-1 text-[10px] font-semibold py-2 bg-white/10 text-white">Скорость</button>
                      <button onClick={() => setSettingsTab('quality')} className="flex-1 text-[10px] font-semibold py-2 text-white/60">Качество</button>
                    </div>
                    <div className="p-1 max-h-56 overflow-y-auto">
                      {SPEEDS.map(s => (
                        <button key={s} onClick={() => { setSpeed(s); setShowSettings(false); }}
                          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-white/10 ${speed === s ? 'font-semibold' : ''}`}>
                          {s === 1 ? 'Обычная' : `${s}x`}{speed === s && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex border-b border-white/10">
                      <button onClick={() => setSettingsTab('speed')} className="flex-1 text-[10px] font-semibold py-2 text-white/60">Скорость</button>
                      <button onClick={() => setSettingsTab('quality')} className="flex-1 text-[10px] font-semibold py-2 bg-white/10 text-white">Качество</button>
                    </div>
                    <div className="p-1 max-h-56 overflow-y-auto">
                      {qualities.length === 0 && <p className="text-xs text-white/50 px-2 py-2">Нет вариантов</p>}
                      {qualities.map(q => (
                        <button key={q.index} onClick={() => switchQuality(q.index)}
                          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-white/10 ${q.active ? 'font-semibold' : ''}`}>
                          {q.label}{q.active && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15">
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
