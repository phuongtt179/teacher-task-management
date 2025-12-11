# 🧪 HƯỚNG DẪN TEST CÁC TÍNH NĂNG MỚI

**Ngày thực hiện:** 2025-12-10
**Version:** Phase 1-6 Implementation

---

## 📋 DANH SÁCH TÍNH NĂNG CẦN TEST

| # | Tính năng | Độ ưu tiên | Thời gian ước tính |
|---|-----------|------------|-------------------|
| 1 | Thông báo khi VP chấm điểm | CAO | 10 phút |
| 2 | Trạng thái công việc tự động | CAO | 15 phút |
| 3 | Thông báo nhắc deadline | CAO | 20 phút |
| 4 | Tổ trưởng tự phê duyệt hồ sơ | TRUNG BÌNH | 10 phút |
| 5 | Nộp lại bài (version history) | TRUNG BÌNH | 15 phút |
| 6 | Dialog xác nhận | THẤP | 10 phút |

**Tổng thời gian:** ~80 phút

---

## ✅ TEST 1: THÔNG BÁO KHI VP CHẤM ĐIỂM

### Mục đích
Kiểm tra giáo viên có nhận được thông báo khi Hiệu trưởng chấm điểm thủ công

### Chuẩn bị
- 1 tài khoản VP (Hiệu trưởng)
- 1 tài khoản Teacher (Giáo viên)
- 1 công việc đã có submission (bài nộp)

### Các bước test

#### Bước 1: Giáo viên nộp bài
1. Login với tài khoản **Teacher**
2. Vào "Công việc của tôi"
3. Chọn 1 công việc
4. Nộp báo cáo (nhập nội dung + file nếu có)
5. **Quan sát:** Có điểm tự động (VD: 10 điểm nếu đúng deadline 1)
6. **Lưu ý:** KHÔNG có thông báo về điểm tự động này

#### Bước 2: VP chấm lại điểm
1. Login với tài khoản **VP**
2. Vào "Công việc" → Chọn task vừa được nộp
3. Xem bài nộp của giáo viên
4. Click "Chấm điểm"
5. Nhập điểm (VD: 9) + feedback (VD: "Tốt, nhưng thiếu chi tiết")
6. Click "Lưu điểm"
7. **Quan sát:** Dialog xác nhận xuất hiện: "Xác nhận chấm điểm 9/10 cho [Tên GV]?"
8. Click "OK"

#### Bước 3: Giáo viên kiểm tra thông báo
1. Quay lại tài khoản **Teacher**
2. Click icon chuông (Thông báo) ở góc phải
3. **Kết quả mong đợi:**
   - ✅ Có thông báo mới: "Bài nộp được chấm điểm"
   - ✅ Nội dung: "Bài nộp [Tên task] đã được [Tên VP] chấm điểm: 9/10"
   - ✅ Click vào thông báo → chuyển đến trang chi tiết task
   - ✅ Xem được điểm mới và feedback

### Lỗi có thể gặp
- ❌ Không có thông báo → Check console log lỗi
- ❌ Thông báo không đúng nội dung → Check notificationService.notifyTaskScored()
- ❌ Click thông báo không chuyển trang → Check notification type và link

### File liên quan
- `src/services/taskService.ts` (dòng 379-394)
- `src/services/notificationService.ts`

---

## ✅ TEST 2: TRẠNG THÁI CÔNG VIỆC TỰ ĐỘNG

### Mục đích
Kiểm tra trạng thái task tự động cập nhật: assigned → submitted → completed → overdue

### Chuẩn bị
- 1 tài khoản VP
- 2 tài khoản Teacher
- Tạo task mới giao cho 2 giáo viên

### Các bước test

#### Test Case 2A: Trạng thái "submitted"
1. Tạo task mới, giao cho Teacher1 và Teacher2
2. **Trạng thái ban đầu:** "assigned" (đã giao)
3. Teacher1 nộp bài
4. Refresh trang VP → **Kết quả mong đợi:** Trạng thái = "submitted"
5. **Kiểm tra database:** Vào Firestore console → collection `tasks` → task vừa tạo → field `status` = "submitted"

#### Test Case 2B: Trạng thái "completed"
1. Teacher2 cũng nộp bài (cả 2 đã nộp)
2. VP chấm điểm cho cả 2 submissions
3. Refresh trang VP → **Kết quả mong đợi:** Trạng thái = "completed"
4. **Kiểm tra database:** field `status` = "completed"

