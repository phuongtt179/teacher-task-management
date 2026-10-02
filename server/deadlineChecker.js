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

      const subsSnap = await db
        .collection('submissions')
        .where('taskId', '==', taskId)
        .where('isLatest', '==', true)
        .get();
      const submittedTeacherIds = new Set(subsSnap.docs.map((d) => d.data().teacherId));

      const teachersNotSubmitted = assignedTo.filter((tid) => !submittedTeacherIds.has(tid));
      if (teachersNotSubmitted.length === 0) continue;

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
