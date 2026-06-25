import { useState, useEffect } from 'react';

interface Props {
  onVerify: (token: string) => void;
}

export default function BotCheck({ onVerify }: Props) {
  const [state, setState] = useState<'idle' | 'checking' | 'done'>('idle');
  const [pulse, setPulse] = useState(0);
  const [pulse2, setPulse2] = useState(0);

  useEffect(() => {
    if (state !== 'checking') return;
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

  const startCheck = () => {
    if (state !== 'idle') return;
    setState('checking');

    let mouseEntropy = '';
    const onMouseMove = (e: MouseEvent) => {
      mouseEntropy += Math.round(e.movementX) + ',' + Math.round(e.movementY) + ';';
    };
    document.addEventListener('mousemove', onMouseMove);

    const delay = 1500 + Math.random() * 1500;

    setTimeout(() => {
      document.removeEventListener('mousemove', onMouseMove);
      const hasCookies = document.cookie.length > 0;
      const hasStorage = localStorage.length > 0;
      const isSuspicious = mouseEntropy.length < 10 && !hasCookies && !hasStorage;
      const token = 'botok_' + Date.now() + (isSuspicious ? '_flagged_' : '_ok_') + Math.random().toString(36).slice(2);
      setState('done');
      onVerify(token);
    }, delay);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={startCheck}
        disabled={state !== 'idle'}
        className={`relative flex-shrink-0 h-9 w-9 rounded-lg border-2 flex items-center justify-center transition-colors ${
          state === 'done' ? 'border-zinc-900 bg-white' :
          state === 'checking' ? 'border-zinc-300 bg-white' :
          'border-zinc-300 bg-white/60 hover:border-zinc-900'
        }`}
      >
        {state === 'done' ? (
          <svg className="h-4 w-4 text-zinc-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : state === 'checking' ? (
          <>
            <div className="absolute rounded-full bg-zinc-200/60 transition-all duration-200"
              style={{ width: `${20 + pulse * 35}px`, height: `${20 + pulse * 35}px` }} />
            <div className="absolute rounded-full bg-zinc-200/40 transition-all duration-200"
              style={{ width: `${14 + pulse2 * 30}px`, height: `${14 + pulse2 * 30}px` }} />
          </>
        ) : null}
      </button>
      <div>
        <p className="text-sm font-semibold text-zinc-800">Проверка на бота</p>
        <p className="text-xs text-zinc-400">Это займёт всего несколько секунд</p>
      </div>
    </div>
  );
}
