# 📁 CẤU TRÚC THỨ MỤC GOOGLE DRIVE - HỆ THỐNG QUẢN LÝ CÔNG VIỆC GIÁO VIÊN

## 📌 Tổng quan

Hệ thống sử dụng Google Drive để lưu trữ tất cả file, với cấu trúc thư mục được tổ chức rõ ràng theo từng tính năng.

**Root Folder:** Được cấu hình trong biến môi trường `VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID`

---

## 1️⃣ HỒ SƠ ĐIỆN TỬ (Document Management) - CẤU TRÚC MỚI ⭐

**Điều kiện:** Khi upload từ màn hình "Hồ sơ điện tử" với nhiều file

### Cấu trúc:
```
[Root Folder]/
└── [Năm học]/
    └── [Tên danh mục]/
        └── [Tên danh mục con (nếu có)]/
            └── [Tên người upload]/
                └── [Tiêu đề document]/
                    ├── file1.pdf
                    ├── file2.docx
                    └── file3.xlsx
```

### Ví dụ thực tế:
```
Hồ sơ giáo viên/ (ROOT)
└── test 2025-2026/                    ← Năm học
    ├── Kế hoạch bài dạy/              ← Danh mục lớn
    │   ├── Kế hoạch giáo dục/         ← Danh mục con
    │   │   └── Nguyễn Văn A/          ← Tên giáo viên
    │   │       └── Tuần 10/           ← Tiêu đề document
    │   │           ├── Giáo án Toán.pdf
    │   │           ├── Bài tập.docx
    │   │           └── Đáp án.xlsx
    │   └── Kế hoạch cá nhân/          ← Danh mục con
    │       └── Trần Thị B/
    │           └── Tuần 10/
    │               ├── Giáo án Văn.pdf
    │               └── Tài liệu tham khảo.pdf
    └── Hồ sơ chuyên môn/              ← Danh mục lớn (không có subcategory)
        └── Lê Văn C/
            └── Chứng chỉ/
                ├── Chứng chỉ A.pdf
                └── Chứng chỉ B.pdf
```

