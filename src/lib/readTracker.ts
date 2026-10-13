import { getDocs as firestoreGetDocs, type DocumentData, type Query, type QuerySnapshot } from 'firebase/firestore';
import { authFetch } from './authFetch';

/**
 * "Máy đếm" lượt đọc lớn: dùng thay getDocs của Firestore trong các service. Lần nào một
 * truy vấn trả về từ BIG_READ_THRESHOLD tài liệu trở lên (mỗi tài liệu = 1 lượt đọc quota)
 * thì báo về server (POST /api/telemetry/big-read) để ghi vào nhật ký Render — nhờ vậy
 * biết đích danh màn hình nào đang đọc nhiều. Không ghi gì vào Firestore.
 */
export const BIG_READ_THRESHOLD = 300;
/** Cùng một màn hình + bảng dữ liệu chỉ báo tối đa 1 lần trong khoảng này (gộp số lần lặp). */
export const REPORT_GAP_MS = 2 * 60_000;
/** Tối đa số lần báo mỗi phiên (mỗi lần báo server tốn 2 lượt đọc để xác thực). */
export const MAX_REPORTS_PER_SESSION = 30;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface BigRead {
  path: string;
  collection: string;
  size: number;
  repeats: number;
}

/** Bộ gộp/giới hạn thuần — tách riêng để kiểm thử được. */
export function createBigReadReporter(send: (r: BigRead) => void, now: () => number = () => Date.now()) {
  const lastSentAt = new Map<string, number>();
  const skipped = new Map<string, number>();
  let sent = 0;
  return (path: string, collection: string, size: number) => {
    if (size < BIG_READ_THRESHOLD) return;
    const key = `${path}|${collection}`;
    const last = lastSentAt.get(key);
    if (sent >= MAX_REPORTS_PER_SESSION || (last !== undefined && now() - last < REPORT_GAP_MS)) {
      skipped.set(key, (skipped.get(key) ?? 0) + 1);
      return;
    }
    const repeats = skipped.get(key) ?? 0;
    skipped.delete(key);
    lastSentAt.set(key, now());
    sent += 1;
    send({ path, collection, size, repeats });
  };
}

const report = createBigReadReporter((r) => {
  authFetch(`${API_BASE_URL}/telemetry/big-read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(r),
    keepalive: true,
  }).catch(() => {});
});

export async function getDocs<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>> {
  const snapshot = await firestoreGetDocs(query);
  try {
    if (!snapshot.metadata.fromCache && snapshot.size >= BIG_READ_THRESHOLD) {
      report(window.location.pathname, snapshot.docs[0]?.ref.parent.path ?? '?', snapshot.size);
    }
  } catch {
    /* máy đếm không bao giờ được làm hỏng việc tải dữ liệu */
  }
  return snapshot;
}
