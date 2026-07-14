import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { notificationService } from './notificationService';
import { TaskUpdate, TaskUpdateType } from '../types';

// Chuyển dữ liệu Firestore -> TaskUpdate (đổi Timestamp sang Date)
const mapTaskUpdate = (id: string, data: any): TaskUpdate => ({
  id,
  taskId: data.taskId,
  taskTitle: data.taskTitle || '',
  teacherId: data.teacherId,
  teacherName: data.teacherName || '',
  type: data.type,
  note: data.note || '',
  percent: data.percent ?? undefined,
  requestedDeadline: data.requestedDeadline?.toDate?.() ?? undefined,
  currentDeadline: data.currentDeadline?.toDate?.() ?? undefined,
  approvedDeadline: data.approvedDeadline?.toDate?.() ?? undefined,
  status: data.status || 'open',
  createdAt: data.createdAt?.toDate?.() ?? new Date(),
  reviewedBy: data.reviewedBy ?? undefined,
  reviewedByName: data.reviewedByName ?? undefined,
  reviewedAt: data.reviewedAt?.toDate?.() ?? undefined,
  reviewNote: data.reviewNote ?? undefined,
});

interface CreateUpdateInput {
  taskId: string;
  taskTitle: string;
  teacherId: string;
  teacherName: string;
  type: TaskUpdateType;
  note: string;
  percent?: number; // progress
  requestedDeadline?: Date; // extension
}

