# Hướng dẫn triển khai cho trường mới

Mỗi trường dùng **tài khoản riêng hoàn toàn** — Firebase, Google Drive, OAuth, Gemini. Code không thay đổi.

---

## Tổng quan các bước

1. Tạo Firebase project
2. Tạo Google Cloud project + OAuth client
3. Chuẩn bị Google Drive folder
4. Lấy Gemini API key
5. Deploy backend lên Render
6. Deploy frontend lên Render (hoặc Firebase Hosting)
7. Cấu hình biến môi trường

---

## Bước 1 — Firebase

**Tạo project mới tại:** https://console.firebase.google.com

### 1.1 Tạo project
- Bấm **"Add project"** → đặt tên (ví dụ: `truong-abc-task`)
- Tắt Google Analytics nếu không cần

### 1.2 Bật Authentication
- Vào **Authentication → Sign-in method**
- Bật **Email/Password**

### 1.3 Tạo Firestore Database
- Vào **Firestore Database → Create database**
- Chọn **Production mode**
- Chọn region gần nhất (asia-southeast1 cho Việt Nam)

### 1.4 Bật Cloud Messaging (FCM - thông báo đẩy)
- Vào **Project Settings → Cloud Messaging**
- Copy **VAPID key** (dùng cho VITE_FIREBASE_VAPID_KEY)

### 1.5 Tạo Web App
- Vào **Project Settings → Your apps → Add app → Web**
- Đặt tên app → Copy các config sau:
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
```

### 1.6 Tạo Service Account (cho backend)
- Vào **Project Settings → Service accounts**
- Bấm **"Generate new private key"** → tải file JSON
- Copy 2 giá trị:
  - `client_email` → FIREBASE_CLIENT_EMAIL
  - `private_key` → FIREBASE_PRIVATE_KEY

### 1.7 Cài Firestore Rules
- Vào **Firestore → Rules** → copy nội dung từ file `firestore.rules` trong project

---

## Bước 2 — Google Cloud (OAuth cho Google Drive)

**Tạo project tại:** https://console.cloud.google.com

### 2.1 Tạo project mới
- Bấm **"Select a project" → New Project**
- Đặt tên (ví dụ: `truong-abc-backend`)

### 2.2 Bật Google Drive API
- Vào **APIs & Services → Library**
- Tìm **"Google Drive API"** → Enable

### 2.3 Tạo OAuth Consent Screen
- Vào **APIs & Services → OAuth consent screen**
- Chọn **External**
- Điền tên app, email hỗ trợ
- Thêm scope: `../auth/drive` và `../auth/drive.file`
- Thêm email tài khoản Google Drive của trường vào **Test users**
- Sau khi hoàn tất: bấm **"Publish App"** để token không hết hạn 7 ngày

### 2.4 Tạo OAuth Client ID
- Vào **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
- Chọn **Web application**
- Thêm Authorized redirect URIs:
  - `https://[tên-backend-render].onrender.com/api/auth/google/callback`
- Copy:
  - **Client ID** → GOOGLE_CLIENT_ID
  - **Client Secret** → GOOGLE_CLIENT_SECRET

---

## Bước 3 — Google Drive

### 3.1 Tạo thư mục lưu trữ
- Dùng tài khoản Google của trường (tài khoản sẽ lưu toàn bộ file giáo án)
- Tạo 1 folder trong Google Drive (ví dụ: "Hồ sơ Trường ABC")
- Copy **Folder ID** từ URL:
  ```
  https://drive.google.com/drive/folders/[FOLDER_ID_Ở_ĐÂY]
  ```
  → ADMIN_DRIVE_FOLDER_ID

---

## Bước 4 — Gemini API (AI phân tích văn bản)

**Tạo API key miễn phí tại:** https://aistudio.google.com/apikey

- Bấm **"Create API key"**
- Copy key → GEMINI_API_KEY

---

