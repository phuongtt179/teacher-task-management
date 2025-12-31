# Hướng dẫn chuyển đổi từ Service Account sang OAuth 2.0

## Tổng quan

**Mục tiêu:** Chuyển từ Service Account (vi phạm chính sách) sang OAuth 2.0 (hợp pháp)

**Kết quả:**
- ✅ Không bị khóa tài khoản
- ✅ Tất cả file lưu tập trung vào Drive của Admin
- ✅ Chi phí: $36/năm (Google One 200GB)
- ✅ An toàn và hợp pháp 100%

---

## BƯỚC 1: Dọn dẹp Service Account cũ (QUAN TRỌNG!)

### 1.1. Xóa Service Account

1. Vào Google Cloud Console: https://console.cloud.google.com
2. Chọn project **"My First Project"** (argon-ability-482809-d0)
3. Vào **APIs & Services** → **Credentials**
4. Tìm Service Account: `file-uploader@argon-ability-482809-d0.iam.gserviceaccount.com`
5. Click **Delete** (icon thùng rác)
6. Xác nhận xóa

### 1.2. Xóa file JSON key cũ

```bash
# Xóa file google-service-account-key.json
del f:\teacher-task-management\google-service-account-key.json
```

### 1.3. (Tùy chọn) Xóa Google Cloud Projects

Nếu muốn dọn sạch hoàn toàn:
1. Vào https://console.cloud.google.com
2. Chọn project **"My First Project"**
3. Settings → **Shut down**
4. Làm tương tự với project **"teacher-documents"** (nếu có)

---

## BƯỚC 2: Tạo OAuth 2.0 Client ID

### 2.1. Tạo hoặc chọn project

1. Vào https://console.cloud.google.com
2. Tạo project mới: **"Teacher Task Management"** HOẶC dùng project "teacher-documents"
3. Ghi nhớ Project ID

### 2.2. Enable Google Drive API

1. Vào **APIs & Services** → **Library**
2. Tìm **"Google Drive API"**
3. Click **Enable**

### 2.3. Cấu hình OAuth Consent Screen

1. Vào **APIs & Services** → **OAuth consent screen**
2. Chọn **External** (vì dùng Gmail cá nhân)
3. Click **Create**

**Thông tin cần điền:**
- **App name:** Teacher Task Management
- **User support email:** [Email của bạn]
- **Developer contact email:** [Email của bạn]
- **Authorized domains:** (có thể để trống khi test)
- Click **Save and Continue**

**Scopes:**
- Click **Add or Remove Scopes**
- Tìm và thêm:
  - `https://www.googleapis.com/auth/drive.file`
  - `https://www.googleapis.com/auth/drive`
- Click **Save and Continue**

**Test users:**
- Click **Add Users**
- Thêm email Gmail của bạn (admin)
- Click **Save and Continue**

### 2.4. Tạo OAuth 2.0 Client ID

1. Vào **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth 2.0 Client ID**
3. **Application type:** Web application
4. **Name:** Teacher Task Management Backend
5. **Authorized JavaScript origins:**
   ```
   http://localhost:5173
   https://teacher-task-management-1.onrender.com
   ```
6. **Authorized redirect URIs:**
   ```
   http://localhost:3001/api/auth/google/callback
   https://teacher-task-management-1.onrender.com/api/auth/google/callback
   ```
7. Click **Create**

**LƯU Ý QUAN TRỌNG:**
- Sẽ hiện popup với **Client ID** và **Client Secret**
- **COPY VÀ LƯU LẠI** cả 2 giá trị này (sẽ cần dùng sau)

---

## BƯỚC 3: Cài đặt thư viện mới cho Backend

```bash
cd f:\teacher-task-management
npm install passport passport-google-oauth20 express-session
```

---

## BƯỚC 4: Cập nhật file .env

Thêm các dòng sau vào file `.env`:

