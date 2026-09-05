export interface RawImage {
  width: number
  height: number
  rgba: Buffer
}

export declare const PNG_SIGNATURE: Buffer
export declare function chunk(type: string, data: Buffer): Buffer
export declare function encodePng(width: number, height: number, rgba: Buffer): Buffer
export declare function makePng(
  width: number,
  height: number,
  colorType: number,
  raw: Buffer
): Buffer
export declare function decodePng(buf: Uint8Array): RawImage
export declare function resizeBilinear(src: RawImage, tw: number, th: number): RawImage
export declare function drawIcon(size: number): Buffer
