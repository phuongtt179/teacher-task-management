# 🎯 KỊCH BẢN TEST ỨNG DỤNG - TEACHER TASK MANAGEMENT

**Ngày test:** [Điền ngày]
**Thời gian:** 1-2 giờ
**Số người:** 10 giáo viên + 1 Admin

---

## 📝 DANH SÁCH THAM GIA

### **Ghi tên và email của 10 người:**

| STT | Họ tên | Email | Vai trò | Tổ |
|-----|--------|-------|---------|-----|
| 1 | [Tên bạn] | [Email bạn] | Admin | - |
| 2 | __________ | ________________@gmail.com | Vice Principal | - |
| 3 | __________ | ________________@gmail.com | Department Head | Tổ 1 |
| 4 | __________ | ________________@gmail.com | Department Head | Tổ 2 |
| 5 | __________ | ________________@gmail.com | Teacher | Tổ 1 |
| 6 | __________ | ________________@gmail.com | Teacher | Tổ 1 |
| 7 | __________ | ________________@gmail.com | Teacher | Tổ 1 |
| 8 | __________ | ________________@gmail.com | Teacher | Tổ 2 |
| 9 | __________ | ________________@gmail.com | Teacher | Tổ 2 |
| 10 | __________ | ________________@gmail.com | Teacher | Tổ 2 |
| 11 | __________ | ________________@gmail.com | Teacher | Tổ 2 |

---

## ⚙️ CHUẨN BỊ TRƯỚC (30 phút trước test)

### **Bước 1: Setup dữ liệu cơ bản (Admin)**

**URL ứng dụng:** https://teacher-task-management-1.onrender.com

#### **A. Tạo Năm học:**

1. Đăng nhập với tài khoản Admin
2. Vào **"Hồ sơ điện tử"** → **"Cấu hình"**
3. Click **"Thêm năm học"**
   - Tên: `Năm học 2024-2025`
   - Ngày bắt đầu: `01/09/2024`
   - Ngày kết thúc: `31/05/2025`
   - ✅ Đánh dấu "Năm học hiện tại"
4. Click **"Tạo năm học"**

#### **B. Tạo Tổ chuyên môn:**

1. Vẫn ở **"Cấu hình"**
2. Tab **"Tổ chuyên môn"**
3. Click **"Thêm tổ"**

**Tổ 1:**
```
Tên tổ: Tổ Toán - Lý
Tổ trưởng: [Chọn Giáo viên B]
```

**Tổ 2:**
```
Tên tổ: Tổ Văn - Sử
Tổ trưởng: [Chọn Giáo viên C]
```

#### **C. Tạo Danh mục tài liệu:**

1. Tab **"Danh mục"**
2. Click **"Thêm danh mục"**

**Danh mục 1:**
```
Năm học: Năm học 2024-2025
Tên: Kế hoạch giảng dạy
Loại: Cá nhân (Personal)
✅ Có mục con
```
→ Thêm mục con:
- `Tổ Toán - Lý`
- `Tổ Văn - Sử`

**Danh mục 2:**
```
Năm học: Năm học 2024-2025
Tên: Tài liệu chung
Loại: Công khai (Public)
❌ Không có mục con
```

#### **D. Thêm tất cả email vào Whitelist:**

1. Vào **"Quản lý người dùng"** → **"Whitelist"**
2. Click **"Thêm email"**
3. Thêm 10 email của giáo viên (từ bảng trên)
4. Gán role:
   - Email 2 → Role: **Vice Principal**
   - Email 3, 4 → Role: **Department Head**
   - Email 5-11 → Role: **Teacher**

---

## 🚀 BẮT ĐẦU TEST (Thời gian chính)

### **⏰ TIMELINE:**

```
0:00 - 0:10   Setup & Đăng nhập
0:10 - 0:30   Test công việc (Tasks)
0:30 - 0:50   Test tài liệu (Documents)
0:50 - 1:10   Test thống kê & Rankings
1:10 - 1:20   Test edge cases
1:20 - 1:30   Q&A & Feedback
```

---

## 🧪 TEST CASE 1: ĐĂNG NHẬP (10 phút)

### **Mục tiêu:**
- ✅ 10 người đăng nhập thành công
- ✅ Kiểm tra role hiển thị đúng

