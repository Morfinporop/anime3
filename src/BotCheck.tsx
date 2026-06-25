import { useState, useRef, useEffect } from 'react';

interface Props {
  onVerify: (token: string) => void;
}

export default function BotCheck({ onVerify }: Props) {
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle');
  const [pulse, setPulse] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Animated pulse ring
  useEffect(() => {
    if (state !== 'checking') return;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      setPulse(0.5 + 0.5 * Math.sin(elapsed / 400));
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [state]);

  // Particle canvas background while checking
  useEffect(() => {
    if (state !== 'checking') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 80;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    for (let i = 0; i < 12; i++) {
      particles.push({
        x: 40 + Math.random() * 20 - 10,
        y: 40 + Math.random() * 20 - 10,
        vx: (Math.random() - 0.5) * 25,
        vy: (Math.random() - 0.5) * 25,
        r: 1.5 + Math.random() * 2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, 80, 80);
      for (const p of particles) {
        p.x += p.vx * 0.016;
        p.y += p.vy * 0.016;
        if (p.x < 0 || p.x > 80) p.vx *= -1;
        if (p.y < 0 || p.y > 80) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(24,24,27,0.25)';
        ctx.fill();
      }
    };

    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [state]);

  const startCheck = () => {
    if (state !== 'idle') return;
    setState('checking');

    // Collect browser signals
    const signals: string[] = [];
    signals.push('nav:' + navigator.userAgent.slice(0, 20));
    signals.push('lang:' + navigator.language);
    signals.push('plat:' + (navigator as any).platform || 'unknown');
    signals.push('scr:' + screen.width + 'x' + screen.height);
    signals.push('tz:' + Intl.DateTimeFormat().resolvedOptions().timeZone);
    signals.push('mem:' + ((navigator as any).deviceMemory || '?'));
    signals.push('con:' + ((navigator as any).hardwareConcurrency || '?'));

    // Check cookies/localStorage
    const hasCookies = document.cookie.length > 0;
    const hasStorage = localStorage.length > 0;
    signals.push('ck:' + (hasCookies ? '1' : '0'));
    signals.push('ls:' + (hasStorage ? '1' : '0'));

    // Mouse movement entropy collection
    let mouseEntropy = '';
    const onMouseMove = (e: MouseEvent) => {
      mouseEntropy += Math.round(e.movementX) + ',' + Math.round(e.movementY) + ';';
    };
    document.addEventListener('mousemove', onMouseMove);

    // Random delay 1.5-3 seconds (realistic scan time)
    const delay = 1500 + Math.random() * 1500;

    setTimeout(() => {
      document.removeEventListener('mousemove', onMouseMove);
      signals.push('me:' + mouseEntropy.slice(0, 80));

      // Decision: check for bot patterns
      const entropyLength = mouseEntropy.length;

      // Bot indicators: no mouse movement, no cookies, no storage
      const isSuspicious = entropyLength < 10 && !hasCookies && !hasStorage;

      if (isSuspicious) {
        // Still pass but flag it
        const token = 'botok_' + Date.now() + '_flagged_' + Math.random().toString(36).slice(2);
        setState('done');
        onVerify(token);
      } else {
        const token = 'botok_' + Date.now() + '_ok_' + Math.random().toString(36).slice(2);
        setState('done');
        onVerify(token);
      }
    }, delay);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={startCheck}
        disabled={state !== 'idle'}
        className={`relative flex-shrink-0 h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-all ${
          state === 'done' ? 'border-emerald-500 bg-emerald-500 text-white' :
          state === 'checking' ? 'border-zinc-400' :
          'border-zinc-300 bg-white text-zinc-400 hover:border-zinc-900 hover:text-zinc-900'
        }`}
      >
        {state === 'done' ? (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
        ) : state === 'checking' ? (
          <>
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full rounded-lg" />
            <div className="relative z-10 rounded-full border-2 border-white/60 transition-all duration-300"
              style={{ width: `${16 + pulse * 20}px`, height: `${16 + pulse * 20}px` }} />
          </>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        )}
      </button>
      <div>
        <p className="text-sm font-semibold text-zinc-800">
          {state === 'idle' ? 'Проверка на бота' : state === 'checking' ? 'Проверка активности...' : 'Проверка пройдена'}
        </p>
        <p className="text-xs text-zinc-400">
          {state === 'idle' ? 'Это займёт всего несколько секунд' : state === 'checking' ? 'Сканирование запросов и cookie...' : 'Вы не бот'}
        </p>
      </div>
    </div>
  );
}
