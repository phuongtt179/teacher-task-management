# BÁO CÁO PHÂN TÍCH VÀ CẢI TIẾN HỆ THỐNG TEACHER-TASK-MANAGEMENT

**Ngày tạo:** 2025-12-10
**Phiên bản:** 1.0
**Trạng thái:** Pending Implementation

---

## 📊 TỔNG QUAN

Ứng dụng là hệ thống **quản lý công việc và tài liệu cho giáo viên** với 4 user roles:
- Admin (quản trị hệ thống)
- Vice Principal (hiệu trưởng - quản lý công việc)
- Teacher (giáo viên - nhận và làm công việc)
- Department Head (tổ trưởng - teacher + approval permissions)

---

## ⚠️ VẤN ĐỀ NGHIÊM TRỌNG CẦN SỬA NGAY

### 1. ❌ Notification System chưa hoàn chỉnh

**Mô tả:**
- VP chấm điểm → teacher KHÔNG nhận notification
- Deadline sắp đến → teacher KHÔNG nhận reminder
- Code có `notifyTaskScored()` và `notifyDeadline()` nhưng không được gọi

**Files liên quan:**
- `src/services/notificationService.ts`
- `src/services/taskService.ts` line 350-360 (scoreSubmission function)

**Fix:**
```typescript
// Trong taskService.scoreSubmission():
await notificationService.notifyTaskScored(
  submission.teacherId,
  taskId,
  task.title,
  score
);

// Thêm scheduled job cho deadline reminders:
// Cron job check tasks với deadline trong 24h
// Gửi notification cho teachers chưa submit
```

---

### 2. ⚠️ Task Status không sync với thực tế

**Mô tả:**
- Status "overdue" chỉ được tính ở client-side (MyTasksScreen.tsx line 64)
- Không lưu vào database → khi reload page, status mất
- Task status không auto-update khi tất cả teachers submit/được chấm

**Files liên quan:**
- `src/features/teacher/MyTasksScreen.tsx` line 64
- `src/services/taskService.ts`

**Fix:**
```typescript
// 1. Thêm logic trong taskService:
async updateTaskStatus(taskId: string) {
  const task = await this.getTaskById(taskId);
  const submissions = await this.getSubmissionsForTask(taskId);
  const now = new Date();

  // Check overdue
  if (submissions.length === 0 && now > task.deadline) {
    await updateDoc(doc(db, 'tasks', taskId), { status: 'overdue' });
  }

  // Check all submitted
  if (submissions.length === task.assignedTo.length) {
    const allGraded = submissions.every(s => s.score !== undefined);
    await updateDoc(doc(db, 'tasks', taskId), {
      status: allGraded ? 'completed' : 'submitted'
    });
  }
}

// 2. Gọi updateTaskStatus() sau mỗi submission/scoring
```

---

### 3. ⚠️ Department Head role chưa rõ ràng

**Mô tả:**
- Department head dùng chung routes `/teacher/*` với teacher
- Không có UI/dashboard riêng cho department head
- Quyền approve documents có nhưng UI không phân biệt

**Files liên quan:**
- `src/App.tsx` - Routes
- `src/features/teacher/*` - Shared screens

**Fix:**
1. Tạo separate routes cho department_head:
   ```typescript
   <Route path="/department-head/dashboard" />
   <Route path="/department-head/approvals" />
   ```
2. Tạo `DepartmentHeadDashboard.tsx` với:
   - Pending approvals count
   - Department statistics
   - Quick actions

---

### 4. 🔒 Permission checking không consistent

**Mô tả:**
- Admin/VP upload → status = 'approved' (auto)
- Teacher upload → status = 'pending'
- Department head upload → status = 'pending' (không consistent)
- Department head nên có quyền auto-approve documents của tổ

**Files liên quan:**
- `src/features/documents/DocumentUploadScreen.tsx` line 135-137
- `src/services/documentService.ts`

**Fix:**
```typescript
// DocumentUploadScreen.tsx
let status: 'pending' | 'approved' = 'pending';
if (user?.role === 'admin' || user?.role === 'vice_principal') {
  status = 'approved';
} else if (user?.role === 'department_head') {
  // Department head uploads to their own department → auto-approve
  if (selectedSubCategoryId === user.departmentSubCategoryId) {
    status = 'approved';
  }
}
```

---

### 5. 📝 Teacher không thể nộp lại bài

**Mô tả:**
- `getSubmission()` chỉ return submission đầu tiên
- Nếu teacher nộp lại, old submission bị bỏ qua
- Không có submission history

**Files liên quan:**
- `src/services/taskService.ts` line 320-330 (getSubmission)
- `src/features/teacher/SubmitReportScreen.tsx`

**Fix:**
```typescript
// 1. Thêm field vào Submission type:
interface Submission {
  // ... existing fields
  version: number;  // Version của submission
  previousVersionId?: string;  // Link to old version
  isLatest: boolean;  // Flag latest version
}

// 2. Update submitReport():
// - Query existing submission
// - If exists, create new version
// - Set old submission isLatest = false
// - Set new submission version = old.version + 1

// 3. Update UI để show submission history
```

---

## 🎯 CÁC VẤN ĐỀ KHÁC

### 6. Confirmation dialogs thiếu

**Cần thêm confirm cho:**
- Delete task
- Grade submission (affects teacher record)
- Reject document
- Approve file delete request

---

### 7. Error messages quá generic

**Hiện tại:** "Không thể nộp báo cáo"
**Nên:** "Không thể upload file: File quá lớn (max 10MB)"

**Fix:** Validate và return chi tiết error messages

---

### 8. Auto-scoring đã sửa (DONE ✅)

**Vấn đề cũ:** Deadline bị "Invalid Date" khi submit
**Nguyên nhân:** Dùng `taskDoc.data()` thay vì `getTaskById()`
**Đã fix:** Line 197 taskService.ts - dùng `getTaskById()` để convert Timestamp → Date

---

## 📋 ROADMAP ƯU TIÊN

### 🔴 Priority 1 - CRITICAL (1-2 ngày)
- [ ] Implement notification khi VP chấm điểm
- [ ] Implement deadline reminder notification
- [ ] Fix task status tracking (overdue logic)
- [ ] Add confirmation dialogs

### 🟡 Priority 2 - IMPORTANT (1 tuần)
- [ ] Clarify Department Head permissions
- [ ] Support teacher resubmit (với version history)
- [ ] Improve error messages
- [ ] Fix permission auto-approval logic

### 🟢 Priority 3 - ENHANCEMENT (2-4 tuần)
- [ ] Task templates (VP reuse tasks)
- [ ] Deadline extension requests
- [ ] Batch grading operations
- [ ] Advanced analytics (charts, trends)
- [ ] Comment/discussion threads
- [ ] Rubric-based scoring
- [ ] File versioning for documents

---

## 🔧 TECHNICAL DEBT

### Security
- [ ] Verify Firestore rules match app logic
- [ ] Add server-side validation
- [ ] Audit file request approval logic

### Performance
- [ ] Implement server-side search (indexed)
- [ ] Lazy load submissions in statistics
- [ ] Cache frequently accessed data

### Code Quality
- [ ] Extract shared logic to hooks
- [ ] Add unit tests for services
- [ ] Document complex business logic

---

## 📝 NOTES

- Auto-scoring logic đang hoạt động đúng (đã fix 2025-12-10)
- Debug logs đã được xóa (clean console)
- Firebase + Google Drive integration ổn định

---

**Last Updated:** 2025-12-10
**Maintained by:** Development Team
