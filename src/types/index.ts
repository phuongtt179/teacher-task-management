// User roles
export type UserRole = 'admin' | 'principal' | 'vice_principal' | 'teacher' | 'department_head' | 'staff';

// User model
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  isActive?: boolean;
  fcmToken?: string;
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
  semester?: 'HK1' | 'HK2'; // Học kì - optional for backward compatibility
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
  semester?: 'HK1' | 'HK2'; // Học kì - denormalized for analytics performance
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

  // Version tracking fields
  version: number; // Submission version (1, 2, 3, ...)
  previousVersionId?: string; // ID of previous version
  isLatest: boolean; // Flag for latest submission
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
  activeSemester?: 'HK1' | 'HK2'; // Học kỳ đang active do admin thiết lập
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Type (Admin can create custom types)
export interface DocumentType {
  id: string;
  name: string; // "Hồ sơ Ban giám hiệu", "Hồ sơ Giáo viên", "Hồ sơ Nhân viên", "Hồ sơ Tổ chức"
  description?: string;
  icon?: string; // Icon name for UI (optional)

  // View permissions
  viewPermissionType: 'everyone' | 'specific_users'; // Who can view this document type
  allowedViewerUserIds?: string[]; // UIDs of users who can view (required if viewPermissionType = 'specific_users')

  // Upload permissions (must be subset of viewers)
  allowedUploaderUserIds: string[]; // UIDs of users who can upload (must have view permission)

  // View mode - determines how documents are displayed
  viewMode: 'personal' | 'shared';
  // - 'personal': Each user sees only their own files. Elevated roles (dept head/admin) can select users to view
  // - 'shared': All viewers see all files from all uploaders in a flat list

  order: number; // Display order
  isActive: boolean; // Can be disabled without deleting
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Document Category Type (DEPRECATED - keeping for backward compatibility)
export type DocumentCategoryType = 'public' | 'personal';

// View Permissions for Document Categories
export interface ViewPermissions {
  type: 'everyone' | 'specific_departments' | 'specific_users';
  departmentIds?: string[]; // For type = 'specific_departments'
  userIds?: string[]; // For type = 'specific_users'
}

// Document Category model
export interface DocumentCategory {
  id: string;
  schoolYearId: string;
  documentTypeId: string; // Reference to DocumentType (NEW: replaces categoryType)
  name: string; // "Hồ sơ sáng kiến"
  categoryType?: DocumentCategoryType; // DEPRECATED: keeping for backward compatibility
  hasSubCategories: boolean;
  order: number;
  driveFolderId?: string; // Google Drive folder ID
  allowedUploaders?: string[]; // Array of user UIDs who can upload to public categories
  viewPermissions?: ViewPermissions; // Control who can view this category
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

// Document File (for multi-file support)
export interface DocumentFile {
  name: string;
  size: number; // bytes
  mimeType: string;
  driveFileId: string;
  driveFileUrl: string;
}

// Document model (file metadata)
export interface Document {
  id: string;
  schoolYearId: string;
  categoryId: string;
  subCategoryId?: string;
  title: string; // Descriptive title like "Kế hoạch môn học tuần 1"

  // Multi-file support
  files: DocumentFile[];

  // Upload info
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Date;

  // Edit tracking (NEW)
  updatedAt?: Date;
  updatedBy?: string;
  editCount?: number; // Number of times edited

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

// Document History Action Types
export type DocumentHistoryAction =
  | 'file_added'
  | 'file_removed'
  | 'title_changed'
  | 'status_changed'
  | 'document_created'
  | 'document_edited';

// Document History model (for audit trail)
export interface DocumentHistory {
  id: string;
  documentId: string;
  documentTitle: string;
  action: DocumentHistoryAction;
  performedBy: string;
  performedByName: string;
  performedAt: Date;
  details: {
    // For file operations
    addedFiles?: DocumentFile[];
    removedFiles?: DocumentFile[];

    // For title changes
    oldTitle?: string;
    newTitle?: string;

    // For status changes
    oldStatus?: DocumentStatus;
    newStatus?: DocumentStatus;

    // General notes
    note?: string;
  };
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