### **Các bước:**

**1. Tất cả 10 người mở link:**
```
https://teacher-task-management-1.onrender.com
```

**2. Click "Đăng nhập với Google"**

**3. Chọn tài khoản Google đã được thêm vào whitelist**

**4. Kiểm tra:**

| Vai trò | Dashboard hiển thị |
|---------|-------------------|
| Admin | "Quản lý người dùng", "Whitelist" |
| Vice Principal | "Tạo công việc", "Danh sách công việc", "Thống kê" |
| Department Head | "Công việc của tôi", "Phê duyệt tài liệu" |
| Teacher | "Công việc của tôi", "Điểm của tôi" |

### **✅ Checklist:**
- [ ] Tất cả đăng nhập được
- [ ] Role hiển thị đúng
- [ ] Dashboard đúng với từng role
- [ ] Avatar, tên hiển thị đúng

### **❌ Lỗi thường gặp:**
- Lỗi "Email not in whitelist" → Admin thêm email vào whitelist
- Lỗi "Firebase error" → Kiểm tra authorized domain
- Loading lâu (>30s) → Backend đang wake up (bình thường)

---

## 🧪 TEST CASE 2: TẠO VÀ GIAO CÔNG VIỆC (20 phút)

### **Người thực hiện:** Vice Principal (Giáo viên A)

### **Test 2A: Tạo công việc đơn giản**

**1. VP click "Tạo công việc"**

**2. Điền thông tin:**
```
Năm học: Năm học 2024-2025
Tiêu đề: Nộp Kế hoạch giảng dạy tuần 1
Mô tả:
  - Nộp kế hoạch chi tiết cho tuần 1
  - Bao gồm mục tiêu, nội dung, phương pháp

Độ ưu tiên: Cao

Deadline 1: [Ngày mai]
Điểm deadline 1: 10

Deadline 2: [3 ngày sau]
Điểm deadline 2: 5

Điểm tối đa: 10

Giao cho:
  ✅ [Chọn 5 giáo viên: D, E, F, G, H]
```

**3. Click "Tạo công việc"**

### **✅ Checklist:**
- [ ] Công việc được tạo thành công
- [ ] Toast notification hiển thị "Đã tạo công việc"
- [ ] Công việc xuất hiện trong "Danh sách công việc"

---

### **Test 2B: Kiểm tra giáo viên nhận công việc**

**Người thực hiện:** 5 giáo viên (D, E, F, G, H)

**1. Giáo viên vào "Công việc của tôi"**

**2. Kiểm tra:**
- [ ] Công việc "Nộp Kế hoạch..." hiển thị
- [ ] Trạng thái: "Đã giao"
- [ ] Deadline hiển thị đúng
- [ ] Badge ưu tiên: "Cao" (màu đỏ)

**3. Click vào công việc để xem chi tiết**

**4. Kiểm tra:**
- [ ] Mô tả đầy đủ
- [ ] Hiển thị 2 deadlines
- [ ] Hiển thị điểm tương ứng
- [ ] Button "Nộp báo cáo" hiển thị

---

### **Test 2C: Tạo công việc với file PDF**

**Người thực hiện:** Vice Principal (Giáo viên A)

**1. VP click "Tạo công việc"**

**2. Điền thông tin + Upload PDF:**
```
Tiêu đề: Viết báo cáo tổng kết tháng 12
Mô tả: Xem file đính kèm để biết yêu cầu chi tiết

[Upload file PDF mô tả]

Giao cho:
  ✅ [Chọn tất cả 7 giáo viên còn lại]
```

**3. Click "Tạo công việc"**

### **✅ Checklist:**
- [ ] File PDF được upload thành công
- [ ] Giáo viên xem được file PDF khi click vào công việc

---

## 🧪 TEST CASE 3: NỘP BÁO CÁO (20 phút)

### **Test 3A: Nộp trước deadline 1**

**Người thực hiện:** Giáo viên D, E

**1. Vào "Công việc của tôi"**

**2. Click vào công việc "Nộp Kế hoạch..."**

**3. Click "Nộp báo cáo"**

