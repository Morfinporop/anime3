export interface AnimeData {
  id: number;
  title: string;
  description: string;
  fullDescription: string;
  image: string;
  views: number;
  rating: number;
  genres: string[];
  year: number;
  videoSrc: string;
  comments: CommentData[];
}

export interface CommentData {
  id: number;
  author: string;
  avatar: string;
  avatarColor: string;
  text: string;
  date: string;
  likes: number;
  dislikes: number;
  replies: CommentData[];
}
