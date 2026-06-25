import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNotify } from './NotifyContext';
import { api } from './api';

export type User = {
  id: number;
  nickname: string;
  color: string;
  isAdmin: boolean;
  canUpload: boolean;
};

type UserContextType = {
  user: User | null;
  users: User[];
  login: (nickname: string, password: string) => Promise<boolean>;
  register: (nickname: string, password: string) => Promise<'ok' | 'exists' | 'error'>;
  logout: () => void;
  changePassword: (oldPass: string, newPass: string) => Promise<boolean>;
  toggleAdmin: (userId: number) => Promise<void>;
  toggleUpload: (userId: number) => Promise<void>;
  deleteUser: (userId: number) => Promise<void>;
  refreshUsers: () => Promise<void>;
  checkAuth: () => Promise<void>;
  serverError: boolean;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const [serverError, setServerError] = useState(false);
  const notify = useNotify();

  const checkAuth = useCallback(async () => {
    try {
      await api.health();
      setServerError(false);

      const data = await api.me();
      if (data.user) {
        setUser({
          id: data.user.id,
          nickname: data.user.username,
          color: data.user.avatarColor,
          isAdmin: data.user.isAdmin,
          canUpload: data.user.canUpload,
        });
      }
    } catch (err: any) {
      if (err.status === 0 || err.message === 'Сервер недоступен') {
        setServerError(true);
      }
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch {}
  }, []);

  // Только регистрация — если пользователь существует, возвращает 'exists'
  const register = useCallback(async (nickname: string, password: string): Promise<'ok' | 'exists' | 'error'> => {
    try {
      const data = await api.register(nickname.trim(), password);
      setUser({
        id: data.user.id,
        nickname: data.user.username,
        color: data.user.avatarColor,
        isAdmin: data.user.isAdmin,
        canUpload: data.user.canUpload,
      });
      notify.success(`Добро пожаловать, ${data.user.username}!${data.user.isAdmin ? ' (Админ)' : ''}`);
      return 'ok';
    } catch (err: any) {
      if (err.status === 409) {
        return 'exists';
      }
      notify.error(err.message || 'Ошибка регистрации');
      return 'error';
    }
  }, [notify]);

  // Только логин
  const login = useCallback(async (nickname: string, password: string): Promise<boolean> => {
    try {
      const data = await api.login(nickname.trim(), password);
      setUser({
        id: data.user.id,
        nickname: data.user.username,
        color: data.user.avatarColor,
        isAdmin: data.user.isAdmin,
        canUpload: data.user.canUpload,
      });
      notify.success(`С возвращением, ${data.user.username}!`);
      return true;
    } catch (err: any) {
      notify.error(err.message || 'Ошибка входа');
      return false;
    }
  }, [notify]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch {}
    setUser(null);
    notify.info('Вы вышли из аккаунта');
  }, [notify]);

  const changePassword = useCallback(async (oldPass: string, newPass: string): Promise<boolean> => {
    try {
      await api.changePassword(oldPass, newPass);
      notify.success('Пароль успешно изменён');
      return true;
    } catch (err: any) {
      notify.error(err.message || 'Ошибка смены пароля');
      return false;
    }
  }, [notify]);

  const toggleAdmin = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await api.setAdmin(userId, !target.isAdmin);
      await refreshUsers();
      notify.success(`${target.nickname}: ${!target.isAdmin ? 'админ' : 'права админа сняты'}`);
    } catch (err: any) {
      notify.error(err.message || 'Ошибка');
    }
  }, [users, refreshUsers, notify]);

  const toggleUpload = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await api.setUpload(userId, !target.canUpload);
      await refreshUsers();
      notify.success(`${target.nickname}: загрузка ${!target.canUpload ? 'включена' : 'отключена'}`);
    } catch (err: any) {
      notify.error(err.message || 'Ошибка');
    }
  }, [users, refreshUsers, notify]);

  const deleteUser = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target || target.isAdmin) { notify.error('Нельзя удалить админа'); return; }
    try {
      await api.deleteUser(userId);
      await refreshUsers();
      notify.success(`Пользователь ${target.nickname} удалён`);
    } catch (err: any) {
      notify.error(err.message || 'Ошибка');
    }
  }, [users, refreshUsers, notify]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  return (
    <UserContext.Provider value={{ user, users, login, register, logout, changePassword, toggleAdmin, toggleUpload, deleteUser, refreshUsers, checkAuth, serverError }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
}
