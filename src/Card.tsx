import { memo, useRef, useState, useEffect } from 'react';

export type CardData = {
  id: number;
  title: string;
  description: string;
  image: string;
  views: number;
  rating: number;
  genres: string[];
};

const formatViews = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M просмотров';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K просмотров';
  return n + ' просмотров';
};

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-zinc-300 bg-zinc-600/80 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
    {children}
  </span>
);

function Card({ data }: { data: CardData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-md"
      style={{
        transform: 'perspective(900px) rotateX(6deg)',
        transformStyle: 'preserve-3d',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 420px',
        contain: 'paint',
      }}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-t-2xl bg-zinc-100">
        {visible && (
          <img
            src={data.image + (data.image.includes('?') ? '&' : '?') + 'w=320&q=70&fm=webp'}
            alt={data.title}
            className="h-full w-full object-cover"
            style={{ transform: 'translateZ(0)', willChange: 'transform' }}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        )}
        <div className="absolute right-2 top-2">
          <span className="rounded-full border border-zinc-400/50 bg-zinc-500/40 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm backdrop-blur-md">
            ★ {data.rating > 0 ? `${data.rating}/10` : '—'}
          </span>
        </div>
        <div className="absolute bottom-2 left-2 max-w-[70%] truncate rounded-full border border-zinc-400/50 bg-zinc-500/40 px-2.5 py-1 text-[10px] font-medium text-white shadow-sm backdrop-blur-md">
          {formatViews(data.views)}
        </div>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900">{data.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{data.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {data.genres.map((g) => <Badge key={g}>{g}</Badge>)}
          <Badge>2026</Badge>
        </div>
      </div>
    </div>
  );
}

export function CardRow({ data }: { data: CardData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex w-full items-center gap-3 overflow-hidden rounded-xl border border-zinc-200 bg-white p-2 shadow-sm"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 96px', contain: 'paint' }}
    >
      <div className="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-100">
        {visible && (
          <img
            src={data.image + (data.image.includes('?') ? '&' : '?') + 'w=112&q=70&fm=webp'}
            alt={data.title}
            className="h-full w-full object-cover"
            style={{ transform: 'translateZ(0)' }}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        )}
        <span className="absolute right-0.5 top-0.5 rounded-full border border-zinc-400/50 bg-zinc-500/40 px-1.5 py-0.5 text-[8px] font-bold text-white shadow-sm backdrop-blur-md">
          ★ {data.rating > 0 ? `${data.rating}/10` : '—'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-zinc-900">{data.title}</h3>
        <p className="truncate text-[11px] text-zinc-500">{data.description}</p>
        <div className="mt-1 flex items-center gap-1">
          {data.genres.map((g) => <Badge key={g}>{g}</Badge>)}
          <Badge>2026</Badge>
          <span className="ml-auto text-[10px] text-zinc-500">{formatViews(data.views)}</span>
        </div>
      </div>
    </div>
  );
}

export default memo(Card);
