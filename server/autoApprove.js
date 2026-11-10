import admin, { db } from './firebase-config.js';

/**
 * Trường đã TẮT duyệt hồ sơ (schoolSettings.requireDocumentApproval khác true) nhưng vẫn có hồ sơ
 * "chờ duyệt" — do máy còn chạy bản app cũ (bản cũ luôn đặt hồ sơ của giáo viên là chờ duyệt),
 * hoặc nộp từ trước khi tắt duyệt. Không còn ai duyệt (màn Phê duyệt đã ẩn) nên tự duyệt.
 *
 * Chạy cùng nhịp kiểm tra hạn (30 phút/lần). Không có hồ sơ chờ duyệt → tốn 1 lượt đọc.
 * Trường đang BẬT duyệt thì không đụng tới. Trả về số hồ sơ đã duyệt.
 */
const BATCH_LIMIT = 300;

export async function autoApprovePendingDocuments() {
  try {
    const snap = await db.collection('documents').where('status', '==', 'pending').limit(BATCH_LIMIT).get();
    if (snap.empty) return 0;

    const bySchool = new Map();
    snap.docs.forEach((d) => {
      const schoolId = d.data().schoolId;
      if (!schoolId) return;
      if (!bySchool.has(schoolId)) bySchool.set(schoolId, []);
      bySchool.get(schoolId).push(d.ref);
    });

    const now = admin.firestore.Timestamp.now();
    let approved = 0;
    for (const [schoolId, refs] of bySchool) {
      const settings = await db.collection('schoolSettings').doc(schoolId).get();
      if (settings.exists && settings.data().requireDocumentApproval === true) continue;
      const batch = db.batch();
      refs.forEach((ref) => batch.update(ref, {
        status: 'approved',
        approvedBy: 'system',
        approvedByName: 'Tự động (trường đã tắt duyệt hồ sơ)',
        approvedAt: now,
      }));
      await batch.commit();
      approved += refs.length;
      console.log(`✅ Tự duyệt ${refs.length} hồ sơ chờ duyệt của trường ${schoolId} (đã tắt duyệt hồ sơ)`);
    }
    return approved;
  } catch (error) {
    console.error('autoApprovePendingDocuments failed:', error.message);
    return 0;
  }
}
