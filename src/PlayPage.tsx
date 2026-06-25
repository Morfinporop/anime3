import { useState, useCallback, useEffect } from 'react';
import { ThumbsUp, ChevronDown, ChevronUp, Send, Star, Trash2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import Header from './Header';
import type { AnimeData, CommentData } from './types';
import { useUser, type User } from './UserContext';
import { useNotify } from './NotifyContext';
import { api } from './api';

const formatViews = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M просмотров';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K просмотров';
  return n + ' просмотров';
};

function UserRating({ rating, onRate, disabled }: { rating: number | null; onRate: (r: number) => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const filled = hovered ? n <= hovered : rating ? n <= rating : false;
        return (
          <button 
            key={n} 
            onClick={() => { if (!disabled) onRate(n); }} 
            onMouseEnter={() => { if (!disabled) setHovered(n); }} 
            className={`transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''}`} 
            title={disabled ? 'Войдите чтобы оценить' : `${n}/10`}
          >
            <Star className={`h-4 w-4 sm:h-5 sm:w-5 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 hover:text-yellow-300'}`} />
          </button>
        );
      })}
      <span className="ml-1 text-xs font-semibold text-zinc-500">
        {hovered ? `${hovered}/10` : rating ? `${rating}/10` : ''}
      </span>
    </div>
  );
}

