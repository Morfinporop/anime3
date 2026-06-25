import { useState } from 'react';
import { Upload as UploadIcon, X, CheckCircle2, Film, AlertTriangle, ImageIcon } from 'lucide-react';
import { useUser } from './UserContext';
import { useNotify } from './NotifyContext';
import { api, uploadWithProgress } from './api';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB для base64
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function UploadPage({ onClose, onWatch }: { onClose: () => void; onWatch?: (cardId: number) => void }) {
  const { user } = useUser();
  const notify = useNotify();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [genres, setGenres] = useState('');
  
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [doneId, setDoneId] = useState<number | null>(null);

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
    if (f.size > MAX_IMAGE_SIZE) {
      setError('Постер слишком большой. Максимум 5 МБ.');
      return;
    }
    setPosterFile(f);
    const reader = new FileReader();
    reader.onload = () => setPosterPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_VIDEO_SIZE) {
      setError('Видео слишком большое. Максимум 100 МБ.');
      return;
    }
    setError('');
    setVideoFile(f);
  };

  const handleUpload = async () => {
    setError('');
    if (!title.trim()) { setError('Введите название'); return; }
    if (!videoFile) { setError('Выберите видеофайл'); return; }

    setUploading(true);
    setProgress(0);

    try {
      // Upload poster
      let posterData: { data: string; mime: string } | undefined;
      if (posterFile) {
        setProgressText('Загрузка постера...');
        posterData = await uploadWithProgress(posterFile, (p) => setProgress(Math.round(p * 0.2)));
      }

      // Upload video
      setProgressText('Загрузка видео...');
      const videoData = await uploadWithProgress(videoFile, (p) => setProgress(20 + Math.round(p * 0.7)));

      // Send to server
      setProgressText('Сохранение...');
      setProgress(90);
      
      const result = await api.uploadAnime({
        title: title.trim(),
        description,
        year,
        genres,
        poster: posterData,
        video: videoData,
      });

      setProgress(100);
      setUploading(false);
      setDone(true);
      setDoneId(result.id);
      notify.success('Аниме успешно загружено!');
      window.dispatchEvent(new Event('animeworld-cards-updated'));
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'Ошибка загрузки');
    }
  };

  if (done) {
    return (
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-zinc-900">Загрузить аниме</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900">Готово!</h3>
          <p className="mt-2 text-sm text-zinc-500">{title} добавлен на главную</p>
          <button 
            onClick={() => { if (onWatch && doneId) onWatch(doneId); else onClose(); }} 
            className="mt-5 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-900">Загрузить аниме</h2>
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{error}
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Название *</label>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder="Название аниме" 
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" 
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Год</label>
            <input 
              type="number" 
              value={year} 
              onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())} 
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" 
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Жанры</label>
            <input 
              type="text" 
              value={genres} 
              onChange={(e) => setGenres(e.target.value)} 
              placeholder="Фэнтези, Драма" 
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" 
            />
          </div>
        </div>
        
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Описание</label>
          <textarea 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            rows={2} 
            placeholder="О чём аниме..." 
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400 resize-none" 
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Постер (макс 5 МБ)</label>
            <label className="mt-1 group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-900 hover:bg-white">
              {posterPreview ? (
                <img src={posterPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-[10px] font-medium text-center px-1">Постер</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handlePosterFile} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Видео * (макс 100 МБ)</label>
            <label className="mt-1 group relative flex h-32 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-500 transition-colors hover:border-zinc-900 hover:bg-white">
              {videoFile ? (
                <div className="flex flex-col items-center gap-1 px-2 text-center">
                  <Film className="h-5 w-5 text-zinc-900" />
                  <div className="line-clamp-1 text-[10px] font-semibold text-zinc-900 max-w-[120px] truncate">{videoFile.name}</div>
                  <div className="text-[9px] text-zinc-500">{(videoFile.size / 1024 / 1024).toFixed(1)} МБ</div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <UploadIcon className="h-5 w-5" />
                  <span className="text-[10px] font-medium text-center px-1">Видеофайл</span>
                </div>
              )}
              <input type="file" accept="video/*" onChange={handleVideoFile} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>
        </div>

        {uploading && (
          <div className="space-y-2">
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-zinc-900 transition-all duration-300" 
                style={{ width: `${progress}%` }} 
              />
            </div>
            <p className="text-xs text-zinc-500 text-center">{progressText} {progress}%</p>
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={uploading || !videoFile || !title.trim()} 
          className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40"
        >
          {uploading ? 'Загрузка...' : (
            <span><UploadIcon className="inline h-4 w-4 mr-1.5" /> Загрузить</span>
          )}
        </button>
      </div>
    </div>
  );
}
