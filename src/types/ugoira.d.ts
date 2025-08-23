export interface UgoiraFrame {
  blob: Blob;
  delay: number;
  filename: string;
}

export interface UgoiraInfo {
  illustId: string;
  userId: string;
  title?: string;
  frames: number;
  resolution: '600x600' | '1920x1080';
  zipUrl?: string;
}

export interface AnimationJson {
  frames: Array<{
    file: string;
    delay: number;
  }>;
}

export interface DownloadProgress {
  phase: 'fetching' | 'extracting' | 'converting' | 'complete' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export interface ConversionOptions {
  quality: number;      // GIF quality (1-10, lower is better quality)
  workers: number;      // Number of web workers for conversion
  width?: number;       // Output width (maintains aspect ratio if height not set)
  height?: number;      // Output height
  transparent?: boolean; // Preserve transparency
  dither?: boolean;     // Apply dithering
  debug?: boolean;      // Enable debug logging
}

export interface MessageRequest {
  action: 'fetch' | 'convert' | 'download' | 'detectUgoira' | 'getProgress' | 'download-and-read' | 'downloadZip' | 'downloadZipViaDownloadsAPI' | 'downloadZipNoCredentials' | 'curlLikeDownload' | 'silentDownload' | 'forceDownload';
  url?: string;
  data?: any;
  options?: any;
  referer?: string;
}

export interface MessageResponse {
  success: boolean;
  data?: any;
  error?: string;
  fallbackUrl?: string;
}