function CommentItem({ 
  comment, 
  onLike, 
  onReply, 
  onDelete, 
  user 
}: {
  comment: CommentData;
  onLike: (id: number) => void;
  onReply: (id: number, text: string) => void;
  onDelete?: (id: number) => void;
  user: User | null;
}) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const loggedIn = !!user;

  const handleReply = () => {
    if (!replyText.trim()) return;
    onReply(comment.id, replyText.trim());
    setReplyText('');
    setShowReplyInput(false);
    setShowReplies(true);
  };

  const likedByMe = (comment as any).likedByMe || false;

  return (
    <div className="border-b border-zinc-100 pb-3 last:border-0">
      <div className="flex items-start gap-2">
        <div 
          className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white" 
          style={{ backgroundColor: comment.avatarColor || '#6366f1' }}
        >
          {comment.author.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800">{comment.author}</span>
            <span className="text-[11px] text-zinc-400">{comment.date}</span>
            {user?.isAdmin && onDelete && (
              <button 
                onClick={() => onDelete(comment.id)} 
                className="ml-auto text-zinc-300 hover:text-red-500 transition-colors" 
                title="Удалить комментарий"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-600">{comment.text}</p>
          <div className="mt-1.5 flex items-center gap-3">
            <button 
              onClick={() => { if (loggedIn) onLike(comment.id); }} 
              className={`flex items-center gap-1 text-xs transition-colors ${
                !loggedIn ? 'cursor-not-allowed opacity-50' : 
                likedByMe ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-600'
              }`} 
              title={!loggedIn ? 'Войдите чтобы оценить' : undefined}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${likedByMe ? 'fill-emerald-500' : ''}`} />
              <span>{comment.likes || 0}</span>
            </button>
            <button 
              onClick={() => { if (loggedIn) setShowReplyInput(!showReplyInput); }} 
              className={`text-xs transition-colors ${
                !loggedIn ? 'cursor-not-allowed opacity-50 text-zinc-300' : 'text-zinc-400 hover:text-zinc-600'
              }`} 
              title={!loggedIn ? 'Войдите чтобы ответить' : undefined}
            >
              Ответить
            </button>
          </div>
          {showReplyInput && loggedIn && (
            <div className="mt-2 flex items-center gap-2">
              <input 
                type="text" 
                value={replyText} 
                onChange={(e) => setReplyText(e.target.value)} 
                placeholder="Написать ответ..." 
                className="flex-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs outline-none focus:border-zinc-400" 
                onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }} 
              />
              <button 
                onClick={handleReply} 
                className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          )}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-1">
              <button 
                onClick={() => setShowReplies(!showReplies)} 
                className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
              >
                {showReplies ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {comment.replies.length} {comment.replies.length === 1 ? 'ответ' : comment.replies.length < 5 ? 'ответа' : 'ответов'}
              </button>
              {showReplies && (
                <div className="ml-4 mt-2 border-l-2 border-zinc-100 pl-3">
                  {comment.replies.map((reply) => (
                    <div key={reply.id} className="mb-2 last:mb-0">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-5 w-5 flex-shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold text-white" 
                          style={{ backgroundColor: reply.avatarColor || '#6366f1' }}
                        >
                          {reply.author.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-zinc-700">{reply.author}</span>
                        <span className="text-[10px] text-zinc-400">{reply.date}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{reply.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: AnimeData;
  onBack: () => void;
  onUpdateRating: (r: number) => void;
  onAddView: () => void;
  onUpdateComments: (comments: CommentData[]) => void;
}

export default function PlayPage({ data, onUpdateRating, onAddView, onUpdateComments }: Props) {
  const { user } = useUser();
  const notify = useNotify();
  const loggedIn = !!user;

  const [showFullDescription, setShowFullDescription] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [displayRating, setDisplayRating] = useState(data.rating);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newCommentText, setNewCommentText] = useState('');

  // Load comments from API
  useEffect(() => {
    setCommentsLoading(true);
    api.getComments(data.id)
      .then(c => setComments(c))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [data.id]);

  useEffect(() => { 
    onUpdateComments(comments); 
  }, [comments, onUpdateComments]);

  const shortDesc = data.description.length > 150 ? data.description.slice(0, 150) + '...' : data.description;

  const handleRate = useCallback(async (r: number) => {
    if (!loggedIn) return;
    setUserRating(r);
    try {
      const result = await api.rateAnime(data.id, r);
      setDisplayRating(result.rating);
      onUpdateRating(r);
      notify.success('Оценка сохранена');
    } catch (err: any) {
      notify.error(err.message || 'Ошибка');
    }
  }, [loggedIn, data.id, notify, onUpdateRating]);

  const handleLike = useCallback(async (id: number) => {
    if (!loggedIn) return;
    try {
      const result = await api.likeComment(id);
      setComments((prev) => {
        const update = (list: CommentData[]): CommentData[] => list.map((c) => {
          if (c.id === id) {
            return { ...c, likes: result.likes, likedByMe: result.liked } as any;
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: update(c.replies) };
          }
          return c;
        });
        return update(prev);
      });
    } catch {}
  }, [loggedIn]);

  const handleAddComment = async () => {
    if (!loggedIn || !newCommentText.trim()) return;
    try {
      const newComment = await api.addComment(data.id, newCommentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setNewCommentText('');
      notify.success('Комментарий добавлен');
    } catch (err: any) {
      notify.error(err.message || 'Ошибка');
    }
  };

  const handleReply = useCallback(async (parentId: number, text: string) => {
    if (!loggedIn || !user) return;
    try {
      const newReply = await api.addComment(data.id, text, parentId);
      setComments((prev) => {
        const update = (list: CommentData[]): CommentData[] => list.map((c) => {
          if (c.id === parentId) {
            return { ...c, replies: [...(c.replies || []), newReply] };
          }
          if (c.replies && c.replies.length > 0) {
            return { ...c, replies: update(c.replies) };
          }
          return c;
        });
        return update(prev);
      });
    } catch {}
  }, [loggedIn, user, data.id]);

  const handleDeleteComment = useCallback(async (id: number) => {
    try {
      await api.deleteComment(id);
      setComments((prev) => {
        const remove = (list: CommentData[]): CommentData[] =>
          list.filter((c) => c.id !== id).map((c) => 
            c.replies && c.replies.length > 0 ? { ...c, replies: remove(c.replies) } : c
          );
        return remove(prev);
      });
      notify.success('Комментарий удалён');
    } catch {}
  }, [notify]);

  const totalComments = comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0);

  const handleVideoEnded = () => {
    onAddView();
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />

      <div className="mx-auto max-w-[1600px]">
        <VideoPlayer
          videoSrc={data.videoSrc}
          poster={data.image}
          title={data.title}
          onEnded={handleVideoEnded}
        />

        <div className="px-4 pb-12 sm:px-6">
          <div className="mt-4">
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.genres.map((g) => (
                <span key={g} className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">{g}</span>
              ))}
              <span className="text-sm text-zinc-500">{data.year}</span>
              <span className="text-sm text-zinc-500">·</span>
              <span className="text-sm text-zinc-500">{formatViews(data.views)}</span>
              <span className="text-sm text-zinc-500">·</span>
              <span className="text-sm font-semibold text-zinc-800">★ {displayRating > 0 ? `${displayRating}/10` : '—'}</span>
            </div>

            <div className="mt-4">
              <p className="text-sm text-zinc-600 leading-relaxed">
                {showFullDescription ? data.fullDescription : shortDesc}
              </p>
              {data.fullDescription.length > 150 && (
                <button 
                  onClick={() => setShowFullDescription(!showFullDescription)} 
                  className="mt-1 text-sm font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  {showFullDescription ? 'Скрыть' : 'Показать полностью'}
                </button>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-zinc-800">Ваша оценка</h3>
              {!loggedIn && <p className="text-[11px] text-zinc-400 mt-0.5">Войдите в аккаунт чтобы оценить</p>}
              <div className="mt-2">
                <UserRating rating={userRating} onRate={handleRate} disabled={!loggedIn} />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-zinc-900">Комментарии ({totalComments})</h2>
            <div className="mt-3 flex items-center gap-2">
              <input 
                type="text" 
                value={newCommentText} 
                onChange={(e) => setNewCommentText(e.target.value)} 
                placeholder={loggedIn ? 'Оставить комментарий...' : 'Войдите чтобы комментировать'} 
                disabled={!loggedIn} 
                className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed" 
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }} 
              />
              <button 
                onClick={handleAddComment} 
                disabled={!loggedIn || !newCommentText.trim()} 
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">Пока нет комментариев. Будьте первым!</p>
              ) : (
                comments.map((c) => (
                  <CommentItem 
                    key={c.id} 
                    comment={c} 
                    onLike={handleLike} 
                    onReply={handleReply} 
                    onDelete={user?.isAdmin ? handleDeleteComment : undefined} 
                    user={user} 
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
