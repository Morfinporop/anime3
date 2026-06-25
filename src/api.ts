const BASE = '/api';

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + url, { credentials: 'include', ...options });
  } catch {
    throw new Error('Сервер недоступен');
  }

  const text = await res.text();

  if (!res.ok) {
    let msg = `Ошибка ${res.status}`;
    try {
      const data = JSON.parse(text);
      if (data.error) msg = data.error;
      else if (data.message) msg = data.message;
    } catch {}
    throw new Error(msg);
  }

  try {
    return text ? JSON.parse(text) : ({} as T);
  } catch {
    return {} as T;
  }
}

export const api = {
  health: () => request<{ status: string; db: string }>('/health'),

  register: (username: string, password: string) =>
    request<{ user: any }>('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<{ user: any }>('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }),
  me: () => request<{ user: any }>('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (oldPassword: string, newPassword: string) =>
    request('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword, newPassword }) }),

  getAnimeList: () => request<any[]>('/anime'),
  getAnimeDetail: (id: number) => request<any>(`/anime/${id}`),
  uploadAnime: (data: { title: string; description: string; year: number; genres: string; poster?: { data: string; mime: string }; video?: { data: string; mime: string } }) =>
    request<{ id: number }>('/anime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  deleteAnime: (id: number) => request(`/anime/${id}`, { method: 'DELETE' }),

  getComments: (animeId: number) => request<any[]>(`/anime/${animeId}/comments`),
  addComment: (animeId: number, text: string, parentId?: number) =>
    request<any>(`/anime/${animeId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, parentId }) }),
  deleteComment: (id: number) => request(`/comments/${id}`, { method: 'DELETE' }),
  likeComment: (id: number) => request<{ likes: number; liked: boolean }>(`/comments/${id}/like`, { method: 'POST' }),

  rateAnime: (animeId: number, score: number) =>
    request<{ rating: number; count: number }>(`/anime/${animeId}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) }),

  addView: (animeId: number) => request(`/anime/${animeId}/view`, { method: 'POST' }),

  getUsers: () => request<any[]>('/admin/users'),
  setAdmin: (userId: number, isAdmin: boolean) =>
    request(`/admin/users/${userId}/admin`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin }) }),
  setUpload: (userId: number, canUpload: boolean) =>
    request(`/admin/users/${userId}/upload`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canUpload }) }),
  deleteUser: (userId: number) => request(`/admin/users/${userId}`, { method: 'DELETE' }),
};
