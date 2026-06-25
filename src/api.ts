const BASE = '/api';

class ApiError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + url, { 
      credentials: 'include',
      ...options,
    });
  } catch {
    throw new ApiError('Сервер недоступен', 0);
  }

  let data: any;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('Ошибка сервера: неверный ответ', res.status);
  }

  if (!res.ok) {
    throw new ApiError(data.error || data.message || `Ошибка ${res.status}`, res.status);
  }

  return data;
}

export const api = {
  // Health check
  async health() {
    return request<{ status: string; db: string }>('/health');
  },

  // Auth
  async register(username: string, password: string) {
    return request<{ user: any }>('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  async login(username: string, password: string) {
    return request<{ user: any }>('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  async me() {
    return request<{ user: any }>('/auth/me');
  },

  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  async changePassword(oldPassword: string, newPassword: string) {
    return request('/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPassword, newPassword }),
    });
  },

  // Anime
  async getAnimeList() {
    return request<any[]>('/anime');
  },

  async getAnimeDetail(id: number) {
    return request<any>(`/anime/${id}`);
  },

  async uploadAnime(data: {
    title: string;
    description: string;
    year: number;
    genres: string;
    poster?: { data: string; mime: string };
    video?: { data: string; mime: string };
  }) {
    return request<{ id: number }>('/anime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteAnime(id: number) {
    return request(`/anime/${id}`, { method: 'DELETE' });
  },

  // Comments
  async getComments(animeId: number) {
    return request<any[]>(`/anime/${animeId}/comments`);
  },

  async addComment(animeId: number, text: string, parentId?: number) {
    return request<any>(`/anime/${animeId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parentId }),
    });
  },

  async deleteComment(id: number) {
    return request(`/comments/${id}`, { method: 'DELETE' });
  },

  async likeComment(id: number) {
    return request<{ likes: number; liked: boolean }>(`/comments/${id}/like`, { method: 'POST' });
  },

  // Ratings
  async rateAnime(animeId: number, score: number) {
    return request<{ rating: number; count: number }>(`/anime/${animeId}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score }),
    });
  },

  // Views
  async addView(animeId: number) {
    return request(`/anime/${animeId}/view`, { method: 'POST' });
  },

  // Admin
  async getUsers() {
    return request<any[]>('/admin/users');
  },

  async setAdmin(userId: number, isAdmin: boolean) {
    return request(`/admin/users/${userId}/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isAdmin }),
    });
  },

  async setUpload(userId: number, canUpload: boolean) {
    return request(`/admin/users/${userId}/upload`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canUpload }),
    });
  },

  async deleteUser(userId: number) {
    return request(`/admin/users/${userId}`, { method: 'DELETE' });
  },
};

// File upload with progress
export function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void
): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({ data: base64, mime: file.type });
    };
    
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}