**4. Điền thông tin:**
```
Nội dung báo cáo:
  Tôi đã hoàn thành kế hoạch giảng dạy tuần 1.
  Bao gồm:
  - Mục tiêu bài học
  - Nội dung chi tiết
  - Phương pháp giảng dạy
  - Đánh giá học sinh

[Upload file Word/PDF]
```

**5. Click "Nộp báo cáo"**

### **✅ Checklist:**
- [ ] Toast "Nộp báo cáo thành công"
- [ ] Trạng thái công việc → "Đã nộp"
- [ ] Hiển thị điểm tự động: 10 điểm
- [ ] Hiển thị "✅ Đã chấm điểm"
- [ ] File được upload lên Google Drive

---

### **Test 3B: Nộp sau deadline 1, trước deadline 2**

**Để sau 5 phút, rồi:**

**Người thực hiện:** Giáo viên F

**Làm tương tự Test 3A**

### **✅ Checklist (kỳ vọng):**
- [ ] Điểm tự động: 5 điểm (vì quá deadline 1)
- [ ] metDeadline = 2

---

### **Test 3C: Không nộp (để quá hạn)**

**Người thực hiện:** Giáo viên G, H (KHÔNG NỘP)

### **✅ Checklist:**
- [ ] Sau khi quá deadline 2, trạng thái → "Quá hạn"
- [ ] Badge màu đỏ hiển thị

---

## 🧪 TEST CASE 4: CHẤM ĐIỂM (10 phút)

### **Người thực hiện:** Vice Principal (Giáo viên A)

**1. VP vào "Danh sách công việc"**

**2. Click vào công việc "Nộp Kế hoạch..."**

**3. Kiểm tra danh sách bài nộp:**

| Giáo viên | Trạng thái | Điểm tự động |
|-----------|------------|--------------|
| Giáo viên D | Đã nộp | 10 |
| Giáo viên E | Đã nộp | 10 |
| Giáo viên F | Đã nộp | 5 |
| Giáo viên G | Chưa nộp | 0 |
| Giáo viên H | Chưa nộp | 0 |

**4. VP chấm lại điểm cho Giáo viên D:**
```
Giáo viên D:
  Điểm: 9 (sửa từ 10 → 9)
  Nhận xét: "Kế hoạch tốt, nhưng thiếu phần đánh giá"

Click "Lưu"
```

**5. VP chấm điểm cho Giáo viên G (nộp muộn):**
```
Giáo viên G:
  Điểm: 3 (vì nộp quá deadline)
  Nhận xét: "Nộp muộn"

Click "Lưu"
```

### **✅ Checklist:**
- [ ] Điểm được cập nhật thành công
- [ ] Giáo viên nhận được notification "Bài đã được chấm"
- [ ] Điểm hiển thị trong "Điểm của tôi"

---

## 🧪 TEST CASE 5: UPLOAD TÀI LIỆU (20 phút)

### **Test 5A: Teacher upload tài liệu**

**Người thực hiện:** Giáo viên D (Tổ Toán-Lý)

**1. Vào "Hồ sơ điện tử" → "Upload hồ sơ"**

**2. Điền thông tin:**
```
Năm học: Năm học 2024-2025
Danh mục: Kế hoạch giảng dạy
Mục con: Tổ Toán - Lý
Tên hồ sơ: Kế hoạch bài dạy Toán lớp 10
File: [Upload file Word/PDF]
```

**3. Click "Tải lên"**

### **✅ Checklist:**
- [ ] Toast "Hồ sơ đã được tải lên"
- [ ] Trạng thái: "Chờ phê duyệt"
- [ ] File được upload lên Google Drive

---

### **Test 5B: Department Head phê duyệt tài liệu**

**Người thực hiện:** Giáo viên B (Tổ trưởng Toán-Lý)

**1. Vào "Hồ sơ điện tử" → "Phê duyệt hồ sơ"**

**2. Kiểm tra danh sách:**
- [ ] Tài liệu của Giáo viên D hiển thị
- [ ] Trạng thái: "Chờ phê duyệt"

**3. Click vào tài liệu**

**4. Chọn:**
- Option A: **Phê duyệt** → Click "Phê duyệt"
- Option B: **Từ chối** → Nhập lý do → Click "Từ chối"

### **✅ Checklist (nếu Approve):**
- [ ] Trạng thái → "Đã phê duyệt"
- [ ] Giáo viên D nhận notification
- [ ] Tài liệu hiển thị trong "Xem hồ sơ" của tổ

