# Hướng dẫn Setup Google Drive với Service Account
## Lưu trữ file vào Google Workspace của trường

## Tổng quan

Hướng dẫn này sẽ giúp bạn:
- Dùng 1 Gmail cá nhân để tạo Google Cloud Project
- Tạo Service Account để upload file
- Lưu TẤT CẢ file vào Shared Drive của trường (1000GB storage)
- Giáo viên KHÔNG cần authorize Google Drive

---

## BƯỚC 1: Tạo Google Cloud Project (Dùng Gmail cá nhân)

### 1.1. Đăng nhập Gmail cá nhân
1. Mở trình duyệt **Incognito/Private** mode
2. Vào: https://console.cloud.google.com/
3. Đăng nhập bằng **Gmail cá nhân** của bạn (VD: yourname@gmail.com)

### 1.2. Tạo Project mới
1. Click dropdown **"Select a project"** ở góc trên bên trái
2. Click **"NEW PROJECT"**
3. Điền thông tin:
   - **Project name**: `Teacher Task Management`
   - **Location**: No organization (để mặc định)
4. Click **"CREATE"**
5. Đợi vài giây để project được tạo
6. Chọn project vừa tạo từ dropdown

---

## BƯỚC 2: Enable Google Drive API

1. Trong Google Cloud Console, click menu ☰ bên trái
2. Vào **"APIs & Services"** > **"Library"**
3. Tìm kiếm **"Google Drive API"**
4. Click vào **"Google Drive API"**
5. Click nút **"ENABLE"**
6. Đợi API được enable (vài giây)

---

## BƯỚC 3: Tạo Service Account

### 3.1. Vào trang Service Accounts
1. Click menu ☰ bên trái
2. Vào **"IAM & Admin"** > **"Service Accounts"**
3. Click **"+ CREATE SERVICE ACCOUNT"**

### 3.2. Tạo Service Account
**Step 1: Service account details**
- **Service account name**: `teacher-app-drive-uploader`
- **Service account ID**: (tự động generate)
- **Description**: `Service account for uploading teacher documents to school Drive`
- Click **"CREATE AND CONTINUE"**

**Step 2: Grant this service account access to project**
- **Role**: Chọn **"Editor"** (hoặc có thể bỏ qua)
- Click **"CONTINUE"**

**Step 3: Grant users access to this service account**
- Bỏ qua (không cần điền gì)
- Click **"DONE"**

### 3.3. Lưu lại Service Account Email
Bạn sẽ thấy service account vừa tạo trong danh sách, có dạng:
```
teacher-app-drive-uploader@project-name-123456.iam.gserviceaccount.com
```
**Lưu lại email này**, bạn sẽ cần nó ở bước sau!

---

## BƯỚC 4: Tạo và Download Service Account Key

### 4.1. Tạo Key
1. Trong danh sách Service Accounts, click vào service account vừa tạo
2. Vào tab **"KEYS"** ở trên
3. Click **"ADD KEY"** > **"Create new key"**
4. Chọn **"JSON"**
5. Click **"CREATE"**

### 4.2. Lưu file JSON
- File JSON sẽ tự động download về máy
- Tên file dạng: `project-name-123456-abc123def456.json`
- **QUAN TRỌNG**: Lưu file này an toàn, KHÔNG share cho ai!

### 4.3. Đổi tên file (khuyến nghị)
Đổi tên file thành: `google-service-account-key.json`

---

## BƯỚC 5: Tạo Shared Drive trong Google Workspace của trường

### 5.1. Đăng xuất Gmail cá nhân
1. Đăng xuất khỏi Gmail cá nhân
2. Hoặc mở trình duyệt mới / tab Incognito khác

### 5.2. Đăng nhập Workspace của trường
1. Vào: https://drive.google.com/
2. Đăng nhập bằng **tài khoản Workspace của trường** (admin@thnguyenphanvinh-danang.edu.vn)

### 5.3. Tạo Shared Drive
1. Ở menu bên trái, click **"Shared drives"**
2. Click nút **"New"** (hoặc dấu +)
3. Đặt tên: **"Hồ sơ giáo viên"**
4. Click **"CREATE"**

---

## BƯỚC 6: Add Service Account vào Shared Drive

### 6.1. Vào Shared Drive vừa tạo
1. Click vào **"Hồ sơ giáo viên"** trong danh sách Shared drives

### 6.2. Add Service Account
1. Click vào icon **"Manage members"** (icon người với dấu +) ở góc trên bên phải
2. Trong ô **"Add members"**, paste email của Service Account:
   ```
   teacher-app-drive-uploader@project-name-123456.iam.gserviceaccount.com
   ```
3. Ở dropdown quyền, chọn **"Manager"** hoặc **"Content Manager"**
4. **BỎ TICK** ô **"Notify people"** (vì service account không nhận email)
5. Click **"Send"**

