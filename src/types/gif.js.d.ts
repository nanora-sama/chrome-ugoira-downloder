declare module 'gif.js' {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    transparent?: number;
    dither?: boolean;
    debug?: boolean;
    workerScript?: string;
    background?: string;
    repeat?: number;
  }

  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: HTMLImageElement | HTMLCanvasElement | CanvasRenderingContext2D | ImageData, options?: AddFrameOptions): void;
    on(event: 'finished', callback: (blob: Blob) => void): void;
    on(event: 'progress', callback: (progress: number) => void): void;
    on(event: 'error', callback: (error: any) => void): void;
    on(event: 'abort', callback: () => void): void;
    render(): void;
    abort(): void;
    running: boolean;
  }

  export = GIF;
}