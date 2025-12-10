// User roles
export type UserRole = 'admin' | 'vice_principal' | 'teacher' | 'department_head';

// User model
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Whitelist model
export interface WhitelistEmail {
  id: string;
  email: string;
  addedBy: string;
  addedAt: Date;
}

// Task status
export type TaskStatus = 'assigned' | 'in_progress' | 'submitted' | 'completed' | 'overdue';

// Task priority
export type TaskPriority = 'low' | 'medium' | 'high';

// Task model
export interface Task {
  id: string;
  schoolYearId: string; // Năm học
  title: string;
  description: string;
  descriptionPdfUrl?: string; // URL của file PDF mô tả (Google Drive)
  priority: TaskPriority;
  status: TaskStatus;
  maxScore: number; // Điểm tối đa (backward compatibility)
  scoreDeadline1?: number; // Điểm cho deadline 1 (mặc định 10)
  scoreDeadline2?: number; // Điểm cho deadline 2 (mặc định 5)
  deadline: Date; // Deadline 1
  deadline2?: Date; // Deadline 2 - optional for backward compatibility
  createdBy: string; // VP uid
  createdByName: string; // VP name
  assignedTo: string[]; // Array of teacher uids
  assignedToNames: string[]; // Array of teacher names
  createdAt: Date;
  updatedAt: Date;
}

// Submission model
export interface Submission {
  id: string;
  taskId: string;
  teacherId: string;
  teacherName: string;
  content: string; // Nội dung báo cáo
  fileUrls: string[]; // URLs of uploaded files
  fileNames?: string[]; // Names of uploaded files
  submittedAt: Date;
  metDeadline?: 1 | 2; // Which deadline was met (1 or 2)
  score?: number; // Điểm được chấm (0-maxScore)
  scoredBy?: string; // VP uid
  scoredByName?: string; // VP name
  scoredAt?: Date;
  feedback?: string; // Nhận xét từ VP
}
// Notification type
export type NotificationType =
  | 'task_assigned'
  | 'task_deadline'
  | 'task_scored'
  | 'task_submitted'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'file_request_created'
  | 'file_request_approved'
  | 'file_request_rejected';

// Notification model
export interface Notification {
  id: string;
  userId: string; // Recipient
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    taskId?: string;
    taskTitle?: string;
    score?: number;
    submissionId?: string;
    documentId?: string;
    fileName?: string;
    requestId?: string;
  };
  read: boolean;
  createdAt: Date;
}

// ==================== DOCUMENT MANAGEMENT ====================

// School Year model
export interface SchoolYear {
  id: string;
  name: string; // "Năm học 2024-2025"
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Category Type
export type DocumentCategoryType = 'public' | 'personal';

// Document Category model
export interface DocumentCategory {
  id: string;
  schoolYearId: string;
  name: string; // "Hồ sơ sáng kiến"
  categoryType: DocumentCategoryType; // 'public' = admin/VP upload, all view | 'personal' = individual upload, hierarchical view
  hasSubCategories: boolean;
  order: number;
  driveFolderId?: string; // Google Drive folder ID
  allowedUploaders?: string[]; // Array of user UIDs who can upload to public categories
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Sub-Category model
export interface DocumentSubCategory {
  id: string;
  categoryId: string;
  name: string; // "Tổ 1 - Toán Lý"
  order: number;
  driveFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Department (Tổ chuyên môn) model
export interface Department {
  id: string;
  name: string; // "Tổ 1 - Toán Lý"
  headTeacherId?: string; // Tổ trưởng
  headTeacherName?: string;
  memberIds: string[]; // Giáo viên trong tổ
  subCategoryId?: string; // Link to DocumentSubCategory
  createdAt: Date;
  updatedAt: Date;
}

// Document status
export type DocumentStatus = 'pending' | 'approved' | 'rejected';

// Document model (file metadata)
export interface Document {
  id: string;
  schoolYearId: string;
  categoryId: string;
  subCategoryId?: string;
  title: string; // Descriptive title like "Kế hoạch môn học tuần 1"

  // File info
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  driveFileId?: string; // Google Drive file ID
  driveFileUrl?: string;
  thumbnailUrl?: string;

  // Upload info
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;

  // Approval
  status: DocumentStatus;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Date;
  rejectionReason?: string;

  // Access control
  departmentId?: string;
  isPublic: boolean; // true = all can view, false = only department
}

// File Request Type
export type FileRequestType = 'delete' | 'edit';
export type FileRequestStatus = 'pending' | 'approved' | 'rejected';

// File Request model (for delete/edit requests)
export interface FileRequest {
  id: string;
  documentId: string;
  documentName: string;
  requestType: FileRequestType;
  requestedBy: string;
  requestedByName: string;
  requestedAt: Date;
  reason: string;

  // Status
  status: FileRequestStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Date;
  reviewNote?: string;

  // For edit requests
  newFileName?: string;
  newFileId?: string;
  newFileUrl?: string;
}

// Permission model
export interface DocumentPermission {
  id: string;
  departmentId: string;
  categoryId: string;
  subCategoryId?: string;
  canView: boolean;
  canUpload: boolean;
  createdAt: Date;
}