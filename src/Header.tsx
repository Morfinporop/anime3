import { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, X, LogOut, Search as SearchIcon } from 'lucide-react';
import { useUser } from './UserContext';
import { useNotify } from './NotifyContext';
import { api } from './api';
import UploadPage from './UploadPage';
import AdminPage from './AdminPage';

// Простая модалка без блюра — оптимизированная
function ModalShell({ onClose, title, subtitle, children }: {
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl m-4"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'modal-in 0.12s ease-out' }}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function LoginModal({ onClose, onSwitchToRegister }: { onClose: () => void; onSwitchToRegister: () => void }) {
  const { login } = useUser();
  const notify = useNotify();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!nickname.trim() || !password.trim()) { notify.error('Заполните никнейм и пароль'); return; }
    setLoading(true);
    const ok = await login(nickname.trim(), password);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Войти" subtitle="Войдите в существующий аккаунт">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-600">Никнейм</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Введите никнейм"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Пароль</label>
          <div className="relative mt-1">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <button onClick={handleLogin} disabled={!nickname.trim() || !password.trim() || loading}
        className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">
        {loading ? 'Вход...' : 'Войти'}
      </button>
      <p className="mt-3 text-center text-xs text-zinc-400">
        Нет аккаунта?{' '}
        <button onClick={onSwitchToRegister} className="text-zinc-900 font-semibold hover:underline">Зарегистрироваться</button>
      </p>
    </ModalShell>
  );
}

function RegisterModal({ onClose, onSwitchToLogin }: { onClose: () => void; onSwitchToLogin: () => void }) {
  const { register, login } = useUser();
  const notify = useNotify();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Reset Turnstile when modal opens
  useEffect(() => {
    const tid = setTimeout(() => {
      const el = document.querySelector('.cf-turnstile-reg');
      if (el && (window as any).turnstile) {
        (window as any).turnstile.remove(el);
        (window as any).turnstile.render(el, {
          sitekey: '0x4AAAAAADq22Lhd_1fjLeeF',
          callback: (token: string) => { (window as any).registerToken = token; },
          'expired-callback': () => { (window as any).registerToken = ''; },
        });
      }
    }, 200);
    return () => clearTimeout(tid);
  }, []);

  const handleRegister = async () => {
    const token = (window as any).registerToken || '';
    if (!token) { notify.error('Пройдите проверку Cloudflare'); return; }
    if (!nickname.trim() || !password.trim()) { notify.error('Заполните никнейм и пароль'); return; }
    if (password.trim().length < 3) { notify.error('Пароль должен быть минимум 3 символа'); return; }
    setLoading(true);
    const result = await register(nickname.trim(), password);
    setLoading(false);

    if (result === 'ok') {
      onClose();
    } else if (result === 'exists') {
      // Аккаунт существует — пробуем войти с этим паролем
      notify.info('Аккаунт уже зарегистрирован, пробуем войти...');
      setLoading(true);
      const ok = await login(nickname.trim(), password);
      setLoading(false);
      if (ok) onClose();
    }
  };

  return (
    <ModalShell onClose={onClose} title="Регистрация" subtitle="Придумайте никнейм и пароль">
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-zinc-600">Никнейм</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Введите никнейм"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Пароль</label>
          <div className="relative mt-1">
            <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" />
            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="cf-turnstile-reg mt-3 flex justify-center"></div>
      <button onClick={handleRegister} disabled={!nickname.trim() || !password.trim() || loading}
        className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">
        {loading ? 'Создание...' : 'Создать аккаунт'}
      </button>
      <p className="mt-3 text-center text-xs text-zinc-400">
        Уже есть аккаунт?{' '}
        <button onClick={onSwitchToLogin} className="text-zinc-900 font-semibold hover:underline">Войти</button>
      </p>
    </ModalShell>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, changePassword, updateProfile } = useUser();
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarData || '');
  const [loading, setLoading] = useState(false);

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1024 * 1024) return;
    setAvatarFile(f);
    const r = new FileReader();
    r.onload = () => setAvatarPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const handleSave = async () => {
    setLoading(true);
    let avatarData: string | undefined;
    if (avatarFile) {
      avatarData = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.readAsDataURL(avatarFile);
      });
    }
    const newNick = nickname.trim() !== user?.nickname ? nickname.trim() : undefined;
    await updateProfile({ username: newNick, avatarData: avatarData || undefined });
    setLoading(false);
    onClose();
  };

  const handleChange = async () => {
    if (!oldPass.trim() || !newPass.trim()) return;
    setLoading(true);
    const ok = await changePassword(oldPass, newPass);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <ModalShell onClose={onClose} title="Настройки">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="relative cursor-pointer flex-shrink-0">
            <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-zinc-200 flex items-center justify-center bg-zinc-100"
              style={avatarPreview ? {} : { backgroundColor: user?.color }}>
              {avatarPreview ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" /> :
                <span className="text-lg font-bold text-white">{user?.nickname.charAt(0).toUpperCase()}</span>}
            </div>
            <input type="file" accept="image/*" onChange={handleAvatar} className="absolute inset-0 opacity-0" />
          </label>
          <div className="flex-1">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase">Никнейм</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400" />
          </div>
        </div>
        <hr className="border-zinc-100" />
        <div>
          <label className="text-xs font-medium text-zinc-600">Старый пароль</label>
          <div className="relative mt-1">
            <input type={showOld ? 'text' : 'password'} value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Введите старый пароль"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" />
            <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-600">Новый пароль</label>
          <div className="relative mt-1">
            <input type={showNew ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Введите новый пароль"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={handleChange} disabled={!oldPass.trim() || !newPass.trim() || loading}
          className="flex-1 rounded-full border border-zinc-200 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">Сменить пароль</button>
        <button onClick={handleSave} disabled={loading}
          className="flex-1 rounded-full bg-zinc-900 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">Сохранить</button>
      </div>
    </ModalShell>
  );
}

