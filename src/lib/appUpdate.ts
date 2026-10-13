/**
 * Tự chuyển sang bản app mới sau mỗi lần deploy.
 *
 * vite-plugin-pwa (registerType 'autoUpdate') đã tự tải service worker mới và cho nó
 * nắm quyền ngay (skipWaiting + clientsClaim) — nhưng trang đang mở vẫn chạy mã JS cũ
 * trong bộ nhớ cho tới khi tải lại. Trên điện thoại, app nằm ngầm có khi cả tuần nên
 * thầy cô cứ dùng bản cũ mãi. Ở đây:
 *  - mỗi lần người dùng quay lại app (mở từ nền lên, chuyển tab về) → hỏi có bản mới không;
 *  - service worker mới nắm quyền (controllerchange) → tải lại trang MỘT lần, nhưng chỉ
 *    lúc an toàn: ngay sau khi mở/quay lại app và không bận (không đang nộp file, không
 *    mở hộp thoại, không đang gõ). Đang dùng dở thì chỉ hiện dòng "Có bản cập nhật" để
 *    người dùng tự bấm, và tự tải lại ở lần quay lại app kế tiếp.
 *  - chặn tải lại liên tục (trước đây từng bị vòng lặp tải lại nên tính năng bị tắt).
 *
 * Không đọc Firestore: hỏi bản mới chỉ là tải lại sw.js từ máy chủ web.
 */

/** Khoảng "vừa mở / vừa quay lại app" — trong khoảng này tải lại không làm phiền ai. */
export const FRESH_WINDOW_MS = 30_000;
/** Không hỏi bản mới dồn dập mỗi lần chuyển tab. */
export const CHECK_THROTTLE_MS = 5 * 60_000;
/** Đã tự tải lại vì cập nhật trong khoảng này thì không tự tải lại nữa (chống vòng lặp). */
export const RELOAD_GUARD_MS = 60_000;
const RELOAD_KEY = 'appUpdate:reloadedAt';

export interface AppUpdateEnv {
  now: () => number;
  isVisible: () => boolean;
  isBusy: () => boolean;
  reload: () => void;
  checkForUpdate: () => void;
  readReloadedAt: () => number;
  writeReloadedAt: (t: number) => void;
}

export type UpdateListener = (updateReady: boolean) => void;

/** Bộ máy trạng thái thuần (không đụng trình duyệt) — để kiểm thử được. */
export function createAppUpdater(env: AppUpdateEnv, hadControllerAtStart: boolean) {
  let hadController = hadControllerAtStart;
  let updateReady = false;
  let freshSince = env.now(); // lúc mở trang cũng tính là "vừa mở"
  let lastCheck = -Infinity;
  const listeners = new Set<UpdateListener>();

  const notify = () => listeners.forEach((l) => l(updateReady));

  const canAutoReload = () => {
    if (!env.isVisible() || env.isBusy()) return false;
    if (env.now() - env.readReloadedAt() < RELOAD_GUARD_MS) return false;
    return env.now() - freshSince <= FRESH_WINDOW_MS;
  };

  const doReload = () => {
    env.writeReloadedAt(env.now());
    env.reload();
  };

  const tryApply = () => {
    if (!updateReady) return;
    if (canAutoReload()) doReload();
    else notify();
  };

  return {
    /** Service worker mới vừa nắm quyền điều khiển trang. */
    onControllerChange() {
      // Lần cài service worker ĐẦU TIÊN (máy chưa từng có) cũng phát sự kiện này —
      // trang đang chạy đã là bản mới nhất, không cần tải lại.
      if (!hadController) {
        hadController = true;
        return;
      }
      updateReady = true;
      tryApply();
    },
    /** Trang vừa hiện lại (mở app từ nền lên, chuyển tab về). */
    onVisible() {
      freshSince = env.now();
      if (updateReady) {
        tryApply();
        return;
      }
      if (env.now() - lastCheck >= CHECK_THROTTLE_MS) {
        lastCheck = env.now();
        env.checkForUpdate();
      }
    },
    /** Người dùng bấm "Tải lại" trên dòng thông báo. */
    reloadNow() {
      doReload();
    },
    isUpdateReady: () => updateReady,
    subscribe(listener: UpdateListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// ── Gắn vào trình duyệt ────────────────────────────────────────────────────────

let inFlight = 0;
/** Đánh dấu đang làm việc không được ngắt (vd đang nộp file). Trả về hàm kết thúc. */
export function markBusy(): () => void {
  inFlight += 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    inFlight -= 1;
  };
}

function browserIsBusy(): boolean {
  if (inFlight > 0) return true;
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName === 'INPUT') {
    const type = (el as HTMLInputElement).type;
    return !['button', 'submit', 'checkbox', 'radio', 'file', 'reset', 'range', 'color'].includes(type);
  }
  return false;
}

let updater: ReturnType<typeof createAppUpdater> | null = null;

export function getAppUpdater() {
  return updater;
}

export function setupAppAutoUpdate() {
  if (updater || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;

  updater = createAppUpdater(
    {
      now: () => Date.now(),
      isVisible: () => document.visibilityState === 'visible',
      isBusy: browserIsBusy,
      reload: () => window.location.reload(),
      checkForUpdate: () => {
        sw.getRegistration()
          .then((reg) => reg?.update())
          .catch(() => {});
      },
      readReloadedAt: () => {
        try {
          return Number(sessionStorage.getItem(RELOAD_KEY)) || 0;
        } catch {
          return 0;
        }
      },
      writeReloadedAt: (t) => {
        try {
          sessionStorage.setItem(RELOAD_KEY, String(t));
        } catch {
          /* bỏ qua */
        }
      },
    },
    !!sw.controller
  );

  sw.addEventListener('controllerchange', () => updater?.onControllerChange());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') updater?.onVisible();
  });
  // Ngoài lần quay lại app, vẫn hỏi định kỳ cho máy để mở cả ngày (phòng giáo viên).
  window.setInterval(() => {
    sw.getRegistration()
      .then((reg) => reg?.update())
      .catch(() => {});
  }, 60 * 60_000);
}
