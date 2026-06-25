import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card, { CardRow, type CardData } from './Card';
import PlayPage from './PlayPage';
import Header from './Header';
import type { AnimeData, CommentData } from './types';
import { api } from './api';

export default function HomePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [sort, setSort] = useState('popular');
  const [genre, setGenre] = useState('all');
  const [view, setView] = useState<'grid' | 'rows'>('grid');
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [genreList, setGenreList] = useState<string[]>(['all']);

  const loadAnime = useCallback(async () => {
    try { const data = await api.getAnimeList(); setAnimeList(data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAnime(); }, [loadAnime]);

  useEffect(() => {
    const handler = () => loadAnime();
    window.addEventListener('animeworld-cards-updated', handler);
    return () => window.removeEventListener('animeworld-cards-updated', handler);
  }, [loadAnime]);

  useEffect(() => {
    const usedGenres = new Set<string>();
    animeList.forEach((a: any) => { if (Array.isArray(a.genres)) a.genres.forEach((g: string) => usedGenres.add(g)); });
    setGenreList(['all', ...Array.from(usedGenres).sort()]);
  }, [animeList]);

  // Если URL /video/:id — открываем плеер
  useEffect(() => {
    if (id && animeList.length > 0) {
      const found = animeList.find(a => String(a.id) === id);
      if (found) {
        const animeData: AnimeData = {
          id: found.id, title: found.title, description: found.description || '',
          fullDescription: found.description || '', image: found.image || '',
          views: found.views || 0, rating: found.rating || 0,
          genres: found.genres || [], year: found.year || 2024,
          videoSrc: found.videoSrc || '', comments: [],
        };
        setSelectedAnime(animeData);
      }
    }
  }, [id, animeList]);

  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);

  const handleCardClick = useCallback((card: CardData | any) => {
    const animeData: AnimeData = {
      id: card.id, title: card.title, description: card.description || '',
      fullDescription: card.description || '', image: card.image || '',
      views: card.views || 0, rating: card.rating || 0,
      genres: card.genres || [], year: card.year || 2024,
      videoSrc: card.videoSrc || '', comments: [],
    };
    setSelectedAnime(animeData);
    navigate(`/video/${card.id}`, { replace: true });
    window.scrollTo(0, 0);
  }, [navigate]);

  const handleBack = useCallback(() => {
    setSelectedAnime(null);
    navigate('/', { replace: true });
    loadAnime();
  }, [navigate, loadAnime]);

  const handleUpdateRating = useCallback(async (animeId: number, rating: number) => {
    try { await api.rateAnime(animeId, rating); } catch {}
  }, []);

  const handleAddView = useCallback(async (animeId: number) => {
    try { await api.addView(animeId); } catch {}
  }, []);

  const handleUpdateComments = useCallback((_animeId: number, _comments: CommentData[]) => {}, []);

  let filteredList = [...animeList];
  if (genre !== 'all') filteredList = filteredList.filter(a => a.genres?.includes(genre));
  if (sort === 'newest') filteredList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  else if (sort === 'rating') filteredList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  else if (sort === 'title') filteredList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  const cards: CardData[] = filteredList.map((a: any) => ({
    id: a.id, title: a.title, description: a.description || '',
    image: a.image || '', views: a.views || 0, rating: a.rating || 0, genres: a.genres || [],
  }));

  if (selectedAnime) {
    return <PlayPage data={selectedAnime} onBack={handleBack}
      onUpdateRating={(r) => handleUpdateRating(selectedAnime.id, r)}
      onAddView={() => handleAddView(selectedAnime.id)}
      onUpdateComments={(c) => handleUpdateComments(selectedAnime.id, c)} />;
  }

  return (
    <div>
      <Header onSelectAnime={handleCardClick} />
      <section className="relative overflow-hidden border-b border-zinc-200">
        <img src="https://avatanplus.com/files/resources/original/5cc1631bacf9316a536b243d.png" alt=""
          className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-10 sm:px-8 sm:py-16">
          <h1 className="text-6xl font-bold text-white drop-shadow-lg sm:text-7xl lg:text-8xl">Аниме</h1>
          <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base leading-relaxed">
            Добро пожаловать в мир, где можно смотреть аниме любого жанра, типа и года. Мы создали этот большой, удобный, детально проработанный сборник, чтобы каждый зритель легко находил новые релизы, популярные многосерийные тайтлы и редкие ретро-картины для идеального вечернего просмотра.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8 sm:pb-16">
        <div className="sticky top-12 z-20 mb-5 border-b border-zinc-200 bg-white/90 py-3 backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <select value={genre} onChange={(e) => setGenre(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700">
              {genreList.map((g: string) => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700">
              <option value="popular">По популярности</option>
              <option value="newest">Сначала новые</option>
              <option value="rating">По рейтингу</option>
              <option value="title">По алфавиту</option>
            </select>
            <div className="flex-1" />
            <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1">
              <button onClick={() => setView('grid')} className={`rounded-full p-1.5 ${view === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button onClick={() => setView('rows')} className={`rounded-full p-1.5 ${view === 'rows' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {loading ? <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
          : cards.length === 0 ? <div className="text-center py-20"><p className="text-zinc-400 text-lg">Пока ничего нет</p></div>
            : view === 'grid' ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {cards.map((v) => <div key={v.id} onClick={() => handleCardClick(v)} className="cursor-pointer"><Card data={v} /></div>)}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {cards.map((v) => <div key={v.id} onClick={() => handleCardClick(v)} className="cursor-pointer"><CardRow data={v} /></div>)}
              </div>
            )}
      </section>
    </div>
  );
}
