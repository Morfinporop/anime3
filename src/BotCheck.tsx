import { useState, useEffect, useRef } from 'react';

interface Props {
  onVerify: (token: string) => void;
}

export default function BotCheck({ onVerify }: Props) {
  const [state, setState] = useState<'idle' | 'checking' | 'verify' | 'done' | 'failed'>('idle');
  const [pulse, setPulse] = useState(0);
  const [pulse2, setPulse2] = useState(0);
  const moveLogRef = useRef<string[]>([]);
  const startTimeRef = useRef(0);

  useEffect(() => {
    if (state !== 'checking' && state !== 'verify') return;
    const start = Date.now();
    let frame: number;
    const animate = () => {
      const t = (Date.now() - start) / 1000;
      setPulse(0.35 + 0.25 * Math.sin(t * 5));
      setPulse2(0.25 + 0.15 * Math.sin(t * 4.5 + 2));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  const collectSignals = (): Record<string, any> => {
    const s: Record<string, any> = {};
    s.userAgent = navigator.userAgent;
    s.language = navigator.language;
    s.languages = (navigator as any).languages?.join(',') || '';
    s.platform = (navigator as any).platform || 'unknown';
    s.screenW = screen.width;
    s.screenH = screen.height;
    s.colorDepth = screen.colorDepth;
    s.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    s.timezoneOffset = new Date().getTimezoneOffset();
    s.cpuCores = (navigator as any).hardwareConcurrency || 1;
    s.deviceMemory = (navigator as any).deviceMemory || 'unknown';
    s.hasCookies = document.cookie.length > 0;
    s.hasStorage = localStorage.length > 0;
    s.hasSession = sessionStorage.length > 0;
    s.referrer = document.referrer || 'direct';
    s.online = navigator.onLine;
    s.doNotTrack = navigator.doNotTrack || 'unspecified';
    s.touchPoints = (navigator as any).maxTouchPoints || 0;
    s.vendor = (navigator as any).vendor || 'unknown';
    s.productSub = (navigator as any).productSub || 'unknown';
    s.movementCount = moveLogRef.current.length;
    s.movementVariance = calcVariance(moveLogRef.current);
    s.timeOnPage = Date.now() - startTimeRef.current;
    return s;
  };

  const calcVariance = (log: string[]): number => {
    if (log.length < 2) return 0;
    const nums = log.flatMap(l => l.split(',').map(Number)).filter(n => !isNaN(n));
    if (nums.length < 2) return 0;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return nums.reduce((a, b) => a + (b - avg) ** 2, 0) / nums.length;
  };

  const isBot = (s: Record<string, any>): { verdict: boolean; reason: string } => {
    // No cookies + no storage + no session = suspicious
    if (!s.hasCookies && !s.hasStorage && !s.hasSession) return { verdict: true, reason: 'no_data' };
    // No mouse movement at all
    if (s.movementCount < 2) return { verdict: true, reason: 'no_movement' };
    // Mouse movement has zero variance (scripted)
    if (s.movementCount > 5 && s.movementVariance < 0.5) return { verdict: true, reason: 'scripted_movement' };
    // Time on page too short
    if (s.timeOnPage < 500) return { verdict: true, reason: 'too_fast' };
    // Headless browser indicators
    if (s.productSub === '20030107' && s.vendor === 'Google Inc.' && !s.hasStorage) return { verdict: true, reason: 'headless' };
    // No language / generic
    if (!s.language || s.language === 'en-US' && s.timezone === 'UTC' && !s.hasCookies) return { verdict: true, reason: 'generic_env' };
    return { verdict: false, reason: 'ok' };
  };

  const startCheck = () => {
    if (state !== 'idle') return;
    setState('checking');
    startTimeRef.current = Date.now();
    moveLogRef.current = [];

    const onMouseMove = (e: MouseEvent) => {
      moveLogRef.current.push(`${Math.round(e.movementX)},${Math.round(e.movementY)}`);
    };
    document.addEventListener('mousemove', onMouseMove);

    // Phase 1: passive scan 1.5-2.5s
    setTimeout(() => {
      const s = collectSignals();
      const result = isBot(s);

      if (result.verdict) {
        // Suspicious - phase 2: extended check
        setState('verify');
        setTimeout(() => {
          const s2 = collectSignals();
          const result2 = isBot(s2);
          document.removeEventListener('mousemove', onMouseMove);

          if (result2.verdict) {
            setState('failed');
          } else {
            const token = 'botok_' + Date.now() + '_v2_' + Math.random().toString(36).slice(2);
            setState('done');
            onVerify(token);
          }
        }, 2000);
      } else {
        document.removeEventListener('mousemove', onMouseMove);
        const token = 'botok_' + Date.now() + '_ok_' + Math.random().toString(36).slice(2);
        setState('done');
        onVerify(token);
      }
    }, 1500 + Math.random() * 1000);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={startCheck}
        disabled={state !== 'idle' && state !== 'failed'}
        className={`relative flex-shrink-0 h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-colors ${
          state === 'done' ? 'border-zinc-900 bg-white' :
          state === 'failed' ? 'border-red-400 bg-white' :
          state === 'checking' || state === 'verify' ? 'border-zinc-300 bg-white' :
          'border-zinc-300 bg-white/60 hover:border-zinc-900'
        }`}
      >
        {state === 'done' ? (
          <svg className="h-4 w-4 text-zinc-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
        ) : state === 'failed' ? (
          <svg className="h-4 w-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6L6 18M6 6l12 12" /></svg>
        ) : state === 'checking' || state === 'verify' ? (
          <>
            <div className="absolute rounded-full bg-zinc-200/60 transition-all duration-200"
              style={{ width: `${20 + pulse * 35}px`, height: `${20 + pulse * 35}px` }} />
            <div className="absolute rounded-full bg-zinc-200/40 transition-all duration-200"
              style={{ width: `${14 + pulse2 * 30}px`, height: `${14 + pulse2 * 30}px` }} />
          </>
        ) : null}
      </button>
      <div>
        <p className="text-sm font-semibold text-zinc-800">
          {state === 'idle' ? 'Проверка на бота' :
           state === 'checking' ? 'Анализ активности...' :
           state === 'verify' ? 'Дополнительная проверка...' :
           state === 'done' ? 'Проверка пройдена' :
           'Ошибка проверки'}
        </p>
        <p className="text-xs text-zinc-400">
          {state === 'idle' ? 'Это займёт всего несколько секунд' :
           state === 'failed' ? 'Нажмите чтобы повторить' :
           'Сканирование истории и сигналов...'}
        </p>
      </div>
    </div>
  );
}
