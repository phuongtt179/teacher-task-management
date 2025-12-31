# Quick Start: Chuyển sang OAuth 2.0

## Tóm tắt nhanh

Tôi đã code xong! Bây giờ bạn cần làm theo các bước sau:

---

## BƯỚC 1: Dọn dẹp Service Account cũ (5 phút)

1. **Xóa Service Account** (để tránh vi phạm):
   - Vào: https://console.cloud.google.com
   - Chọn project "My First Project"
   - APIs & Services → Credentials
   - Xóa Service Account đã tạo

2. **Xóa file JSON cũ**:
   ```bash
   del f:\teacher-task-management\google-service-account-key.json
   ```

---

## BƯỚC 2: Tạo OAuth 2.0 Client ID (10 phút)

### 2.1. Chọn/tạo project
- Vào: https://console.cloud.google.com
- Chọn project "teacher-documents" (hoặc tạo mới)

### 2.2. Enable Google Drive API
- APIs & Services → Library
- Tìm "Google Drive API" → Enable

### 2.3. Cấu hình OAuth Consent Screen
- APIs & Services → OAuth consent screen
- Chọn **External**
- **App name:** Teacher Task Management
- **User support email:** [Email của bạn]
- **Developer contact email:** [Email của bạn]
- **Scopes:** Thêm `https://www.googleapis.com/auth/drive`
- **Test users:** Thêm email của bạn

### 2.4. Tạo OAuth Client ID
- APIs & Services → Credentials
- **+ Create Credentials** → **OAuth 2.0 Client ID**
- **Application type:** Web application
- **Name:** Teacher Task Backend
- **Authorized redirect URIs:**
  ```
  http://localhost:3001/api/auth/google/callback
  ```
- Click **Create**
- **COPY** Client ID và Client Secret (cần dùng ngay!)

---

## BƯỚC 3: Cập nhật .env (2 phút)

Mở file `.env` và thêm:

```env
# OAuth 2.0 Configuration (THÊM MỚI)
GOOGLE_CLIENT_ID=paste-client-id-vừa-copy
GOOGLE_CLIENT_SECRET=paste-client-secret-vừa-copy
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback
ADMIN_DRIVE_FOLDER_ID=  # Để trống, sẽ điền sau
SESSION_SECRET=my-super-secret-random-string-12345
```

**Xóa hoặc comment các dòng cũ:**
```env
# VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=...  # KHÔNG CẦN NỮA
# GOOGLE_WORKSPACE_USER_EMAIL=...  # KHÔNG CẦN NỮA
```

---

## BƯỚC 4: Thay file backend (1 phút)

```bash
cd f:\teacher-task-management\server
del index.js
ren index-oauth.js index.js
```

HOẶC copy thủ công:
- Xóa `server/index.js` cũ
- Đổi tên `server/index-oauth.js` → `server/index.js`

---

## BƯỚC 5: Start server (1 phút)

```bash
cd f:\teacher-task-management
node server/index.js
```

Bạn sẽ thấy:
```
🚀 Server running on http://localhost:3001
⚠️  OAuth not authorized yet
👉 Visit: http://localhost:3001/api/auth/google to authorize
```

---

## BƯỚC 6: Admin authorize lần đầu (3 phút)

1. **Mở trình duyệt**: http://localhost:3001/api/auth/google

2. **Đăng nhập** bằng Gmail của bạn (tài khoản sẽ mua Google One)

3. **Cho phép** app truy cập Google Drive

4. **Thành công** khi thấy màn hình "✅ Authorization Successful!"

5. **Tạo folder trên Google Drive**:
   - Vào drive.google.com
   - Tạo folder: "Ho-So-Truong"
   - Vào folder → Copy URL
   - Lấy Folder ID: `https://drive.google.com/drive/folders/XXXXX`

6. **Cập nhật .env**:
   ```env
   ADMIN_DRIVE_FOLDER_ID=paste-folder-id-vừa-copy
   ```

7. **Restart server**

---

## BƯỚC 7: Test upload (2 phút)

1. Start frontend:
   ```bash
   npm run dev
   ```

2. Mở http://localhost:5173

3. Đăng nhập và thử upload 1 file

4. Kiểm tra Google Drive xem file đã lên chưa

---

## ✅ XONG!

**Nếu thành công:**
- File sẽ xuất hiện trong folder Google Drive của bạn
- Không bị khóa tài khoản
- An toàn và hợp pháp 100%

**Nếu có lỗi:**
- Kiểm tra console log của backend
- Kiểm tra file `.env` đã điền đủ chưa
- Kiểm tra OAuth Consent Screen đã thêm email của bạn vào Test users chưa

---

## Câu hỏi thường gặp

**Q: Tôi có cần mua Google One ngay không?**
A: Chưa cần! Dùng 15GB miễn phí để test trước. Sau đó mới mua Google One 200GB ($36/năm).

**Q: Có bị khóa tài khoản không?**
A: KHÔNG! OAuth 2.0 là phương thức chính thức của Google, hoàn toàn an toàn.

**Q: File lưu ở đâu?**
A: Tất cả file sẽ lưu vào Google Drive của bạn (tài khoản admin đã authorize).

**Q: Giáo viên khác upload thì sao?**
A: File vẫn lưu vào Drive của admin, vì backend dùng token của admin để upload.

---

## Liên hệ

Nếu cần hỗ trợ, hãy gửi:
1. Console log của backend
2. Screenshot lỗi
3. Bước nào đang bị lỗi