### Code location:
- Frontend: [DocumentBrowseScreen.tsx:336-348](src/features/documents/DocumentBrowseScreen.tsx#L336-L348)
- Backend: [server/index.js:220-233](server/index.js#L220-L233)

### Tham số:
- `schoolYear`: "test 2025-2026" (từ school year đang chọn)
- `category`: Tên danh mục lớn (vd: "Kế hoạch bài dạy")
- `subCategory`: Tên danh mục con (vd: "Kế hoạch giáo dục") - optional
- `uploaderName`: Tên người upload (từ `user.displayName`)
- `documentTitle`: Tiêu đề document (người dùng nhập)

---

## 2️⃣ HỒ SƠ ĐIỆN TỬ - CẤU TRÚC CŨ (Backward Compatibility)

**Điều kiện:** Khi upload KHÔNG có `uploaderName` hoặc `documentTitle`

### Cấu trúc:
```
[Root Folder]/
└── [Năm học]/
    └── [Danh mục]/
        └── [Danh mục con (nếu có)]/
            └── file.pdf
```

### Ví dụ:
```
My Drive/
└── Năm học 2024-2025/
    └── Hồ sơ sáng kiến/
        └── Tổ 1 - Toán Lý/
            └── document.pdf
```

### Code location:
- Backend: [server/index.js:227-237](server/index.js#L227-L237)

---

## 3️⃣ BÀI NỘP CÔNG VIỆC (Task Submissions)

**Chức năng:** Giáo viên nộp bài cho công việc được giao

### Cấu trúc:
```
[Root Folder]/
└── [Năm học]/
    └── Công việc/
        └── [Tên công việc]/
            └── submissions/
                └── [Tên giáo viên]/
                    ├── file1.pdf
                    ├── file2.docx
                    └── ...
```

### Ví dụ thực tế:
```
Hồ sơ giáo viên/ (ROOT)
└── 2025-2026/
    └── Công việc/
        └── kiem_tra_cham_diem_tu_dong/  ← (đã bỏ dấu)
            └── submissions/
                └── Bui_Quynh_Hai_Ly/  ← (đã bỏ dấu)
                    ├── bao-cao.pdf
                    ├── du-lieu.xlsx
                    └── hinh-anh.jpg
```

### Đặc điểm:
- ✅ Tên công việc và tên giáo viên **BỎ DẤU** (dùng hàm `removeVietnameseTones()`)
- ✅ Thư mục `submissions` tách biệt bài nộp với các file khác
- ✅ Mỗi giáo viên có thư mục riêng
- ✅ Hỗ trợ nộp nhiều file cho 1 lần nộp
- ✅ Hỗ trợ nộp lại (version tracking)

### Code location:
- [taskService.ts:226-236](src/services/taskService.ts#L226-L236)

### Tham số:
- `schoolYear`: "2025-2026" (từ Firestore `schoolYear.name`)
- `category`: "Công việc" (cố định)
- `subCategory`: "{TaskTitle}/submissions/{TeacherName}"

### Lưu ý:
- Backend tạo: `ROOT > schoolYear > category > subCategory`
- Kết quả: `Hồ sơ giáo viên/2025-2026/Công việc/[TaskName]/submissions/[Teacher]/`

---

## 4️⃣ MÔ TẢ CÔNG VIỆC (Task Description PDFs)

**Chức năng:** Hiệu trưởng/VP upload file PDF mô tả công việc

### Cấu trúc:
```
[Root Folder]/
└── [Năm học] cv/
    └── [Tên công việc]/
        └── description.pdf
```

### Ví dụ thực tế:
```
Hồ sơ giáo viên/ (ROOT)
└── 2025-2026 cv/  ← (tên năm học + " cv")
    └── asdf_adfadfa/  ← (đã bỏ dấu)
        └── description.pdf
    └── kiem_tra_cham_diem_tu_dong/
        └── description.pdf
```

### Đặc điểm:
- ✅ Năm học có thêm hậu tố " cv" (viết tắt của "công việc")
- ✅ Tên công việc **BỎ DẤU**
- ✅ File luôn tên là `description.pdf`

### Code location:
- [CreateTaskScreen.tsx:231-238](src/features/vice-principal/CreateTaskScreen.tsx#L231-L238)

### Tham số:
- `schoolYear`: "{SchoolYear} cv" (vd: "Năm học 2024-2025 cv")
- `category`: Tên công việc đã bỏ dấu

---

## 📊 SO SÁNH CÁC CẤU TRÚC

| Tính năng | Root | Level 1 | Level 2 | Level 3 | Level 4 | Level 5 | File |
|-----------|------|---------|---------|---------|---------|---------|------|
| **Hồ sơ điện tử (Mới)** | Root | Năm học | Danh mục | Danh mục con* | Tên người upload | Tiêu đề document | Nhiều files |
| **Hồ sơ điện tử (Cũ)** | Root | Năm học | Danh mục | Danh mục con* | - | - | 1 file |
| **Bài nộp công việc** | Root | Năm học | "Công việc" | Tên CV / submissions | Tên GV | - | Nhiều files |
| **Mô tả công việc** | Root | Năm học cv | Tên công việc | - | - | - | description.pdf |

**\*Danh mục con (SubCategory):** Optional - nếu không có thì bỏ qua level này

---

## 🔄 LOGIC BACKEND

### File: `server/index.js`

```javascript
// Line 219-244: Phân biệt cấu trúc dựa trên tham số

if (uploaderName && documentTitle) {
  // CẤU TRÚC MỚI: Hồ sơ điện tử với multi-file
  // Root > SchoolYear > Category > [SubCategory] > UploaderName > DocumentTitle

  const yearFolderId = await getOrCreateFolder(schoolYear, ROOT_FOLDER_ID);
  const categoryFolderId = await getOrCreateFolder(category, yearFolderId);

  let parentFolderId = categoryFolderId;
  if (subCategory) {
    parentFolderId = await getOrCreateFolder(subCategory, categoryFolderId);
  }

  const uploaderFolderId = await getOrCreateFolder(uploaderName, parentFolderId);
  targetFolderId = await getOrCreateFolder(documentTitle, uploaderFolderId);

} else {
  // CẤU TRÚC CŨ: Backward compatibility
  // Root > SchoolYear > Category > [SubCategory]

  const yearFolderId = await getOrCreateFolder(schoolYear);
  const categoryFolderId = await getOrCreateFolder(category, yearFolderId);

  targetFolderId = categoryFolderId;
  if (subCategory) {
    targetFolderId = await getOrCreateFolder(subCategory, categoryFolderId);
  }
}
```

### Hàm tạo folder: `getOrCreateFolder(folderName, parentId)`
- Tìm folder tồn tại → trả về ID
- Không tìm thấy → tạo mới → trả về ID
- Tránh duplicate folders

---

## 🎯 QUY TẮC CHUNG

### 1. **Xử lý tên folder:**
- Hồ sơ điện tử: Giữ nguyên dấu
- Công việc: Bỏ dấu (hàm `removeVietnameseTones()`, `sanitizeFileName()`)

### 2. **Permissions:**
- Tất cả file được set `role: 'reader', type: 'anyone'`
- Ai có link đều có thể xem/tải

### 3. **File metadata:**
Lưu trong Firestore:
```typescript
{
  id: string,
  name: string,
  size: number,
  mimeType: string,
  driveFileId: string,
  driveFileUrl: string (webViewLink)
}
```

### 4. **Giới hạn:**
- Hồ sơ điện tử: Tối đa 20 files/lần upload
- Mỗi file: Tối đa 50MB (frontend) / 100MB (backend)

---

## 📝 NOTES

### Migration từ cấu trúc cũ sang mới:
- ✅ Không cần migrate vì backend hỗ trợ cả 2 cấu trúc
- ✅ Hồ sơ mới dùng cấu trúc mới
- ✅ Công việc vẫn dùng cấu trúc riêng của nó

### Folder naming best practices:
- **CÓ DẤU:** Hồ sơ điện tử (dễ đọc, người dùng nhìn thấy)
- **KHÔNG DẤU:** Công việc (tránh lỗi encoding, URL-safe)

### Future improvements:
- [ ] Thêm folder cho từng năm học trong Hồ sơ điện tử
- [ ] Compression cho file lớn
- [ ] Batch upload optimization
- [ ] Folder archiving (đóng băng năm học cũ)

---

## 🔗 RELATED FILES

- **Frontend service:** [src/services/googleDriveServiceBackend.ts](src/services/googleDriveServiceBackend.ts)
- **Backend server:** [server/index.js](server/index.js)
- **Upload screens:**
  - [DocumentBrowseScreen.tsx](src/features/documents/DocumentBrowseScreen.tsx)
  - [DocumentUploadScreen.tsx](src/features/documents/DocumentUploadScreen.tsx)
  - [CreateTaskScreen.tsx](src/features/vice-principal/CreateTaskScreen.tsx)
- **Task service:** [taskService.ts](src/services/taskService.ts)

---

**Ngày cập nhật:** 2025-12-11
**Version:** v2.1.0 - Multi-file upload support