function SearchResultItem({ item, onClick }: { item: any; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2 hover:bg-zinc-50 transition-colors text-left">
      <div className="h-12 w-9 flex-shrink-0 overflow-hidden rounded bg-zinc-100">
        {item.image && <img src={item.image} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 truncate">{item.title}</p>
        <p className="text-xs text-zinc-500 truncate">{item.genres?.join(', ') || item.year}</p>
      </div>
    </button>
  );
}

export default function Header({ onSelectAnime }: { onSelectAnime?: (anime: any) => void }) {
  const { user, logout } = useUser();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setShowSearchResults(false); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const all = await api.getAnimeList();
        const q = searchQuery.toLowerCase();
        const filtered = all.filter((a: any) =>
          a.title.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
        ).slice(0, 5);
        setSearchResults(filtered);
        setShowSearchResults(true);
      } catch { }
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = useCallback((item: any) => {
    setShowSearchResults(false);
    setSearchQuery('');
    if (onSelectAnime) onSelectAnime(item);
  }, [onSelectAnime]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2 sm:px-6 gap-3">
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/images/logov.svg" alt="AnimeWorld" className="h-8 w-8" />
            <span className="text-lg font-bold text-zinc-900 tracking-tight hidden sm:inline">AnimeWorld</span>
          </a>

          <div ref={searchRef} className="relative flex-1 max-w-md mx-auto">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchResults(true)}
                placeholder="Поиск..."
                className="w-full rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-zinc-400 focus:bg-white transition-colors"
              />
              {searchLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-3 w-3 animate-spin rounded-full border border-zinc-300 border-t-zinc-600" />
                </div>
              )}
            </div>

            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-zinc-200 shadow-xl overflow-hidden z-50">
                {searchResults.map((item) => (
                  <SearchResultItem key={item.id} item={item} onClick={() => handleSelectResult(item)} />
                ))}
              </div>
            )}
            {showSearchResults && searchQuery.trim() && searchResults.length === 0 && !searchLoading && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-zinc-200 shadow-xl p-4 text-center z-50">
                <p className="text-sm text-zinc-500">Ничего не найдено</p>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-transparent pl-1.5 pr-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white overflow-hidden" style={user.avatarData ? {} : { backgroundColor: user.color }}>
                    {user.avatarData ? <img src={user.avatarData} alt="" className="h-full w-full object-cover" /> : user.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{user.nickname}</span>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl animate-scale-in">
                      <div className="px-3 py-2 border-b border-zinc-100">
                        <p className="text-xs font-semibold text-zinc-800">
                          {user.nickname} <span className="text-zinc-400 font-normal">ID#{user.id}</span>
                        </p>
                      </div>
                      <button onClick={() => { setMenuOpen(false); setShowSettings(true); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">
                        Настройки
                      </button>
                      {(isAdmin || user.canUpload) && (
                        <button onClick={() => { setMenuOpen(false); setShowUpload(true); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">
                          Загрузить
                        </button>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setMenuOpen(false); setShowAdmin(true); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">
                          Админ меню
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => { logout(); setMenuOpen(false); }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50" title="Выйти">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowLogin(true)}
                className="rounded-full border border-zinc-200 bg-transparent px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900">
                Войти
              </button>
              <button onClick={() => setShowRegister(true)}
                className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">
                Регистрация
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Модалки */}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowUpload(false)}>
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto pt-12 pb-12" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl mx-4 my-auto">
              <UploadPage onClose={() => setShowUpload(false)} />
            </div>
          </div>
        </div>
      )}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowAdmin(false)}>
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto pt-12 pb-12" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl mx-4 my-auto">
              <AdminPage onClose={() => setShowAdmin(false)} />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(2px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes scale-in {
          from { opacity: 0; transform: scale(0.95) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-scale-in { animation: scale-in 0.12s ease-out; }
      `}</style>
    </>
  );
}
