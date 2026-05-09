/** Minimal type declaration for pako v1.x (no @types/pako installed). */
declare module 'pako' {
  export function deflate(data: Uint8Array | string, options?: object): Uint8Array;
  export function inflate(data: Uint8Array, options?: object): Uint8Array;
}
