declare module 'gifenc' {
  export interface GIFOptions {
    palette?: number[][];
    delay?: number;
    dispose?: number;
    transparent?: number;
  }

  export interface GIF {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      options?: GIFOptions
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): GIF;
  
  export function quantize(
    data: Uint8Array,
    maxColors: number
  ): number[][];
  
  export function applyPalette(
    data: Uint8Array,
    palette: number[][]
  ): Uint8Array;
}