```env
# OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Admin Google Drive folder (tạo folder mới trên Drive và lấy ID)
ADMIN_DRIVE_FOLDER_ID=YOUR_FOLDER_ID_HERE

# Session secret (tạo random string)
SESSION_SECRET=your-super-secret-random-string-here
```

**Thay thế:**
- `YOUR_CLIENT_ID_HERE`: Client ID từ bước 2.4
- `YOUR_CLIENT_SECRET_HERE`: Client Secret từ bước 2.4
- `YOUR_FOLDER_ID_HERE`: Sẽ lấy sau khi authorize (bước 6)

**Xóa hoặc comment các dòng cũ:**
```env
# VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=...  (không cần nữa)
# GOOGLE_WORKSPACE_USER_EMAIL=...  (không cần nữa)
```

---

## BƯỚC 5: Sửa code Backend

### 5.1. Tạo file mới: `server/oauth-config.js`

```javascript
import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

// Scopes cần thiết
const SCOPES = ['https://www.googleapis.com/auth/drive'];

export { oauth2Client, SCOPES };
```

### 5.2. Sửa file `server/index.js`

Tôi sẽ tạo file mới hoàn chỉnh cho bạn (xem file kế tiếp)

---

## BƯỚC 6: Admin authorize lần đầu

Sau khi code xong và chạy server:

1. Mở trình duyệt: http://localhost:3001/api/auth/google
2. Đăng nhập bằng tài khoản Gmail của Admin
3. Cho phép app truy cập Google Drive
4. Sau khi authorize thành công, **refresh token** sẽ được lưu vào file
5. Copy Folder ID từ console log

---

## BƯỚC 7: Tạo folder trên Google Drive

1. Đăng nhập Google Drive bằng tài khoản Admin
2. Tạo folder mới: **"Ho-So-Truong"**
3. Vào folder → Copy URL
4. Lấy Folder ID từ URL: `https://drive.google.com/drive/folders/XXXXX`
5. Cập nhật vào `.env`: `ADMIN_DRIVE_FOLDER_ID=XXXXX`

---

## BƯỚC 8: Test trên local

1. Restart backend server
2. Mở frontend: http://localhost:5173
3. Đăng nhập và thử upload file
4. Kiểm tra folder trên Google Drive xem file đã lên chưa

---

## BƯỚC 9: Deploy lên Render

### 9.1. Cập nhật Environment Variables trên Render

Vào Render Dashboard → teacher-task-management (backend) → Environment:

**Thêm:**
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://your-app.onrender.com/api/auth/google/callback
ADMIN_DRIVE_FOLDER_ID=...
SESSION_SECRET=...
```

**Xóa:**
```
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID (không cần)
GOOGLE_WORKSPACE_USER_EMAIL (không cần)
```

### 9.2. Upload Refresh Token

Sau khi authorize lần đầu trên local, file `google-oauth-tokens.json` sẽ được tạo.
Cần upload file này lên Render (hoặc lưu vào database).

### 9.3. Deploy

```bash
git add .
git commit -m "Migrate to OAuth 2.0 for Google Drive"
git push
```

---

## BƯỚC 10: Authorize trên Production

1. Vào: https://your-app.onrender.com/api/auth/google
2. Đăng nhập bằng tài khoản Admin
3. Cho phép truy cập
4. Kiểm tra logs để xem refresh token đã được lưu

---

## Tổng kết

✅ **Hoàn thành!** Bạn đã chuyển đổi thành công sang OAuth 2.0

**Lợi ích:**
- ✅ An toàn, không bị khóa tài khoản
- ✅ Tất cả file lưu vào Drive của Admin
- ✅ Chi phí chỉ $36/năm (Google One 200GB)
- ✅ Dễ quản lý và backup

**Lưu ý:**
- Refresh token cần được bảo mật tuyệt đối
- Nếu token hết hạn, Admin cần authorize lại
- Nên lưu refresh token vào database thay vì file

---

## Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Console logs của backend
2. Browser console của frontend
3. Google Cloud Console → APIs & Services → Credentials
4. Email có nhận được cảnh báo từ Google không