#### Test Case 2C: Trạng thái "overdue"
1. Tạo task mới với deadline đã qua (VD: deadline hôm qua)
2. **KHÔNG** nộp bài
3. Đợi 1 phút (để server tính toán)
4. Refresh trang → **Kết quả mong đợi:** Trạng thái = "overdue"
5. **Kiểm tra database:** field `status` = "overdue"

#### Test Case 2D: Trạng thái không bị sai lệch
1. Logout, đóng trình duyệt
2. Login lại
3. **Kết quả mong đợi:** Trạng thái vẫn đúng (không tính lại sai ở client)

### Lỗi có thể gặp
- ❌ Trạng thái không đổi sau khi nộp bài → Check updateTaskStatus() được gọi chưa
- ❌ Trạng thái sai sau khi reload → Check Firestore có lưu status không
- ❌ Overdue không tự động → Check deadline checker service

### File liên quan
- `src/services/taskService.ts` (dòng 407-439, 296, 400)

---

## ✅ TEST 3: THÔNG BÁO NHẮC DEADLINE

### Mục đích
Kiểm tra hệ thống tự động gửi thông báo nhắc deadline cho giáo viên chưa nộp khi còn < 24 giờ

### Chuẩn bị
- 1 tài khoản Teacher
- Tạo task với deadline trong vòng 23 giờ tới

### Các bước test

#### Test Case 3A: Nhận thông báo deadline
1. Login với tài khoản **VP**
2. Tạo task mới:
   - Tiêu đề: "Test deadline reminder"
   - Deadline 1: Ngày mai lúc 10:00 (< 24 giờ)
   - Giao cho Teacher
3. Login với tài khoản **Teacher**
4. **KHÔNG** nộp bài
5. Đợi 30 phút (deadline checker chạy mỗi 30 phút)
6. **Kết quả mong đợi:**
   - ✅ Có thông báo: "Deadline sắp đến"
   - ✅ Nội dung: "Công việc [Tên task] sắp hết hạn trong [X] giờ"
   - ✅ Click vào → chuyển đến trang nộp bài

#### Test Case 3B: Không nhận thông báo nếu đã nộp
1. Giáo viên nộp bài
2. Đợi thêm 30 phút
3. **Kết quả mong đợi:**
   - ✅ KHÔNG có thông báo mới về deadline
   - ✅ Chỉ những người chưa nộp mới nhận thông báo

#### Test Case 3C: Không nhận thông báo nếu deadline > 24h
1. Tạo task với deadline sau 2 ngày
2. Đợi 30 phút
3. **Kết quả mong đợi:**
   - ✅ KHÔNG có thông báo (vì còn quá xa)

#### Test Case 3D: Deadline checker dừng khi logout
1. Mở console trình duyệt (F12)
2. Logout
3. **Kết quả mong đợi:**
   - ✅ Console log: "Deadline checker stopped" (nếu có log)
   - ✅ Không có lỗi trong console

### Lưu ý quan trọng
⚠️ **Test này cần thời gian chờ đợi!** Deadline checker chạy mỗi 30 phút.

**Cách test nhanh hơn:**
1. Sửa tạm trong `deadlineCheckerService.ts` dòng 22:
   ```typescript
   // Từ: 30 * 60 * 1000 (30 phút)
   // Thành: 1 * 60 * 1000 (1 phút) - CHỈ ĐỂ TEST
   ```
2. Test xong nhớ đổi lại!

### Lỗi có thể gặp
- ❌ Không nhận được thông báo sau 30 phút → Check console log lỗi
- ❌ Nhận thông báo dù đã nộp → Check logic filter submissions
- ❌ Nhận thông báo trùng lặp nhiều lần → Cần thêm logic check đã gửi chưa (TODO future)

### File liên quan
- `src/services/deadlineCheckerService.ts`
- `src/App.tsx` (dòng 66-77)

---

## ✅ TEST 4: TỔ TRƯỞNG TỰ PHÊ DUYỆT HỒ SƠ

### Mục đích
Kiểm tra tổ trưởng upload hồ sơ vào tổ mình → tự động approved

### Chuẩn bị
- 1 tài khoản Department Head (Tổ trưởng) thuộc "Tổ Toán-Lý"
- 1 danh mục hồ sơ có mục con "Tổ Toán-Lý"

### Các bước test

