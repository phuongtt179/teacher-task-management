/**
 * Phiên bản app + loại thiết bị — gửi kèm mọi lần gọi server (header X-App-Build / X-App-Device)
 * và trong sổ cái lượt đọc, để biết máy nào còn chạy bản cũ / loại máy nào đọc nhiều.
 */
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'unknown';

export function deviceLabel(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'Mac'
    : /Linux/.test(ua) ? 'Linux' : 'Khác';
  const browser = /Zalo/i.test(ua) ? 'Zalo'
    : /FBAN|FBAV/.test(ua) ? 'Facebook'
    : /Edg\//.test(ua) ? 'Edge'
    : /CriOS|Chrome\//.test(ua) ? 'Chrome'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'Khác';
  let installed = false;
  try {
    installed = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  } catch {
    /* bỏ qua */
  }
  return `${os}-${browser}${installed ? '-app' : ''}`;
}

export const clientHeaders = (): Record<string, string> => ({ 'X-App-Build': APP_BUILD, 'X-App-Device': deviceLabel() });