### **✅ Checklist (nếu Reject):**
- [ ] Trạng thái → "Bị từ chối"
- [ ] Giáo viên D nhận notification + lý do
- [ ] Tài liệu không hiển thị public

---

### **Test 5C: VP upload tài liệu công khai**

**Người thực hiện:** Vice Principal (Giáo viên A)

**1. Vào "Hồ sơ điện tử" → "Upload hồ sơ"**

**2. Điền thông tin:**
```
Năm học: Năm học 2024-2025
Danh mục: Tài liệu chung
Tên hồ sơ: Quy chế đánh giá giáo viên
File: [Upload PDF]
```

**3. Click "Tải lên"**

### **✅ Checklist:**
- [ ] Trạng thái: "Đã phê duyệt" (tự động)
- [ ] Tất cả giáo viên xem được

---

## 🧪 TEST CASE 6: THỐNG KÊ & RANKINGS (20 phút)

### **Test 6A: VP xem thống kê**

**Người thực hiện:** Vice Principal (Giáo viên A)

**1. Vào "Thống kê"**

**2. Tab "Theo công việc":**

**Kiểm tra:**
- [ ] Hiển thị danh sách công việc
- [ ] Số lượng giáo viên được giao
- [ ] Tỷ lệ hoàn thành
- [ ] Điểm trung bình

**3. Click vào công việc "Nộp Kế hoạch..."**

**Kiểm tra chi tiết:**
- [ ] Danh sách 5 giáo viên
- [ ] Thời gian nộp
- [ ] Điểm số
- [ ] Trạng thái (Đã nộp/Chưa nộp)

**4. Tab "Theo giáo viên":**

**Kiểm tra:**
- [ ] Danh sách tất cả giáo viên
- [ ] Tổng số công việc được giao
- [ ] Số công việc hoàn thành
- [ ] Tỷ lệ hoàn thành
- [ ] Điểm trung bình

**5. Click vào Giáo viên D:**

**Kiểm tra chi tiết:**
- [ ] Danh sách công việc của giáo viên
- [ ] Điểm từng công việc
- [ ] Biểu đồ điểm

---

### **Test 6B: Teacher xem điểm của mình**

**Người thực hiện:** Giáo viên D

**1. Vào "Điểm của tôi"**

**Kiểm tra:**
- [ ] Hiển thị danh sách công việc đã làm
- [ ] Điểm từng công việc
- [ ] Nhận xét từ VP
- [ ] Ngày chấm điểm

---

### **Test 6C: Xem Bảng xếp hạng**

**Người thực hiện:** Tất cả

**1. Vào "Bảng xếp hạng"**

**Kiểm tra:**
- [ ] Danh sách giáo viên xếp theo tổng điểm
- [ ] Top 3 có crown icon
- [ ] Hiển thị: Tổng điểm, Điểm TB, % Hoàn thành
- [ ] Có thể filter theo thời gian

---

## 🧪 TEST CASE 7: EDGE CASES (10 phút)

### **Test 7A: Teacher nộp lại bài**

**Người thực hiện:** Giáo viên E

**1. Vào công việc đã nộp**

**2. Thử click "Nộp báo cáo" lần nữa**

### **✅ Kỳ vọng:**
- [ ] Không cho nộp lại
- [ ] Hiển thị "Đã nộp" với thời gian nộp

---

### **Test 7B: VP xóa công việc có bài nộp**

**Người thực hiện:** Vice Principal

**1. Vào "Danh sách công việc"**

**2. Click xóa công việc "Nộp Kế hoạch..."**

### **✅ Kỳ vọng:**
- [ ] Hiển thị confirm dialog
- [ ] Sau khi xóa: Công việc và tất cả submissions bị xóa

---

### **Test 7C: Department Head xem tài liệu của tổ khác**

**Người thực hiện:** Giáo viên B (Tổ trưởng Toán-Lý)

**1. Vào "Xem hồ sơ"**

**2. Chọn "Tổ Văn - Sử"**

### **✅ Kỳ vọng:**
- [ ] KHÔNG xem được tài liệu của tổ khác
- [ ] Chỉ xem được tài liệu công khai

---

