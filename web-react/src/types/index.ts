export interface Question {
  id: string;
  level: number;
  points: number;
  targetWord: string;
  hint?: string;
  /** @deprecated Use hint */
  hostNote?: string;
  songTitle?: string;
  artist?: string;
  clue?: string;
  imageUrl?: string;
}

export interface Category {
  name: string;
  questions: Question[];
}

export interface QuestionPack {
  id: string;
  name: string;
  topic: string;
  version: string;
  categories: Category[];
}

export interface SpotifySession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

