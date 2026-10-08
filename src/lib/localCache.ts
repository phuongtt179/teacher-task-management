/**
 * Bộ nhớ tạm trên máy (localStorage) cho dữ liệu ÍT KHI ĐỔI — năm học, tổ chuyên môn,
 * cơ sở, loại hồ sơ, danh mục, danh sách người dùng cho ô chọn, cài đặt trường...
 *
 * Mỗi lần tải lại trang (F5) trước đây đều đọc lại toàn bộ từ Firestore, tốn quota.
 * Giờ đọc 1 lần, giữ CACHE_TTL_MS (3 giờ) rồi mới đọc lại.
 *
 * Đánh đổi: người SỬA dữ liệu thấy ngay (các hàm ghi gọi invalidateCache), nhưng máy
 * người KHÁC chỉ thấy thay đổi sau tối đa 3 giờ, hoặc khi đăng xuất/đăng nhập lại
 * (clearAllCache lúc đăng xuất).
 *
 * KHÔNG dùng cho dữ liệu đổi thường xuyên (việc được giao, bài nộp, thông báo, hồ sơ
 * chờ duyệt) hay dữ liệu quyết định quyền (users/{uid} của chính mình, trạng thái trường).
 */
export const CACHE_TTL_MS = 3 * 60 * 60 * 1000;

const PREFIX = 'ttm-cache:v1:';
// Gộp các lời gọi trùng nhau lúc tải trang (nhiều component cùng xin 1 dữ liệu) — chỉ đọc Firestore 1 lần.
const inflight = new Map<string, Promise<unknown>>();

// Date → {"$d": ms} khi lưu, và ngược lại khi đọc (JSON không giữ được kiểu Date).
function serialize(value: unknown): string {
  return JSON.stringify(value, function (this: Record<string, unknown>, key: string, v: unknown) {
    const raw = this[key];
    return raw instanceof Date ? { $d: raw.getTime() } : v;
  });
}
function deserialize<T>(text: string): T {
  return JSON.parse(text, (_key, v) =>
    v && typeof v === 'object' && Object.keys(v).length === 1 && typeof v.$d === 'number' ? new Date(v.$d) : v
  ) as T;
}

function readEntry<T>(key: string, ttlMs: number): { hit: true; value: T } | { hit: false } {
  try {
    const text = localStorage.getItem(PREFIX + key);
    if (!text) return { hit: false };
    const { at, value } = deserialize<{ at: number; value: T }>(text);
    if (typeof at !== 'number' || Date.now() - at > ttlMs) return { hit: false };
    return { hit: true, value };
  } catch {
    return { hit: false };
  }
}

function writeEntry(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, serialize({ at: Date.now(), value }));
  } catch {
    // Hết dung lượng / trình duyệt chặn — bỏ qua, lần sau đọc lại Firestore như bình thường.
  }
}

/**
 * Trả về dữ liệu đã nhớ tạm nếu còn hạn, nếu không thì gọi loader() rồi lưu lại.
 * key nên có dạng "<nhóm>:<schoolId>:<tham số>" — nhóm dùng để invalidateCache.
 */
export async function cached<T>(key: string, loader: () => Promise<T>, ttlMs = CACHE_TTL_MS): Promise<T> {
  const entry = readEntry<T>(key, ttlMs);
  if (entry.hit) return entry.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = loader()
    .then((value) => {
      writeEntry(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** Xóa mọi mục thuộc các nhóm cho trước (vd 'departments') — gọi sau khi ghi dữ liệu đó. */
export function invalidateCache(...groups: string[]) {
  try {
    const prefixes = groups.map((g) => `${PREFIX}${g}:`);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && prefixes.some((p) => k.startsWith(p))) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
  for (const k of [...inflight.keys()]) if (groups.some((g) => k.startsWith(`${g}:`))) inflight.delete(k);
}

/** Xóa toàn bộ bộ nhớ tạm — lúc đăng xuất (máy dùng chung không để lại dữ liệu người trước). */
export function clearAllCache() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
    }
  } catch {
    // ignore
  }
  inflight.clear();
}