### **Test 7D: Teacher request delete document**

**Người thực hiện:** Giáo viên D

**1. Vào "Hồ sơ của tôi" → "Yêu cầu xóa/sửa"**

**2. Tìm tài liệu đã upload**

**3. Click "Yêu cầu xóa"**

**4. Nhập lý do: "Đã upload nhầm file"**

**5. Submit**

### **✅ Checklist:**
- [ ] Request được tạo
- [ ] Trạng thái: "Chờ phê duyệt"
- [ ] Department Head nhận được notification

**6. Department Head phê duyệt:**

**Giáo viên B vào "Phê duyệt yêu cầu"**

- [ ] Request hiển thị
- [ ] Approve hoặc Reject
- [ ] Nếu approve: File bị xóa khỏi Google Drive

---

## 🧪 TEST CASE 8: PERFORMANCE TEST (10 phút)

### **Test 8A: Đăng nhập đồng thời**

**1. Tất cả 10 người logout**

**2. Cùng lúc, tất cả click "Đăng nhập"**

### **✅ Đo thời gian:**
- [ ] Người đầu tiên đăng nhập: ____ giây
- [ ] Người cuối cùng đăng nhập: ____ giây
- [ ] Có ai bị timeout không?

---

### **Test 8B: Load trang "Công việc của tôi"**

**Người thực hiện:** Tất cả

**1. Cùng lúc, tất cả refresh trang "Công việc của tôi"**

### **✅ Đo thời gian:**
- [ ] Thời gian load trung bình: ____ giây
- [ ] Có ai bị lỗi không?

---

## 📊 KẾT QUẢ TEST

### **Tổng hợp bugs/issues tìm thấy:**

| STT | Mô tả lỗi | Severity | Người phát hiện |
|-----|-----------|----------|-----------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

### **Feedback từ giáo viên:**

| STT | Feedback | Người góp ý |
|-----|----------|-------------|
| 1 | | |
| 2 | | |
| 3 | | |

### **Performance metrics:**

| Metric | Kết quả |
|--------|---------|
| Thời gian đăng nhập (lần đầu) | ____ giây |
| Thời gian đăng nhập (lần sau) | ____ giây |
| Thời gian load trang | ____ giây |
| Số lỗi gặp phải | ____ lỗi |
| Tỷ lệ thành công | ___% |

---

## ✅ CHECKLIST TỔNG QUAN

### **Core Features:**
- [ ] Login/Logout
- [ ] Create task (VP)
- [ ] Assign task to teachers
- [ ] Submit report (Teacher)
- [ ] Auto-scoring
- [ ] Manual scoring (VP)
- [ ] Upload document
- [ ] Approve document (Department Head)
- [ ] View statistics (VP)
- [ ] View scores (Teacher)
- [ ] Rankings

### **Permissions:**
- [ ] Admin có tất cả quyền
- [ ] VP tạo và chấm công việc
- [ ] Department Head phê duyệt tài liệu của tổ
- [ ] Teacher chỉ xem công việc của mình

### **UI/UX:**
- [ ] Giao diện responsive
- [ ] Thông báo toast hiển thị đúng
- [ ] Loading indicators
- [ ] Error messages rõ ràng

### **Performance:**
- [ ] App load nhanh (<3s)
- [ ] Upload file nhanh (<10s)
- [ ] Không bị lag khi nhiều người dùng

---

## 🎯 HÀNH ĐỘNG SAU TEST

### **Nếu test thành công (>90% features work):**
```
✅ Triển khai cho toàn trường
✅ Training giáo viên
✅ Monitor trong 1 tuần
```

### **Nếu có bugs (5-10 bugs):**
```
⚠️ Fix bugs trước
⚠️ Test lại với nhóm nhỏ
⚠️ Sau đó triển khai
```

### **Nếu có nhiều bugs (>10 bugs):**
```
❌ Delay deployment
❌ Fix tất cả bugs critical
❌ Test lại từ đầu
```

---

## 📝 NOTES

**Ghi chú trong quá trình test:**
```
[Ghi chú của bạn ở đây]
```

---

**Người test:** [Tên bạn]
**Ngày hoàn thành:** ____________
**Kết quả:** ✅ PASS / ❌ FAIL / ⚠️ CONDITIONAL PASS
