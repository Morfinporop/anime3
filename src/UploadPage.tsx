import { useState } from 'react';
import { Upload as UploadIcon, X, AlertTriangle, Film, ImageIcon } from 'lucide-react';
import { useUser } from './UserContext';
import { useNotify } from './NotifyContext';

const MAX_VIDEO_SIZE = 550 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

interface ProgressData {
  stage: string;
  percent: number;
  text: string;
}

export default function UploadPage({ onClose }: { onClose: () => void; onWatch?: (cardId: number) => void }) {
  const { user } = useUser();
  const notify = useNotify();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [genres, setGenres] = useState('');
  const [studio, setStudio] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center p-8">
          <p className="text-lg font-bold text-zinc-800">Войдите в аккаунт</p>
          <p className="text-sm text-zinc-500 mt-1">Чтобы загружать видео</p>
          <button onClick={onClose} className="mt-4 text-sm text-zinc-600 hover:text-zinc-900 hover:underline">Закрыть</button>
        </div>
      </div>
    );
  }

  const handlePosterFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_IMAGE_SIZE) { setError('Постер слишком большой. Максимум 5 МБ.'); return; }
    setPosterFile(f);
    const reader = new FileReader();
    reader.onload = () => setPosterPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_VIDEO_SIZE) { setError('Видео слишком большое. Максимум 550 МБ.'); return; }
    setError('');
    setVideoFile(f);
  };

  const readFileAsBase64 = (file: File): Promise<{ data: string; mime: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ data: base64, mime: file.type });
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    setError('');
    if (!title.trim()) { setError('Введите название'); return; }
    if (!videoFile) { setError('Выберите видеофайл'); return; }

    setUploading(true);
    setProgress({ stage: 'read', percent: 0, text: 'Чтение файлов...' });

    try {
      const poster = posterFile ? await readFileAsBase64(posterFile) : undefined;
      setProgress({ stage: 'read', percent: 5, text: 'Чтение видеофайла...' });
      const video = await readFileAsBase64(videoFile);
      setProgress({ stage: 'read', percent: 8, text: 'Видео прочитано, отправка на сервер...' });

      // SSE request
      const resp = await fetch('/api/anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: title.trim(), description, year, genres, studio, poster, video }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        let errMsg = `Ошибка ${resp.status}`;
        try { const d = JSON.parse(errText); errMsg = d.error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      // Read SSE stream
      const reader = resp.body?.getReader();
      if (!reader) throw new Error('Нет потока ответа');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === 'progress') {
                setProgress(data);
              } else if (eventType === 'complete') {
                setUploading(false);
                notify.success('Аниме успешно загружено!');
                window.dispatchEvent(new Event('animeworld-cards-updated'));
                onClose();
                return;
              } else if (eventType === 'error') {
                throw new Error(data.error || 'Ошибка сервера');
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'Ошибка загрузки');
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-900">Загрузить аниме</h2>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {uploading ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <div className="mx-auto mb-4 w-full max-w-xs">
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-900 transition-all duration-500 rounded-full" style={{ width: `${progress?.percent || 0}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold text-zinc-800">{progress?.text || 'Загрузка...'}</p>
              <p className="text-xs text-zinc-400">{progress?.percent || 0}%</p>
            <p className="text-xs text-zinc-400 mt-1">Это может занять некоторое время</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Название *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название аниме"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Год</label>
              <input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" /></div>
            <div><label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Жанры</label>
              <input type="text" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Фэнтези, Драма"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" /></div>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Студия</label>
            <input type="text" value={studio} onChange={(e) => setStudio(e.target.value)} placeholder="Студия-создатель"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" />
          </div>
          <div><label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Описание</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="О чём аниме..."
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 resize-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Постер (макс 5 МБ)</label>
              <label className="mt-1 group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-900 hover:bg-white">
                {posterPreview ? <img src={posterPreview} alt="" className="h-full w-full object-cover" /> :
                  <div className="flex flex-col items-center gap-1"><ImageIcon className="h-5 w-5" /><span className="text-[10px] font-medium">Постер</span></div>}
                <input type="file" accept="image/*" onChange={handlePosterFile} className="absolute inset-0 cursor-pointer opacity-0" /></label></div>
            <div><label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Видео * (макс 550 МБ)</label>
              <label className="mt-1 group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-900 hover:bg-white">
                {videoFile ? <div className="flex flex-col items-center gap-1 px-2 text-center"><Film className="h-5 w-5 text-zinc-900" /><div className="text-[10px] font-semibold text-zinc-900 truncate max-w-[120px]">{videoFile.name}</div><div className="text-[9px] text-zinc-500">{(videoFile.size / 1024 / 1024).toFixed(1)} МБ</div></div> :
                  <div className="flex flex-col items-center gap-1"><UploadIcon className="h-5 w-5" /><span className="text-[10px] font-medium">Видеофайл</span></div>}
                <input type="file" accept="video/*" onChange={handleVideoFile} className="absolute inset-0 cursor-pointer opacity-0" /></label></div>
          </div>
          <button onClick={handleUpload} disabled={uploading || !videoFile || !title.trim()}
            className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">
            <UploadIcon className="inline h-4 w-4 mr-1.5" /> Загрузить
          </button>
        </div>
      )}
    </div>
  );
}
