declare module 'omggif' {
  export class GifWriter {
    constructor(
      buffer: Uint8Array,
      width: number,
      height: number,
      options?: {
        loop?: number;
        palette?: number[] | null;
      }
    );
    
    addFrame(
      x: number,
      y: number,
      width: number,
      height: number,
      indexedPixels: Uint8Array,
      options?: {
        palette?: number[];
        delay?: number;
        disposal?: number;
        transparent?: number | null;
      }
    ): void;
    
    end(): number;
  }
  
  export class GifReader {
    constructor(buffer: Uint8Array);
  }
}