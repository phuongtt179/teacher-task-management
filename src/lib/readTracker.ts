import {
  getDocs as firestoreGetDocs,
  getDoc as firestoreGetDoc,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { authFetch } from './authFetch';

/**
 * Đo lượt đọc Firestore phía trình duyệt — dùng getDocs ở đây thay cho getDocs của Firestore
 * trong mọi service. Không ghi gì vào Firestore, chỉ báo về server để in ra nhật ký Render:
 *
 *  1. "Máy đếm" cú đọc lớn: 1 truy vấn trả về >= BIG_READ_THRESHOLD tài liệu → báo ngay
 *     (POST /api/telemetry/big-read, dòng [big-read]).
 *  2. "Sổ cái": cộng dồn MỌI truy vấn theo màn hình + bảng dữ liệu; cứ FLUSH_INTERVAL_MS và
 *     khi người dùng rời app (ẩn tab / tắt app) thì gửi 1 bản tổng (POST
 *     /api/telemetry/read-ledger, dòng [read-ledger]). Không có lượt đọc mới thì không gửi.
 */
export const BIG_READ_THRESHOLD = 300;
/** Cùng một màn hình + bảng dữ liệu chỉ báo tối đa 1 lần trong khoảng này (gộp số lần lặp). */
export const REPORT_GAP_MS = 2 * 60_000;
/** Tối đa số lần báo mỗi phiên (mỗi lần báo server tốn 2 lượt đọc để xác thực). */
export const MAX_REPORTS_PER_SESSION = 30;
export const FLUSH_INTERVAL_MS = 10 * 60_000;
/** Tối đa số dòng (màn hình + bảng) mỗi lần gửi sổ cái — phần dư gộp vào dòng "khác". */
export const MAX_LEDGER_ENTRIES = 30;

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface BigRead {
  path: string;
  collection: string;
  size: number;
  repeats: number;
}

export interface LedgerEntry {
  path: string;
  collection: string;
  reads: number;
  queries: number;
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

/** Sổ cái thuần: cộng dồn rồi lấy ra (và xóa) bản tổng — tách riêng để kiểm thử được. */
export function createReadLedger() {
  const entries = new Map<string, LedgerEntry>();
  return {
    add(path: string, collection: string, reads: number) {
      const key = `${path}|${collection}`;
      const e = entries.get(key) ?? { path, collection, reads: 0, queries: 0 };
      e.reads += reads;
      e.queries += 1;
      entries.set(key, e);
    },
    /** Lấy bản tổng (nhiều lượt đọc nhất trước) và xóa sổ; rỗng nếu chưa đọc gì. */
    take(): LedgerEntry[] {
      const list = [...entries.values()].sort((a, b) => b.reads - a.reads);
      entries.clear();
      if (list.length <= MAX_LEDGER_ENTRIES) return list;
      const head = list.slice(0, MAX_LEDGER_ENTRIES - 1);
      const rest = list.slice(MAX_LEDGER_ENTRIES - 1);
      head.push({
        path: '(khác)',
        collection: '*',
        reads: rest.reduce((s, e) => s + e.reads, 0),
        queries: rest.reduce((s, e) => s + e.queries, 0),
      });
      return head;
    },
  };
}

/** Bỏ mã tài liệu trong đường dẫn (/teacher/tasks/abc123… → /teacher/tasks/:id) để gộp theo màn hình. */
export function screenOf(pathname: string): string {
  return pathname
    .split('/')
    .map((seg) => (/^[A-Za-z0-9_-]{15,}$/.test(seg) ? ':id' : seg))
    .join('/') || '/';
}

/** Tên bảng của truy vấn — kể cả khi không có kết quả (vẫn tính 1 lượt đọc). */
function collectionOf(query: Query<unknown, DocumentData>, snapshot: QuerySnapshot<unknown, DocumentData>): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const path = (query as any)._query?.path?.canonicalString?.();
    if (typeof path === 'string' && path) return path;
  } catch {
    /* bỏ qua */
  }
  return snapshot.docs[0]?.ref.parent.path ?? '?';
}

const post = (endpoint: string, body: unknown) =>
  authFetch(`${API_BASE_URL}/telemetry/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {});

/** Tổng lượt đọc phía trình duyệt từ lúc mở trang — kịch bản kiểm thử trên emulator đọc qua window.__readTotals. */
export const readTotals = { reads: 0, queries: 0 };
/** Chỉ khi chạy emulator: nhật ký từng lần đọc (bảng, số tài liệu) cho kịch bản đo. */
const readLog: Array<{ collection: string; reads: number }> | null =
  typeof window !== 'undefined' && import.meta.env.VITE_USE_EMULATOR === 'true' ? [] : null;
if (readLog) {
  const w = window as unknown as { __readTotals: typeof readTotals; __readLog: typeof readLog };
  w.__readTotals = readTotals;
  w.__readLog = readLog;
}

const report = createBigReadReporter((r) => post('big-read', r));
const ledger = createReadLedger();
let ledgerSince = Date.now();

function flushLedger() {
  const entries = ledger.take();
  if (entries.length === 0) return;
  const minutes = Math.max(1, Math.round((Date.now() - ledgerSince) / 60_000));
  ledgerSince = Date.now();
  post('read-ledger', { minutes, entries });
}

if (typeof window !== 'undefined') {
  window.setInterval(flushLedger, FLUSH_INTERVAL_MS);
  // Rời app (ẩn tab, tắt app trên điện thoại) → gửi ngay phần đang có.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLedger();
  });
}

export async function getDocs<AppModelType, DbModelType extends DocumentData>(
  query: Query<AppModelType, DbModelType>
): Promise<QuerySnapshot<AppModelType, DbModelType>> {
  const snapshot = await firestoreGetDocs(query);
  try {
    if (!snapshot.metadata.fromCache) {
      const screen = screenOf(window.location.pathname);
      const collection = collectionOf(query as Query<unknown, DocumentData>, snapshot as QuerySnapshot<unknown, DocumentData>);
      // Truy vấn không có kết quả vẫn bị tính 1 lượt đọc.
      ledger.add(screen, collection, Math.max(1, snapshot.size));
      readTotals.reads += Math.max(1, snapshot.size);
      readTotals.queries += 1;
      readLog?.push({ collection, reads: Math.max(1, snapshot.size) });
      if (snapshot.size >= BIG_READ_THRESHOLD) report(screen, collection, snapshot.size);
    }
  } catch {
    /* máy đếm không bao giờ được làm hỏng việc tải dữ liệu */
  }
  return snapshot;
}

/** Đọc 1 tài liệu (1 lượt đọc, kể cả khi không tồn tại) — cũng ghi vào sổ cái. */
export async function getDoc<AppModelType, DbModelType extends DocumentData>(
  reference: DocumentReference<AppModelType, DbModelType>
): Promise<DocumentSnapshot<AppModelType, DbModelType>> {
  const snapshot = await firestoreGetDoc(reference);
  try {
    if (!snapshot.metadata.fromCache) {
      ledger.add(screenOf(window.location.pathname), reference.parent.path, 1);
      readTotals.reads += 1;
      readTotals.queries += 1;
      readLog?.push({ collection: reference.parent.path + ' (1 tài liệu)', reads: 1 });
    }
  } catch {
    /* máy đếm không bao giờ được làm hỏng việc tải dữ liệu */
  }
  return snapshot;
}