#### Test Case 4A: Upload vào tổ mình → Auto-approved
1. Login với tài khoản **Tổ trưởng Toán-Lý**
2. Vào "Xem hồ sơ"
3. Chọn danh mục "Hồ sơ giáo viên" → Mục con "Tổ Toán-Lý"
4. Click "Tải lên"
5. Chọn file, nhập tên hồ sơ
6. Click "Tải lên"
7. **Kết quả mong đợi:**
   - ✅ Toast hiển thị: "Hồ sơ đã được tải lên" (KHÔNG có "đang chờ phê duyệt")
   - ✅ File xuất hiện ngay trong danh sách
   - ✅ Kiểm tra Firestore: document `status` = "approved"

#### Test Case 4B: Upload vào tổ khác → Pending
1. Vẫn với tài khoản **Tổ trưởng Toán-Lý**
2. Chọn mục con "Tổ Văn-Sử" (tổ khác)
3. Upload file
4. **Kết quả mong đợi:**
   - ✅ Toast: "đang chờ phê duyệt"
   - ✅ File KHÔNG xuất hiện ngay
   - ✅ Kiểm tra Firestore: `status` = "pending"

#### Test Case 4C: Admin/VP vẫn auto-approved ở mọi tổ
1. Login với tài khoản **Admin** hoặc **VP**
2. Upload vào bất kỳ tổ nào
3. **Kết quả mong đợi:**
   - ✅ Tất cả đều auto-approved

### Lỗi có thể gặp
- ❌ Tổ trưởng upload vào tổ mình nhưng vẫn pending → Check logic line 140-150 trong DocumentUploadScreen.tsx
- ❌ Tổ trưởng auto-approve ở tổ khác → Check điều kiện `selectedSubCategoryId === userDepartment.subCategoryId`

### File liên quan
- `src/features/documents/DocumentUploadScreen.tsx` (dòng 140-150)
- `src/features/documents/DocumentBrowseScreen.tsx` (dòng 299-308)

---

## ✅ TEST 5: NỘP LẠI BÀI (VERSION HISTORY)

### Mục đích
Kiểm tra giáo viên có thể nộp lại bài nhiều lần, hệ thống lưu version history

### Chuẩn bị
- 1 tài khoản Teacher
- 1 task đã được giao

### Các bước test

#### Test Case 5A: Nộp lần đầu (Version 1)
1. Login với tài khoản **Teacher**
2. Vào "Công việc của tôi"
3. Chọn task, nộp báo cáo:
   - Nội dung: "Báo cáo lần 1"
   - File: file1.pdf
4. **Kết quả mong đợi:**
   - ✅ Nộp thành công
   - ✅ Kiểm tra Firestore: submission có field `version: 1`, `isLatest: true`

#### Test Case 5B: Nộp lại lần 2 (Version 2)
1. Vào lại task đó, click "Nộp lại" hoặc "Sửa bài nộp"
2. Sửa nội dung:
   - Nội dung: "Báo cáo lần 2 - đã sửa"
   - File: file2.pdf
3. Nộp lại
4. **Kết quả mong đợi:**
   - ✅ Nộp thành công
   - ✅ Hiển thị nội dung mới "Báo cáo lần 2"
   - ✅ Kiểm tra Firestore:
     - Submission cũ: `version: 1`, `isLatest: false`
     - Submission mới: `version: 2`, `isLatest: true`, `previousVersionId: [ID của version 1]`

#### Test Case 5C: VP chỉ thấy version mới nhất
1. Login với tài khoản **VP**
2. Vào task → Xem submissions
3. **Kết quả mong đợi:**
   - ✅ Chỉ hiển thị 1 submission (version 2)
   - ✅ Nội dung: "Báo cáo lần 2 - đã sửa"
   - ✅ KHÔNG hiển thị version 1

#### Test Case 5D: Xem lịch sử versions (TODO - UI chưa có)
_Tính năng backend đã có (`getSubmissionHistory()`), nhưng UI chưa implement._

**Test bằng Firestore console:**
1. Vào Firestore → collection `submissions`
2. Filter `taskId == [taskId]` AND `teacherId == [teacherId]`
3. **Kết quả mong đợi:**
   - ✅ Thấy 2 documents (version 1 và 2)
   - ✅ Version 2 có `isLatest: true`
   - ✅ Version 1 có `isLatest: false`

### Lỗi có thể gặp
- ❌ Không nộp lại được → Check UI có cho phép edit/resubmit không
- ❌ Version 2 ghi đè version 1 → Check logic createSubmission có mark old as not latest không
- ❌ VP thấy cả 2 versions → Check getSubmissionsForTask() có filter `isLatest: true` không

