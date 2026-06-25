import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, SkipBack, SkipForward, Check, Loader2 } from 'lucide-react';

interface Props {
  videoSrc: string;
  poster?: string;
  title?: string;
  onEnded?: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 1.25, 1.5, 1.75, 2];

const formatTime = (s: number) => {
  if (!isFinite(s) || isNaN(s) || s < 0) return '0:00';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

export default function VideoPlayer({ videoSrc, poster, title, onEnded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const onEndedRef = useRef(onEnded);
  const isDraggingSeek = useRef(false);
  const isDraggingVolume = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCenterButton, setShowCenterButton] = useState(false);
  const centerTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    const video = videoRef.current; if (!video) return;
    const onMeta = () => { setDuration(video.duration || 0); setLoading(false); setTimeout(() => video.play().catch(() => {}), 100); };
    const onTime = () => setPosition(video.currentTime);
    const onProgress = () => { if (video.buffered.length > 0 && video.duration > 0) setBuffered(video.buffered.end(video.buffered.length - 1) / video.duration); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => { setPlaying(false); onEndedRef.current?.(); };
    const onErr = () => { setError('Не удалось загрузить видео'); setLoading(false); };
    const onWait = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('progress', onProgress);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnd);
    video.addEventListener('error', onErr);
    video.addEventListener('waiting', onWait);
    video.addEventListener('canplay', onCanPlay);
    return () => {
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnd);
      video.removeEventListener('error', onErr);
      video.removeEventListener('waiting', onWait);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, [videoSrc]);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = speed; }, [speed]);
  useEffect(() => { const v = videoRef.current; if (!v) return; v.volume = volume; v.muted = muted; }, [volume, muted]);

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

  // Seek with drag — uses mousedown/move/up for hold-to-seek
  const seekBarRef = useRef<HTMLDivElement>(null);
  const onSeekDown = (e: React.MouseEvent) => {
    isDraggingSeek.current = true;
    applySeek(e);
    document.addEventListener('mousemove', onSeekMoveGlobal);
    document.addEventListener('mouseup', onSeekUpGlobal);
  };
  const applySeek = (e: React.MouseEvent | MouseEvent) => {
    const v = videoRef.current; const bar = seekBarRef.current; if (!v || !v.duration || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = v.duration * pct;
    setPosition(v.currentTime);
  };
  const onSeekMoveGlobal = (e: MouseEvent) => { if (isDraggingSeek.current) applySeek(e); };
  const onSeekUpGlobal = () => { isDraggingSeek.current = false; document.removeEventListener('mousemove', onSeekMoveGlobal); document.removeEventListener('mouseup', onSeekUpGlobal); };

  // Volume drag
  const volumeBarRef = useRef<HTMLInputElement>(null);
  const onVolumeDown = () => { isDraggingVolume.current = true; document.addEventListener('mousemove', onVolumeMoveGlobal); document.addEventListener('mouseup', onVolumeUpGlobal); };
  const onVolumeMoveGlobal = () => { /* native input handles it */ };
  const onVolumeUpGlobal = () => { isDraggingVolume.current = false; document.removeEventListener('mousemove', onVolumeMoveGlobal); document.removeEventListener('mouseup', onVolumeUpGlobal); };

  const showUI = controlsVisible || !playing;
  const progressPct = duration > 0 ? (position / duration) * 100 : 0;
  const bufferedPct = Math.min(100, buffered * 100);

  return (
    <div ref={containerRef}
      className="group/player relative mx-auto w-full overflow-hidden bg-black shadow-2xl select-none"
      style={{ aspectRatio: '16/9' }}
      onMouseEnter={resetHideTimer} onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setControlsVisible(false); }}
    >
      <video ref={videoRef} src={videoSrc} poster={poster}
        className="block h-full w-full bg-black object-contain"
        playsInline preload="metadata"
        onClick={() => { togglePlay(); flashCenterButton(); }}
        onDoubleClick={toggleFullscreen}
      />

      {/* Center play/pause flash */}
      <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-200 ${showCenterButton ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
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

      {/* Title overlay — fades with controls */}
      <div className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent px-4 py-3 pointer-events-none transition-opacity duration-200 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        {title && <p className="text-white text-sm font-semibold drop-shadow-lg">{title}</p>}
      </div>

      {/* Controls bar */}
      <div className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-200 sm:px-4 ${showUI ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {/* Seek bar — thicker, no thumb circle, black background */}
        <div ref={seekBarRef}
          className="relative flex items-center cursor-pointer py-1"
          onMouseDown={onSeekDown}
          onClick={applySeek}
        >
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[5px] rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/30" style={{ width: `${bufferedPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-white" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="mt-1 flex items-center gap-1 text-white sm:gap-2">
          <button onClick={() => { togglePlay(); flashCenterButton(); }} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
            {playing ? <Pause className="h-5 w-5 fill-white" /> : <Play className="h-5 w-5 fill-white ml-0.5" />}
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 sm:flex">
            <SkipBack className="h-4 w-4" />
          </button>
          <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); }} className="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 sm:flex">
            <SkipForward className="h-4 w-4" />
          </button>

          <div className="flex items-center">
            <button onClick={() => setMuted(m => !m)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input ref={volumeBarRef} type="range" min={0} max={1} step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
              onMouseDown={onVolumeDown}
              className="ml-1 h-1 w-16 sm:w-20 cursor-pointer appearance-none rounded-full bg-white/30 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white hidden group-hover/player:block sm:block"
            />
          </div>

          <div className="ml-1 font-mono text-xs tabular-nums text-white/95">
            {formatTime(position)} <span className="text-white/60">/ {formatTime(duration)}</span>
          </div>
          <div className="flex-1" />

          <div className="relative">
            <button onClick={() => setShowSettings(s => !s)} className={`flex h-8 w-8 items-center justify-center rounded-full ${showSettings ? 'bg-white/20' : 'hover:bg-white/15'}`}>
              <Settings className="h-4 w-4" />
            </button>
            {showSettings && (
              <div className="absolute bottom-10 right-0 z-40 w-40 overflow-hidden rounded-xl bg-black/95 text-white shadow-2xl ring-1 ring-white/10">
                <div className="text-[10px] font-semibold px-3 py-2 border-b border-white/10 text-white/60">Скорость</div>
                <div className="p-1">
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)} className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-white/10 ${speed === s ? 'font-semibold' : ''}`}>
                      {s === 1 ? 'Обычная' : `${s}x`}{speed === s && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
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
