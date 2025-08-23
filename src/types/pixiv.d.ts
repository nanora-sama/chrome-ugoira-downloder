export interface PixivWindow extends Window {
  pixiv?: {
    context?: {
      illustId?: string;
      userId?: string;
      ugokuIllustData?: {
        src: string;
        originalSrc: string;
        mime_type: string;
        frames: Array<{
          file: string;
          delay: number;
        }>;
      };
    };
    user?: {
      id?: string;
      loggedIn?: boolean;
    };
  };
}

export interface PixivArtwork {
  illustId: string;
  illustTitle: string;
  userId: string;
  userName: string;
  illustType: number; // 0: illustration, 1: manga, 2: ugoira
  createDate: string;
  uploadDate: string;
  width: number;
  height: number;
  pageCount: number;
  bookmarkCount: number;
  likeCount: number;
  viewCount: number;
  isOriginal: boolean;
  isBookmarkable: boolean;
  isBookmarked: boolean;
  tags: Array<{
    tag: string;
    locked: boolean;
    deletable: boolean;
    userId?: string;
    userName?: string;
  }>;
}

export interface PixivUgoiraMetaData {
  illustId: string;
  src: string;          // ZIP URL (600x600)
  originalSrc: string;  // ZIP URL (1920x1080)
  mime_type: string;
  frames: Array<{
    file: string;
    delay: number;
  }>;
}

export interface PixivApiResponse<T> {
  error: boolean;
  message: string;
  body: T;
}