## Bước 5 — Deploy Backend lên Render

**Tạo tài khoản tại:** https://render.com (miễn phí)

### 5.1 Tạo Web Service mới
- Bấm **"New → Web Service"**
- Connect GitHub repo
- Cấu hình:
  - **Name:** `truong-abc-backend`
  - **Build Command:** `npm install`
  - **Start Command:** `node server/index.js`
  - **Instance Type:** Free

### 5.2 Thêm Environment Variables
Vào tab **Environment**, thêm từng biến:

| Biến | Giá trị |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `GOOGLE_CLIENT_ID` | *(từ bước 2.4)* |
| `GOOGLE_CLIENT_SECRET` | *(từ bước 2.4)* |
| `GOOGLE_CALLBACK_URL` | `https://[tên-service].onrender.com/api/auth/google/callback` |
| `ADMIN_DRIVE_FOLDER_ID` | *(từ bước 3.1)* |
| `GEMINI_API_KEY` | *(từ bước 4)* |
| `FIREBASE_CLIENT_EMAIL` | *(từ bước 1.6)* |
| `FIREBASE_PRIVATE_KEY` | *(từ bước 1.6, giữ nguyên cả `"..."`)* |
| `VITE_FIREBASE_PROJECT_ID` | *(từ bước 1.5)* |
| `ADMIN_SECRET` | *(tự đặt 1 chuỗi bí mật, dùng để export token)* |

### 5.3 Authorize Google Drive
Sau khi Render deploy xong:
- Mở trình duyệt → vào `https://[tên-service].onrender.com/api/auth/google`
- Đăng nhập bằng tài khoản Google Drive của trường
- Thấy "Authorization Successful!" → xong
- Vào `https://[tên-service].onrender.com/api/auth/export-tokens?secret=[ADMIN_SECRET]`
- Copy giá trị `refresh_token`
- Thêm vào Render Environment: `GOOGLE_REFRESH_TOKEN` = *(refresh token vừa lấy)*
- Render tự restart

> **Lưu ý:** Token hết hạn nếu app chưa Publish (xem bước 2.3). Sau khi Publish App thì token không hết hạn nữa.

---

## Bước 6 — Deploy Frontend

### Cách 1: Render Static Site (đơn giản)
- Tạo **"New → Static Site"** trên Render
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- Thêm Environment Variables:
  ```
  VITE_FIREBASE_API_KEY=...
  VITE_FIREBASE_AUTH_DOMAIN=...
  VITE_FIREBASE_PROJECT_ID=...
  VITE_FIREBASE_STORAGE_BUCKET=...
  VITE_FIREBASE_MESSAGING_SENDER_ID=...
  VITE_FIREBASE_APP_ID=...
  VITE_FIREBASE_VAPID_KEY=...
  VITE_API_URL=https://[tên-backend].onrender.com/api
  ```

### Cách 2: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

---

## Bước 7 — Cấu hình ban đầu trong app

Sau khi deploy, đăng nhập lần đầu với tài khoản admin:

1. **Thêm email vào Whitelist** (tài khoản đầu tiên cần được thêm thủ công vào Firestore)
   - Vào Firestore Console → collection `whitelist` → thêm document với field `email`

2. **Tạo tài khoản Admin** 
   - Đăng nhập app → vào **Quản lý người dùng** → đặt role `admin`

3. **Tạo năm học** trong phần cấu hình

4. **Thêm giáo viên** vào whitelist và tạo tài khoản

---

## Tóm tắt file .env cần thiết

```env
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=

# Backend API
VITE_API_URL=https://[backend].onrender.com/api

# Google OAuth (callback luôn trỏ về Render, không dùng localhost)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://[backend].onrender.com/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=

# Google Drive
ADMIN_DRIVE_FOLDER_ID=

# Gemini AI
GEMINI_API_KEY=

# Firebase Admin (backend)
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Security
ADMIN_SECRET=
```
