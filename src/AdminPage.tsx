import { useState, useEffect } from 'react';
import { X, Shield, Trash2 } from 'lucide-react';
import { useUser } from './UserContext';
import { api } from './api';

export default function AdminPage({ onClose }: { onClose: () => void }) {
  const { user, users, refreshUsers, toggleAdmin, toggleUpload, deleteUser } = useUser();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'users' | 'anime'>('users');
  const [animeList, setAnimeList] = useState<any[]>([]);

  useEffect(() => {
    if (user?.isAdmin) refreshUsers();
  }, [user, refreshUsers]);

  useEffect(() => {
    if (tab === 'anime') api.getAnimeList().then(setAnimeList).catch(() => {});
  }, [tab]);

  if (!user?.isAdmin) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-zinc-900">Админ-панель</h2><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button></div>
        <div className="text-center py-12"><Shield className="mx-auto h-10 w-10 text-zinc-300" /><p className="mt-2 text-sm text-zinc-500">Нет доступа</p></div>
      </div>
    );
  }

  const filtered = users.filter(u => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return u.nickname.toLowerCase().includes(q) || String(u.id).includes(q);
  });

  const handleDeleteAnime = async (id: number) => {
    if (!confirm('Удалить это аниме полностью?')) return;
    await api.deleteAnime(id);
    setAnimeList(animeList.filter(a => a.id !== id));
    window.dispatchEvent(new Event('animeworld-cards-updated'));
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-zinc-900">Админ-панель</h2><button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button></div>

      <div className="flex gap-1 mb-3 bg-zinc-100 rounded-lg p-1">
        <button onClick={() => setTab('users')} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${tab === 'users' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>Пользователи</button>
        <button onClick={() => setTab('anime')} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${tab === 'anime' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'}`}>Аниме</button>
      </div>

      {tab === 'users' && (
        <>
          <p className="text-xs text-zinc-500 mb-2">Всего: {users.length}</p>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по нику или ID..." className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 mb-3" />
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50"><tr className="text-left text-xs font-bold uppercase tracking-wider text-zinc-500"><th className="px-3 py-2.5">Пользователь</th><th className="hidden px-3 py-2.5 sm:table-cell">ID</th><th className="px-3 py-2.5">Права</th><th className="px-3 py-2.5 text-right">Действия</th></tr></thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: u.color }}>{u.nickname.charAt(0).toUpperCase()}</div><div><div className="font-semibold text-zinc-900 text-xs">{u.nickname}</div><div className="text-[10px] text-zinc-500 sm:hidden">ID: {u.id}</div></div></div></td>
                    <td className="hidden px-3 py-2.5 font-mono text-[11px] text-zinc-500 sm:table-cell">{u.id}</td>
                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{u.isAdmin && <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-pink-700">Админ</span>}{u.canUpload && !u.isAdmin && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Загрузка</span>}{!u.isAdmin && !u.canUpload && <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-zinc-500">—</span>}</div></td>
                    <td className="px-3 py-2.5"><div className="flex justify-end gap-1">
                      <button onClick={() => toggleAdmin(u.id)} disabled={u.id === user.id} className={`flex h-7 items-center rounded-full px-2.5 text-[10px] font-medium ${u.isAdmin ? 'bg-pink-100 text-pink-700 hover:bg-pink-200' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'} disabled:opacity-30`}>Админ</button>
                      <button onClick={() => toggleUpload(u.id)} disabled={u.isAdmin} className={`flex h-7 items-center rounded-full px-2.5 text-[10px] font-medium ${u.canUpload && !u.isAdmin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'} disabled:opacity-30`}>Загрузка</button>
                      <button onClick={() => { if (confirm(`Удалить ${u.nickname}?`)) deleteUser(u.id); }} disabled={u.isAdmin} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'anime' && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Всего аниме: {animeList.length}</p>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50"><tr className="text-left text-xs font-bold uppercase tracking-wider text-zinc-500"><th className="px-3 py-2.5">Название</th><th className="hidden px-3 py-2.5 sm:table-cell">ID</th><th className="px-3 py-2.5 text-right">Действия</th></tr></thead>
              <tbody>
                {animeList.map((a: any) => (
                  <tr key={a.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                    <td className="px-3 py-2.5"><div className="font-semibold text-zinc-900 text-xs truncate max-w-[200px]">{a.title}</div><div className="text-[10px] text-zinc-500">{a.genres?.join(', ') || '—'}</div></td>
                    <td className="hidden px-3 py-2.5 font-mono text-[11px] text-zinc-500 sm:table-cell">{a.id}</td>
                    <td className="px-3 py-2.5 text-right"><button onClick={() => handleDeleteAnime(a.id)} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50 ml-auto"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