export const taskUpdateService = {
  /**
   * Giáo viên gửi 1 cập nhật giữa chừng (tiến độ / vướng mắc / xin gia hạn).
   * Ghi vào collection taskUpdates rồi báo cho người đã giao việc (task.createdBy).
   */
  async createUpdate(input: CreateUpdateInput): Promise<string> {
    const taskSnap = await getDoc(doc(db, 'tasks', input.taskId));
    if (!taskSnap.exists()) throw new Error('Không tìm thấy công việc');
    const task = taskSnap.data();

    const data: any = {
      taskId: input.taskId,
      taskTitle: input.taskTitle || task.title || '',
      teacherId: input.teacherId,
      teacherName: input.teacherName,
      type: input.type,
      note: input.note || '',
      status: 'open',
      createdAt: Timestamp.fromDate(new Date()),
    };

    if (input.type === 'progress' && typeof input.percent === 'number') {
      data.percent = Math.max(0, Math.min(100, Math.round(input.percent)));
    }
    if (input.type === 'extension' && input.requestedDeadline) {
      data.requestedDeadline = Timestamp.fromDate(input.requestedDeadline);
      // Ảnh chụp hạn hiện tại để BGH đối chiếu
      const currentDeadline = task.deadline2?.toDate?.() || task.deadline?.toDate?.();
      if (currentDeadline) data.currentDeadline = Timestamp.fromDate(currentDeadline);
    }

    const docRef = await addDoc(collection(db, 'taskUpdates'), data);

    // Báo cho người giao việc (thường là BGH)
    const recipientId = task.createdBy;
    if (recipientId) {
      const notifByType: Record<TaskUpdateType, { type: any; title: string; message: string }> = {
        blocker: {
          type: 'task_blocker',
          title: 'Giáo viên báo vướng mắc',
          message: `${input.teacherName} gặp vướng mắc ở "${data.taskTitle}": ${input.note}`,
        },
        extension: {
          type: 'task_extension_request',
          title: 'Yêu cầu gia hạn',
          message: `${input.teacherName} xin gia hạn "${data.taskTitle}"${input.note ? ': ' + input.note : ''}`,
        },
        progress: {
          type: 'task_progress',
          title: 'Cập nhật tiến độ',
          message: `${input.teacherName} báo tiến độ "${data.taskTitle}": ${data.percent ?? 0}%${input.note ? ' - ' + input.note : ''}`,
        },
        help_request: {
          type: 'task_help_request',
          title: 'Đề xuất bổ sung người',
          message: `${input.teacherName} đề xuất bổ sung người cho "${data.taskTitle}": ${input.note}`,
        },
      };
      const n = notifByType[input.type];
      await notificationService.createNotification(recipientId, n.type, n.title, n.message, {
        taskId: input.taskId,
        taskTitle: data.taskTitle,
      });
    }

    return docRef.id;
  },

  /** Lấy các cập nhật của chính 1 giáo viên (mọi công việc), mới nhất trước */
  async getUpdatesForTeacher(teacherId: string): Promise<TaskUpdate[]> {
    const q = query(collection(db, 'taskUpdates'), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapTaskUpdate(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /** Lấy các cập nhật của 1 giáo viên cho 1 công việc cụ thể */
  async getUpdatesForTeacherTask(teacherId: string, taskId: string): Promise<TaskUpdate[]> {
    const q = query(
      collection(db, 'taskUpdates'),
      where('teacherId', '==', teacherId),
      where('taskId', '==', taskId)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapTaskUpdate(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /** BGH: lấy toàn bộ cập nhật của 1 công việc (mọi giáo viên) */
  async getUpdatesForTask(taskId: string): Promise<TaskUpdate[]> {
    const q = query(collection(db, 'taskUpdates'), where('taskId', '==', taskId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapTaskUpdate(d.id, d.data()))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /** BGH: các việc đang có yêu cầu chờ xử lý (blocker/extension còn 'open') — để hiện badge/nhắc */
  async getPendingUpdates(): Promise<TaskUpdate[]> {
    const q = query(collection(db, 'taskUpdates'), where('status', '==', 'open'));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapTaskUpdate(d.id, d.data()))
      .filter((u) => u.type === 'blocker' || u.type === 'extension')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /** BGH đánh dấu đã xử lý xong 1 vướng mắc HOẶC 1 đề xuất bổ sung người */
  async resolveBlocker(
    update: TaskUpdate,
    reviewedBy: string,
    reviewedByName: string,
    reviewNote: string
  ): Promise<void> {
    await updateDoc(doc(db, 'taskUpdates', update.id), {
      status: 'resolved',
      reviewedBy,
      reviewedByName,
      reviewedAt: Timestamp.fromDate(new Date()),
      reviewNote: reviewNote || '',
    });
    const isHelp = update.type === 'help_request';
    await notificationService.createNotification(
      update.teacherId,
      isHelp ? 'task_help_request' : 'task_blocker',
      isHelp ? 'Đã xử lý đề xuất bổ sung người' : 'Vướng mắc đã được xử lý',
      isHelp
        ? `${reviewedByName} đã phản hồi đề xuất bổ sung người cho "${update.taskTitle}"${reviewNote ? ': ' + reviewNote : ''}`
        : `${reviewedByName} đã phản hồi vướng mắc "${update.taskTitle}"${reviewNote ? ': ' + reviewNote : ''}`,
      { taskId: update.taskId, taskTitle: update.taskTitle }
    );
  },

  /**
   * BGH duyệt/từ chối xin gia hạn.
   * Khi duyệt: cập nhật hạn công việc (deadline + deadline2) sang hạn mới, đưa trạng thái
   * việc về 'assigned' nếu đang 'overdue', rồi báo giáo viên.
   */
  async reviewExtension(
    update: TaskUpdate,
    approve: boolean,
    reviewedBy: string,
    reviewedByName: string,
    reviewNote: string,
    approvedDeadline?: Date
  ): Promise<void> {
    const now = new Date();

    if (approve) {
      const newDeadline = approvedDeadline || update.requestedDeadline;
      if (!newDeadline) throw new Error('Thiếu hạn gia hạn');
      // Giữ khoảng ân hạn 5 ngày như lúc tạo việc
      const newDeadline2 = new Date(newDeadline);
      newDeadline2.setDate(newDeadline2.getDate() + 5);

      const taskRef = doc(db, 'tasks', update.taskId);
      const taskSnap = await getDoc(taskRef);
      const taskUpdatePayload: any = {
        deadline: Timestamp.fromDate(newDeadline),
        deadline2: Timestamp.fromDate(newDeadline2),
        updatedAt: Timestamp.fromDate(now),
      };
      // Nếu việc đang quá hạn thì mở lại về 'assigned' để giáo viên còn nộp
      if (taskSnap.exists() && taskSnap.data().status === 'overdue') {
        taskUpdatePayload.status = 'assigned';
      }
      await updateDoc(taskRef, taskUpdatePayload);

      await updateDoc(doc(db, 'taskUpdates', update.id), {
        status: 'approved',
        approvedDeadline: Timestamp.fromDate(newDeadline),
        reviewedBy,
        reviewedByName,
        reviewedAt: Timestamp.fromDate(now),
        reviewNote: reviewNote || '',
      });

      await notificationService.createNotification(
        update.teacherId,
        'task_extension_approved',
        'Được chấp thuận gia hạn',
        `${reviewedByName} đã duyệt gia hạn "${update.taskTitle}" đến ${newDeadline.toLocaleDateString('vi-VN')}${reviewNote ? '. ' + reviewNote : ''}`,
        { taskId: update.taskId, taskTitle: update.taskTitle }
      );
    } else {
      await updateDoc(doc(db, 'taskUpdates', update.id), {
        status: 'rejected',
        reviewedBy,
        reviewedByName,
        reviewedAt: Timestamp.fromDate(now),
        reviewNote: reviewNote || '',
      });
      await notificationService.createNotification(
        update.teacherId,
        'task_extension_rejected',
        'Không được gia hạn',
        `${reviewedByName} chưa duyệt gia hạn "${update.taskTitle}"${reviewNote ? ': ' + reviewNote : ''}`,
        { taskId: update.taskId, taskTitle: update.taskTitle }
      );
    }
  },
};