### File liên quan
- `src/services/taskService.ts` (dòng 273-311, 367-393, 398-424)
- `src/types/index.ts` (dòng 68-71)

---

## ✅ TEST 6: DIALOG XÁC NHẬN

### Mục đích
Kiểm tra các hành động quan trọng có dialog xác nhận trước khi thực hiện

### Test Case 6A: Xác nhận khi chấm điểm
1. VP chấm điểm cho submission
2. **Kết quả mong đợi:**
   - ✅ Dialog xuất hiện: "Xác nhận chấm điểm 9/10 cho [Tên GV]?"
   - ✅ Click "Cancel" → Không chấm
   - ✅ Click "OK" → Chấm điểm thành công

### Test Case 6B: Xác nhận phê duyệt hồ sơ
1. Vào "Phê duyệt hồ sơ"
2. Click "Phê duyệt" trên 1 hồ sơ pending
3. **Kết quả mong đợi:**
   - ✅ Dialog: "Xác nhận phê duyệt hồ sơ \"[Tên file]\" của [Tên người upload]?"
   - ✅ Cancel/OK hoạt động đúng

### Test Case 6C: Xác nhận từ chối hồ sơ
1. Click "Từ chối"
2. **Kết quả mong đợi:**
   - ✅ Dialog xác nhận xuất hiện trước
   - ✅ Sau đó mới hỏi "Lý do từ chối"

### File liên quan
- `src/features/vice-principal/TaskDetailScreen.tsx` (dòng 74-77)
- `src/features/documents/DocumentApprovalsScreen.tsx` (dòng 70-73, 89-92)

---

## 📊 BẢNG TỔNG HỢP KẾT QUẢ TEST

| Test | Tính năng | Pass/Fail | Ghi chú |
|------|-----------|-----------|---------|
| 1 | Thông báo chấm điểm | ⬜ | |
| 2A | Trạng thái submitted | ⬜ | |
| 2B | Trạng thái completed | ⬜ | |
| 2C | Trạng thái overdue | ⬜ | |
| 3A | Nhận thông báo deadline | ⬜ | |
| 3B | Không nhận nếu đã nộp | ⬜ | |
| 4A | Tổ trưởng auto-approve | ⬜ | |
| 4B | Tổ trưởng pending tổ khác | ⬜ | |
| 5A | Nộp lần đầu | ⬜ | |
| 5B | Nộp lại version 2 | ⬜ | |
| 5C | VP thấy latest only | ⬜ | |
| 6A | Dialog chấm điểm | ⬜ | |
| 6B | Dialog phê duyệt | ⬜ | |
| 6C | Dialog từ chối | ⬜ | |

**Pass rate:** ___/14 (__%)

---

## 🐛 MẪU BÁO CÁO LỖI

Nếu phát hiện lỗi, ghi theo format:

```
### BUG #[số]

**Tính năng:** [Tên test case]
**Mô tả lỗi:** [Lỗi gì xảy ra]
**Các bước tái hiện:**
1. [Bước 1]
2. [Bước 2]
3. [Kết quả thực tế]

**Kết quả mong đợi:** [...]
**Kết quả thực tế:** [...]
**Console errors:** [Copy lỗi từ console nếu có]
**Screenshots:** [Đính kèm nếu có]
```

---

## 📝 GHI CHÚ BỔ SUNG

### Môi trường test
- [ ] Local: http://localhost:5175
- [ ] Production: https://teacher-task-management-1.onrender.com

### Dữ liệu test
- [ ] Dùng năm học test riêng: "Năm học 2025-2026 (Test)"
- [ ] Dùng email test: teacher.test@example.com
- [ ] Sau khi test xong có thể dùng script `cleanup-test-data.js` để xóa

### Câu hỏi cần giải đáp
- [ ] Có cần thông báo cho điểm tự động khi nộp bài không?
- [ ] Có cần UI hiển thị lịch sử version submissions không?
- [ ] Có cần tránh gửi thông báo deadline trùng lặp không?

---

**Người test:** ___________________
**Ngày test:** ___________________
**Kết luận:**
- [ ] ✅ PASS - Deploy lên production
- [ ] ⚠️ PASS với minor bugs - Deploy nhưng cần fix sau
- [ ] ❌ FAIL - Cần fix bugs trước khi deploy
