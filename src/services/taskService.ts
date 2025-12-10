import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
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
import { googleDriveServiceBackend } from './googleDriveServiceBackend';
import { schoolYearService } from './schoolYearService';
import { Task, Submission, TaskStatus } from '../types';

// ✅ HÀM HELPER: Loại bỏ dấu tiếng Việt và ký tự đặc biệt
const removeVietnameseTones = (str: string): string => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Loại bỏ khoảng trắng và ký tự đặc biệt, thay bằng gạch dưới
  str = str.replace(/\s+/g, "_");
  str = str.replace(/[^a-zA-Z0-9._-]/g, "_");
  return str;
};

export const taskService = {
  // Create new task
  async createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        ...taskData,
        status: 'assigned' as TaskStatus,
        deadline: Timestamp.fromDate(taskData.deadline),
        deadline2: taskData.deadline2 ? Timestamp.fromDate(taskData.deadline2) : null,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
      });
      // Notify assigned teachers
      await notificationService.notifyTaskAssigned(
        taskData.assignedTo,
        docRef.id,
        taskData.title,
        taskData.createdByName
      );
      return docRef.id;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  },
  
  // Get task by ID
  async getTaskById(taskId: string): Promise<Task | null> {
    try {
      const docRef = doc(db, 'tasks', taskId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          deadline: data.deadline?.toDate(),
          deadline2: data.deadline2?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Task;
      }
      return null;
    } catch (error) {
      console.error('Error getting task:', error);
      throw error;
    }
  },

  // Get all tasks created by VP
  async getTasksByCreator(creatorUid: string): Promise<Task[]> {
    try {
      const q = query(
        collection(db, 'tasks'),
        where('createdBy', '==', creatorUid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deadline: data.deadline?.toDate(),
          deadline2: data.deadline2?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Task;
      });
    } catch (error) {
      console.error('Error getting tasks:', error);
      throw error;
    }
  },

  // Get tasks assigned to teacher
  async getTasksForTeacher(teacherUid: string): Promise<Task[]> {
    try {
      const q = query(
        collection(db, 'tasks'),
        where('assignedTo', 'array-contains', teacherUid),
        orderBy('deadline', 'asc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          deadline: data.deadline?.toDate(),
          deadline2: data.deadline2?.toDate(),
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as Task;
      });
    } catch (error) {
      console.error('Error getting tasks for teacher:', error);
      throw error;
    }
  },

  // Update task
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    try {
      const docRef = doc(db, 'tasks', taskId);
      const updateData: any = { ...updates };

      if (updates.deadline) {
        updateData.deadline = Timestamp.fromDate(updates.deadline);
      }

      updateData.updatedAt = Timestamp.fromDate(new Date());

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  },

  // Delete task
  async deleteTask(taskId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      
      // Also delete related submissions
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('taskId', '==', taskId)
      );
      const submissionsSnap = await getDocs(submissionsQuery);
      
      const deletePromises = submissionsSnap.docs.map((doc) =>
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Submit task report - Upload to Google Drive
  async submitReport(
    taskId: string,
    teacherId: string,
    teacherName: string,
    content: string,
    files: File[]
  ): Promise<string> {
    try {
      // Get task info first to get school year and title
      const task = await this.getTaskById(taskId);
      if (!task) {
        throw new Error('Không tìm thấy công việc');
      }

      // Get school year name
      const schoolYear = await schoolYearService.getSchoolYear(task.schoolYearId);
      if (!schoolYear) {
        throw new Error('Không tìm thấy năm học');
      }

      // Upload files to Google Drive
      const fileUrls: string[] = [];
      const fileNames: string[] = [];

      if (!files || files.length === 0) {
        console.warn('Không có file để upload');
      }

      for (const file of files) {
        try {
          console.log('Uploading file to Google Drive:', {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            schoolYear: schoolYear.name,
            taskTitle: task.title,
          });

          // Sanitize task title and teacher name for folder names
          const sanitizedTaskTitle = removeVietnameseTones(task.title);
          const sanitizedTeacherName = removeVietnameseTones(teacherName);

          // Upload to: Công việc / [Năm học] / [Task name] / submissions / [Teacher name]
          const driveFile = await googleDriveServiceBackend.uploadFile({
            file,
            schoolYear: schoolYear.name,
            category: 'Công việc',
            subCategory: `${sanitizedTaskTitle}/submissions/${sanitizedTeacherName}`,
          });

          // Store the webViewLink as the file URL
          fileUrls.push(driveFile.webViewLink);
          fileNames.push(file.name);

          console.log('File uploaded successfully:', {
            fileName: file.name,
            driveFileId: driveFile.id,
            url: driveFile.webViewLink,
          });
        } catch (uploadError) {
          console.error('Chi tiết lỗi upload file to Google Drive:', uploadError);
          throw new Error(`Lỗi upload file ${file.name}: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      }

      // Auto-calculate score based on submission time vs deadlines
      const submittedAt = new Date(); // Thời điểm nộp hiện tại
      const deadline1 = new Date(task.deadline);
      const deadline2 = task.deadline2 ? new Date(task.deadline2) : null;

      let autoScore: number = 0;
      let metDeadline: 1 | 2 | undefined = undefined;

      // So sánh thời điểm nộp với các deadline
      if (submittedAt <= deadline1) {
        // Nộp đúng deadline 1 - điểm tối đa
        autoScore = task.scoreDeadline1 || task.maxScore;
        metDeadline = 1;
      } else if (deadline2 && submittedAt <= deadline2) {
        // Nộp đúng deadline 2 - điểm thấp hơn
        autoScore = task.scoreDeadline2 || (task.maxScore / 2);
        metDeadline = 2;
      }
      // else: Quá cả 2 deadline - điểm = 0, metDeadline = undefined

      // Create submission document
      const submissionData: any = {
        taskId,
        teacherId,
        teacherName,
        content,
        fileUrls,
        fileNames,
        submittedAt: Timestamp.fromDate(new Date()),
        score: autoScore,
      };

      // Only add metDeadline if it has a value (not undefined)
      if (metDeadline !== undefined) {
        submissionData.metDeadline = metDeadline;
      }

      const docRef = await addDoc(collection(db, 'submissions'), submissionData);

      // Update task status to submitted
      await this.updateTask(taskId, { status: 'submitted' });

      // Notify VP
      await notificationService.notifyTaskSubmitted(
        task.createdBy,
        taskId,
        task.title,
        teacherName
      );

      return docRef.id;
    } catch (error) {
      console.error('Chi tiết lỗi submitting report:', error);
      throw new Error(error instanceof Error ? error.message : 'Không thể nộp báo cáo. Vui lòng thử lại.');
    }
  },

  // Get submission for task and teacher
  async getSubmission(taskId: string, teacherId: string): Promise<Submission | null> {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('taskId', '==', taskId),
        where('teacherId', '==', teacherId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data.submittedAt?.toDate(),
        scoredAt: data.scoredAt?.toDate(),
      } as Submission;
    } catch (error) {
      console.error('Error getting submission:', error);
      throw error;
    }
  },

  // Get all submissions for a task
  async getSubmissionsForTask(taskId: string): Promise<Submission[]> {
    try {
      const q = query(
        collection(db, 'submissions'),
        where('taskId', '==', taskId)
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submittedAt: data.submittedAt?.toDate(),
          scoredAt: data.scoredAt?.toDate(),
        } as Submission;
      });
    } catch (error) {
      console.error('Error getting submissions:', error);
      throw error;
    }
  },

  // Score submission
  async scoreSubmission(
    submissionId: string,
    score: number,
    feedback: string,
    scoredBy: string,
    scoredByName: string,
    taskId: string
  ): Promise<void> {
    try {
      const docRef = doc(db, 'submissions', submissionId);
      await updateDoc(docRef, {
        score,
        feedback,
        scoredBy,
        scoredByName,
        scoredAt: Timestamp.fromDate(new Date()),
      });

      // Update task status to completed
      await this.updateTask(taskId, { status: 'completed' });
    } catch (error) {
      console.error('Error scoring submission:', error);
      throw error;
    }
  },

  // Get all teachers and department heads for assignment
  async getAllTeachers(): Promise<Array<{ uid: string; displayName: string; email: string }>> {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'department_head'])
      );
      const snapshot = await getDocs(q);

      const users = snapshot.docs.map((doc) => ({
        uid: doc.id,
        displayName: doc.data().displayName,
        email: doc.data().email,
      }));

      // Sort by displayName on client side
      return users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (error) {
      console.error('Error getting teachers:', error);
      throw error;
    }
  },
};