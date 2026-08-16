// User roles
// 'super_admin' is reserved for a purely platform-level account with no school (schoolId: null).
// It is NOT used for a school's own admin who additionally manages the platform — that case is
// modeled via the orthogonal `isSuperAdmin` flag below instead (see WhitelistEmail/User).
export type UserRole = 'admin' | 'principal' | 'vice_principal' | 'teacher' | 'department_head' | 'staff' | 'van_thu' | 'super_admin';

// Billing plan (tenant-independent, managed by super-admin via /super-admin/plans —
// numbers live in Firestore, NOT hardcoded, so pricing changes don't need a deploy).
export interface Plan {
  id: string;
  name: string; // "Siêu rẻ", "Cơ bản", "Nâng cao"...
  priceVnd: number; // đồng/tháng
  promoPriceVnd?: number; // giá khuyến mãi những tháng đầu, nếu có
  promoMonths?: number; // số tháng áp dụng promoPriceVnd
  aiMessageLimit: number; // tin nhắn/tháng; -1 = không giới hạn
  storageLimitBytes: number; // -1 = không giới hạn
  isActive: boolean; // ẩn khỏi danh sách chọn khi tạo/sửa trường mới, không xóa gói đang có trường dùng
  createdAt: Date;
  updatedAt: Date;
}

// School (tenant) model
export interface School {
  id: string;
  name: string;
  shortName?: string;
  isActive: boolean; // "ngắt/mở" — false blocks all data access for this school, not just cosmetic
  driveRootFolderId: string; // Root Google Drive folder for this school's files
  planId: string | null; // references plans/{id}; null = chưa gán gói (chưa tính hạn mức)
  storageUsedBytes: number; // running total, updated on every upload/delete
  extraStorageBytes: number; // dung lượng mua thêm ngoài gói (không phải đổi gói) — cộng dồn vào storageLimitBytes của plan
  createdBy: string; // super_admin uid
  createdAt: Date;
  updatedAt: Date;
}

// Monthly AI chat usage counter — one doc per school per calendar month
// (doc id: `${schoolId}_${yyyy-MM}`), so counts reset naturally with no cron job.
export interface UsageStat {
  id: string;
  schoolId: string;
  month: string; // yyyy-MM
  aiMessageCount: number;
}

// User model
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  schoolId: string | null; // null only for a pure role:'super_admin' account
  isSuperAdmin?: boolean; // orthogonal platform-admin capability, independent of `role`
  phoneNumber?: string; // Số điện thoại liên hệ (tùy chọn)
  createdAt: Date;
  updatedAt: Date;
  isActive?: boolean;
  fcmToken?: string;
}

// Whitelist model
export interface WhitelistEmail {
  id: string; // MUST equal `email` (doc ID convention enforced by firestore.rules)
  email: string;
  schoolId: string; // Which school this whitelist entry grants access to
  role: UserRole; // Role assigned to the user when their account is first created
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
  schoolId: string;
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
  schoolId: string;
  taskId: string;
  schoolYearId?: string; // Năm học - denormalized for analytics performance
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
// ==================== TASK UPDATES (báo tiến độ / vướng mắc / xin gia hạn) ====================

// Loại cập nhật giữa chừng của công việc do giáo viên gửi
// - help_request: đề xuất BGH bổ sung thêm người vào việc (giáo viên không tự thêm được)
export type TaskUpdateType = 'progress' | 'blocker' | 'extension' | 'help_request';

// Trạng thái xử lý của BGH:
// - open: mới gửi, chờ BGH xem/xử lý (blocker) hoặc duyệt (extension); progress mặc định open (chỉ để thông tin)
// - resolved: BGH đã xử lý xong vướng mắc
// - approved / rejected: kết quả duyệt xin gia hạn
export type TaskUpdateStatus = 'open' | 'resolved' | 'approved' | 'rejected';

// Một cập nhật giữa chừng gắn với 1 công việc + 1 giáo viên
export interface TaskUpdate {
  id: string;
  schoolId: string;
  taskId: string;
  taskTitle: string;
  teacherId: string;
  teacherName: string;
  type: TaskUpdateType;
  note: string; // Lý do vướng mắc / ghi chú tiến độ / lý do xin gia hạn
  percent?: number; // Chỉ với type='progress' (0-100)
  requestedDeadline?: Date; // Chỉ với type='extension' — hạn mới mong muốn
  currentDeadline?: Date; // Ảnh chụp hạn hiện tại lúc xin gia hạn (để BGH đối chiếu)
  approvedDeadline?: Date; // Hạn thực tế BGH duyệt (có thể khác requested)
  status: TaskUpdateStatus;
  createdAt: Date;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Date;
  reviewNote?: string; // Phản hồi của BGH khi xử lý
}

// Notification type
export type NotificationType =
  | 'task_assigned'
  | 'task_deadline'
  | 'task_scored'
  | 'task_submitted'
  | 'task_blocker'
  | 'task_progress'
  | 'task_help_request'
  | 'task_extension_request'
  | 'task_extension_approved'
  | 'task_extension_rejected'
  | 'document_uploaded'
  | 'document_approved'
  | 'document_rejected'
  | 'file_request_created'
  | 'file_request_approved'
  | 'file_request_rejected';

// Notification model
export interface Notification {
  id: string;
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
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
  schoolId: string;
  departmentId: string;
  categoryId: string;
  subCategoryId?: string;
  canView: boolean;
  canUpload: boolean;
  createdAt: Date;
}