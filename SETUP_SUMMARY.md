# Tóm tắt Setup Google Drive với Service Account

## ✅ Đã hoàn thành

### 1. Backend Server
- ✅ Tạo Express server tại `server/index.js`
- ✅ Cài đặt dependencies: `googleapis`, `express`, `multer`, `cors`
- ✅ API endpoints:
  - `GET /api/health` - Kiểm tra server
  - `POST /api/upload` - Upload file
  - `DELETE /api/files/:fileId` - Xóa file

### 2. Frontend Service
- ✅ Tạo `googleDriveServiceBackend.ts` để gọi backend API
- ✅ Hỗ trợ upload với progress tracking
- ✅ Hỗ trợ delete file

### 3. Cấu hình
- ✅ Cập nhật `.env` với `VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID`
- ✅ Cập nhật `.gitignore` để bảo mật
- ✅ Cập nhật `package.json` với script `npm run server`

### 4. Tài liệu
- ✅ Tạo `GOOGLE_DRIVE_SERVICE_ACCOUNT_SETUP.md` - Hướng dẫn chi tiết đầy đủ

---

## 📋 CẦN LÀM TIẾP (Theo thứ tự)

### Bước 1: Setup Google Cloud (Gmail cá nhân)
Làm theo file: [GOOGLE_DRIVE_SERVICE_ACCOUNT_SETUP.md](./GOOGLE_DRIVE_SERVICE_ACCOUNT_SETUP.md)

**TÓM TẮT:**
1. Dùng Gmail cá nhân tạo Google Cloud Project
2. Enable Google Drive API
3. Tạo Service Account
4. Download file JSON key → Lưu thành `google-service-account-key.json`
5. Copy file vào root project

### Bước 2: Setup Shared Drive (Workspace trường)
1. Đăng nhập https://drive.google.com/ bằng tài khoản Workspace
2. Tạo Shared Drive: "Hồ sơ giáo viên"
3. Add service account email vào Shared Drive với quyền Manager
4. Copy Shared Drive ID từ URL

### Bước 3: Cấu hình .env
Mở file `.env` và thay:
```env
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=your-shared-drive-id-here
```
Bằng Shared Drive ID thực tế.

### Bước 4: Cập nhật Frontend Code
File cần sửa: `src/features/documents/DocumentBrowseScreen.tsx`

**Thay đổi import (dòng 1-30):**
```typescript
// XÓA dòng này:
import { useGoogleDrive } from '@/hooks/useGoogleDrive';

// THÊM dòng này:
import { googleDriveServiceBackend } from '@/services/googleDriveServiceBackend';

// XÓA dòng này trong component:
const { isSignedIn, signIn, driveService } = useGoogleDrive();
```

**Thay đổi hàm handleUpload (dòng 209-302):**
Thay toàn bộ phần upload code bằng:

```typescript
try {
  setUploading(true);
  setUploadProgress(0);

  // Check backend
  const isHealthy = await googleDriveServiceBackend.checkHealth();
  if (!isHealthy) {
    toast({
      title: 'Lỗi',
      description: 'Server chưa chạy. Vui lòng chạy: npm run server',
      variant: 'destructive',
    });
    return;
  }

  // Get folder names
  const schoolYear = schoolYears.find(y => y.id === selectedYearId);
  const categoryName = categories.find(c => c.id === selectedCategoryId)?.name || 'Khác';
  const subCategoryName = selectedSubCategoryId
    ? subCategories.find(s => s.id === selectedSubCategoryId)?.name
    : undefined;

  toast({
    title: 'Đang tải lên',
    description: 'Đang tải file lên Drive của trường...',
  });

  // Upload via backend
  const driveFile = await googleDriveServiceBackend.uploadFile({
    file: selectedFile,
    schoolYear: schoolYear?.name || 'Hồ sơ',
    category: categoryName,
    subCategory: subCategoryName,
    onProgress: (progress) => {
      setUploadProgress(progress);
    },
  });

  // Save to Firestore
  let status: 'pending' | 'approved' = 'pending';
  if (user?.role === 'admin' || user?.role === 'vice_principal') {
    status = 'approved';
  }

  await documentService.createDocument({
    schoolYearId: selectedYearId,
    categoryId: selectedCategoryId,
    subCategoryId: selectedSubCategoryId || undefined,
    title: documentTitle.trim(),
    fileName: driveFile.name,
    fileSize: driveFile.size,
    mimeType: driveFile.mimeType,
    driveFileId: driveFile.id,
    driveFileUrl: driveFile.webViewLink,
    thumbnailUrl: driveFile.thumbnailLink,
    uploadedBy: user!.uid,
    uploadedByName: user!.displayName,
    departmentId: userDepartment?.id,
    isPublic: false,
    status,
  });

  toast({
    title: 'Thành công',
    description: status === 'approved'
      ? 'Đã tải lên Drive của trường'
      : 'Đã tải lên và đang chờ phê duyệt',
  });

  setShowUploadDialog(false);
  setDocumentTitle('');
  setSelectedFile(null);
  setUploadProgress(0);
  loadDocuments();
} catch (error) {
  console.error('Error uploading:', error);
  toast({
    title: 'Lỗi',
    description: error instanceof Error ? error.message : 'Không thể tải lên',
    variant: 'destructive',
  });
} finally {
  setUploading(false);
}
```

### Bước 5: Thêm API URL vào .env
Thêm vào file `.env`:
```env
VITE_API_URL=http://localhost:3001/api
```

---

## 🚀 Chạy ứng dụng

### Terminal 1: Chạy Backend
```bash
npm run server
```
Kết quả mong đợi:
```
🚀 Server running on http://localhost:3001
📁 Shared Drive ID: [ID của bạn]
🔑 Service Account Key: Found
```

### Terminal 2: Chạy Frontend
```bash
npm run dev
```

---

## 🧪 Test

1. Vào app: http://localhost:5173
2. Đăng nhập
3. Vào "Hồ sơ điện tử"
4. Chọn năm học, danh mục
5. Upload file
6. Kiểm tra trên Google Drive của trường → "Shared drives" → "Hồ sơ giáo viên"

---

## ❌ Troubleshooting

### "Server chưa chạy"
→ Chạy `npm run server` trong terminal riêng

### "Service Account Key: NOT FOUND"
→ File `google-service-account-key.json` chưa có trong root project

### "Shared Drive ID: NOT CONFIGURED"
→ Chưa thêm `VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID` vào `.env`

### "Permission denied"
→ Service account chưa được add vào Shared Drive

---

## 📝 Lưu ý bảo mật

✅ File `google-service-account-key.json` đã được add vào `.gitignore`
✅ Thư mục `uploads/` đã được add vào `.gitignore`
❌ KHÔNG commit file JSON key lên Git
❌ KHÔNG share file JSON key

---

## 📚 Tài liệu tham khảo

- [GOOGLE_DRIVE_SERVICE_ACCOUNT_SETUP.md](./GOOGLE_DRIVE_SERVICE_ACCOUNT_SETUP.md) - Hướng dẫn chi tiết từng bước

---

## ✨ Kết quả

Sau khi hoàn thành:
- ✅ File lưu trong Drive của trường (1000GB)
- ✅ Tất cả file tập trung ở Shared Drive
- ✅ Giáo viên không cần authorize Google
- ✅ Cấu trúc thư mục tự động tạo
- ✅ Progress bar khi upload
- ✅ An toàn và bảo mật