### 6.3. Lưu Shared Drive ID
1. Trong Shared Drive **"Hồ sơ giáo viên"**, copy URL từ thanh địa chỉ
2. URL có dạng: `https://drive.google.com/drive/folders/XXXXXXXXXXXXX`
3. **Lưu lại phần `XXXXXXXXXXXXX`** - đây là Shared Drive ID

---

## BƯỚC 7: Copy Service Account Key vào Project

### 7.1. Copy file JSON vào project
1. Mở file explorer
2. Copy file `google-service-account-key.json` (đã download ở Bước 4)
3. Paste vào thư mục root của project: `f:\teacher-task-management\`

### 7.2. Thêm vào .gitignore
Mở file `.gitignore` và thêm dòng:
```
google-service-account-key.json
```
**Lý do**: Tránh commit file chứa credentials lên Git

---

## BƯỚC 8: Cập nhật Environment Variables

Mở file `.env` và cập nhật:

```env
# Google Drive API với Service Account
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=XXXXXXXXXXXXX
```

Thay `XXXXXXXXXXXXX` bằng Shared Drive ID từ Bước 6.3

**Lưu ý**:
- KHÔNG cần `VITE_GOOGLE_CLIENT_ID` và `VITE_GOOGLE_API_KEY` nữa
- Service Account sẽ dùng file JSON key thay vì OAuth

---

## BƯỚC 9: Cài đặt Dependencies

Chạy lệnh sau để cài package mới:

```bash
npm install googleapis
```

Package này cho phép Node.js tương tác với Google APIs sử dụng Service Account.

---

## BƯỚC 10: Chạy ứng dụng và Test

### 10.1. Khởi động server
```bash
npm run dev
```

### 10.2. Test upload
1. Đăng nhập vào app
2. Vào **"Hồ sơ điện tử"**
3. Chọn năm học và danh mục
4. Click **"Thêm hồ sơ"**
5. Upload một file test
6. Kiểm tra kết quả

### 10.3. Kiểm tra trên Google Drive
1. Vào: https://drive.google.com/
2. Đăng nhập tài khoản Workspace của trường
3. Vào **"Shared drives"** > **"Hồ sơ giáo viên"**
4. Bạn sẽ thấy cấu trúc thư mục và file vừa upload

---

## KẾT QUẢ MONG ĐỢI

✅ File được upload vào Shared Drive của trường
✅ Cấu trúc thư mục tự động: Năm học > Danh mục > Danh mục con
✅ Sử dụng storage 1000GB của trường
✅ Giáo viên không cần authorize Google Drive
✅ Tất cả file tập trung ở 1 nơi, dễ quản lý

---

## CẤU TRÚC THỨ MỤC TRÊN DRIVE

```
📁 Hồ sơ giáo viên (Shared Drive)
  📁 Năm học 2024-2025
    📁 Hồ sơ chuyên môn
      📁 Kế hoạch giáo dục
        📄 Kế hoạch môn học tuần 1.pdf
        📄 Kế hoạch giáo dục năm học.docx
      📁 Giáo án
        📄 Giáo án Toán - Tuần 1.pdf
    📁 Hồ sơ công khai
      📄 Thông báo nghỉ lễ.pdf
```

---

## TROUBLESHOOTING

### Lỗi: "Permission denied"
- Kiểm tra Service Account đã được add vào Shared Drive chưa
- Kiểm tra quyền của Service Account (phải là Manager hoặc Content Manager)

### Lỗi: "Invalid credentials"
- Kiểm tra file JSON key có đúng không
- Kiểm tra đường dẫn đến file JSON trong code

### Lỗi: "Shared Drive not found"
- Kiểm tra Shared Drive ID trong `.env` có đúng không
- Kiểm tra Service Account có quyền truy cập Shared Drive không

### File không hiển thị trên Drive
- Đợi vài giây, có thể bị delay
- Refresh trang Google Drive
- Kiểm tra trong "Recent" xem file có được upload không

---

## BẢO MẬT

### ✅ PHẢI LÀM:
- Lưu file JSON key an toàn
- Thêm `google-service-account-key.json` vào `.gitignore`
- Không share file JSON cho bất kỳ ai
- Backup file JSON ở nơi an toàn

### ❌ KHÔNG NÊN:
- Commit file JSON key lên Git
- Gửi file JSON qua email
- Lưu file JSON trong thư mục public
- Share credentials với người không cần thiết

---

## KẾT LUẬN

Với setup này:
- ✅ Đơn giản: Chỉ cần 1 Gmail cá nhân để setup
- ✅ An toàn: File lưu vào Workspace của trường
- ✅ Tập trung: Tất cả file ở 1 Shared Drive
- ✅ Tiện lợi: Giáo viên không cần authorize
- ✅ Dung lượng lớn: Dùng 1000GB của trường

Nếu có vấn đề, hãy kiểm tra lại từng bước trong hướng dẫn này!
