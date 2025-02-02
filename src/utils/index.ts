export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  return btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
}
