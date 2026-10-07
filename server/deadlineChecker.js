import admin, { db } from './firebase-config.js';
import { sendPushNotification } from './notificationService.js';

/**
 * Kiểm tra deadline sắp đến (trong 24h, chưa nộp bài) và nhắc nhở giáo viên.
 *
 * Trước đây việc này chạy ở CLIENT (deadlineCheckerService.ts), mỗi trình duyệt
 * đang mở tự chạy 1 bản độc lập mỗi 30 phút — N giáo viên mở tab cùng lúc = N
 * lần đọc Firestore trùng nhau, và có thể gửi TRÙNG LẶP cùng 1 thông báo nhắc
 * hạn cho cùng 1 người (mỗi tab gửi 1 lần). Chuyển sang chạy tập trung ở server,
 * chỉ 1 lần duy nhất bất kể bao nhiêu người đang mở app.
 *
 * Quét toàn bộ (mọi trường) trong 1 lần thay vì lặp theo từng schoolId — Admin
 * SDK không bị giới hạn bởi rules nên không cần tenant-scope từng truy vấn.
 */
export async function checkDeadlinesAndNotify() {
  try {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasksSnap = await db
      .collection('tasks')
      .where('deadline', '>', admin.firestore.Timestamp.fromDate(now))
      .where('deadline', '<', admin.firestore.Timestamp.fromDate(in24Hours))
      .where('status', 'in', ['assigned', 'in_progress'])
      .get();

    for (const taskDoc of tasksSnap.docs) {
      const task = taskDoc.data();
      const taskId = taskDoc.id;
      const schoolId = task.schoolId;
      const assignedTo = Array.isArray(task.assignedTo) ? task.assignedTo : [];
      if (!schoolId || assignedTo.length === 0 || !task.deadline) continue;

      // Mỗi người chỉ được nhắc 1 lần cho mỗi hạn chót. Lưu trên task mốc deadline +
      // danh sách người ĐÃ XỬ LÝ = đã được nhắc HOẶC đã nộp bài; hạn bị dời thì danh
      // sách tự reset và nhắc lại. Khi mọi người được giao đều đã xử lý thì bỏ qua
      // luôn, không đọc bài nộp. (Trước đây chỉ lưu người đã nhắc, nên việc nào có ít
      // nhất 1 người đã nộp thì 30 phút/lần lại đọc lại toàn bộ bài nộp vô ích —
      // ~8.000–10.000 lượt đọc/ngày cuối năm học.)
      const deadlineMillis = task.deadline.toMillis();
      const sameDeadline = task.deadlineReminderFor === deadlineMillis;
      const handledSet = new Set([
        ...(sameDeadline && Array.isArray(task.deadlineHandledUids) ? task.deadlineHandledUids : []),
        // tương thích dữ liệu ghi bởi phiên bản trước (chỉ có danh sách đã nhắc)
        ...(sameDeadline && Array.isArray(task.deadlineRemindedUids) ? task.deadlineRemindedUids : []),
      ]);
      if (assignedTo.every((tid) => handledSet.has(tid))) continue;

      const subsSnap = await db
        .collection('submissions')
        .where('taskId', '==', taskId)
        .where('isLatest', '==', true)
        .get();
      const submittedTeacherIds = new Set(subsSnap.docs.map((d) => d.data().teacherId));

      const teachersNotSubmitted = assignedTo.filter(
        (tid) => !submittedTeacherIds.has(tid) && !handledSet.has(tid)
      );
      const newlySubmitted = assignedTo.filter((tid) => submittedTeacherIds.has(tid) && !handledSet.has(tid));
      const updatedHandled = [...handledSet, ...newlySubmitted, ...teachersNotSubmitted];

      if (teachersNotSubmitted.length === 0) {
        // Không ai cần nhắc, nhưng ghi lại người đã nộp để lần sau khỏi đọc lại.
        if (newlySubmitted.length > 0) {
          await taskDoc.ref.update({ deadlineReminderFor: deadlineMillis, deadlineHandledUids: updatedHandled });
        }
        continue;
      }

      const deadlineDate = task.deadline.toDate();
      const hoursLeft = Math.floor((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      const title = 'Deadline sắp đến';
      const message = `Công việc "${task.title}" sẽ hết hạn trong ${hoursLeft} giờ nữa`;

      // Ghi thông báo trong app (chuông thông báo) cho từng người chưa nộp.
      const batch = db.batch();
      teachersNotSubmitted.forEach((teacherId) => {
        const ref = db.collection('notifications').doc();
        batch.set(ref, {
          schoolId,
          userId: teacherId,
          type: 'task_deadline',
          title,
          message,
          data: { taskId, taskTitle: task.title || '' },
          read: false,
          createdAt: admin.firestore.Timestamp.fromDate(now),
        });
      });
      batch.update(taskDoc.ref, {
        deadlineReminderFor: deadlineMillis,
        deadlineHandledUids: updatedHandled,
      });
      await batch.commit();

      // Gửi kèm push notification (nếu người đó đã bật).
      await sendPushNotification(teachersNotSubmitted, title, message, {
        type: 'task_deadline',
        taskId,
        taskTitle: task.title || '',
      });
    }
  } catch (error) {
    console.error('Error checking deadlines:', error);
  }
}
