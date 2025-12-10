# Hướng dẫn Setup Dự án Teacher Task Management

## Giới thiệu
Đây là ứng dụng quản lý công việc giáo viên được xây dựng với React, TypeScript, Vite và Firebase.

## Yêu cầu hệ thống
- Node.js (phiên bản 18 trở lên)
- npm hoặc yarn
- Tài khoản Firebase

## Các bước setup

### 1. Clone/Copy dự án

```bash
# Nếu từ git
git clone <repository-url>
cd teacher-task-management

# Hoặc giải nén file zip nếu nhận từ nguồn khác
```

### 2. Cài đặt dependencies

```bash
npm install
# hoặc
yarn install
```

### 3. Tạo Firebase Project mới

#### 3.1. Tạo project trên Firebase Console
1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" (Thêm dự án)
3. Nhập tên project (ví dụ: "teacher-task-manager-prod")
4. Bật/tắt Google Analytics tùy chọn
5. Click "Create project"

#### 3.2. Thêm Web App vào Firebase Project
1. Trong Firebase Console, chọn project vừa tạo
2. Click biểu tượng "</>" để thêm Web app
3. Nhập tên app (ví dụ: "Teacher Task Web")
4. ✅ Chọn "Also set up Firebase Hosting" (tùy chọn)
5. Click "Register app"
6. **Lưu lại** thông tin Firebase Config hiển thị (cần dùng ở bước sau)

```javascript
// Ví dụ Firebase Config
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

#### 3.3. Bật các services cần thiết

**a. Authentication (Google Sign-In)**
1. Trong Firebase Console, vào **Build > Authentication**
2. Click "Get started"
3. Tab "Sign-in method", click "Google"
4. Bật "Enable"
5. Chọn email support
6. Click "Save"

**b. Firestore Database**
1. Vào **Build > Firestore Database**
2. Click "Create database"
3. Chọn location (ví dụ: asia-southeast1)
4. Chọn mode:
   - **Production mode** (cần setup rules sau)
   - **Test mode** (cho phát triển - nhớ sửa rules sau 30 ngày)
5. Click "Enable"

**c. Cloud Messaging (FCM)**
1. Vào **Build > Cloud Messaging**
2. Click "Get started" (nếu có)
3. Vào **Project Settings > Cloud Messaging**
4. Tab "Web configuration"
5. Tìm mục "Web Push certificates"
6. Click "Generate key pair"
7. **Lưu lại VAPID key** (cần dùng ở bước sau)

#### 3.4. Thiết lập Firestore Security Rules

Vào **Firestore Database > Rules** và cập nhật:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isVicePrincipal() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'vice_principal';
    }

    function isTeacher() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }

    // Whitelist collection - chỉ admin có thể đọc/ghi
    match /whitelist/{email} {
      allow read, write: if isAdmin();
    }

    // Users collection
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
      allow create: if isSignedIn();
    }

    // Tasks collection
    match /tasks/{taskId} {
      allow read: if isSignedIn();
      allow create: if isVicePrincipal() || isAdmin();
      allow update, delete: if isVicePrincipal() || isAdmin();
    }

    // Task submissions
    match /tasks/{taskId}/submissions/{submissionId} {
      allow read: if isSignedIn();
      allow create: if isTeacher() || isVicePrincipal() || isAdmin();
      allow update: if isTeacher() && request.auth.uid == resource.data.userId;
    }

    // Notifications
    match /notifications/{notificationId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isSignedIn();
    }
  }
}
```

### 4. Cấu hình Environment Variables

#### 4.1. Tạo file .env từ .env.example

```bash
cp .env.example .env
```

#### 4.2. Cập nhật file .env với thông tin từ Firebase Config

Mở file `.env` và cập nhật các giá trị:

```env
# Thông tin từ Firebase Config (bước 3.2)
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# VAPID key từ Cloud Messaging (bước 3.3.c)
VITE_FIREBASE_VAPID_KEY=your-vapid-key-here
```

### 5. Cập nhật Firebase Messaging Service Worker

Mở file `public/firebase-messaging-sw.js` và cập nhật Firebase config (từ dòng 6-13):

```javascript
firebase.initializeApp({
    apiKey: "your-api-key-here",           // Giống VITE_FIREBASE_API_KEY
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
});
```

**Lưu ý:** Service worker không thể sử dụng environment variables, nên phải cập nhật thủ công.

### 6. Setup dữ liệu ban đầu

#### 6.1. Tạo user admin đầu tiên

1. Chạy ứng dụng (xem bước 7)
2. Đăng nhập bằng Google với email bạn muốn làm admin
3. Vào Firebase Console > Firestore Database
4. Tìm collection `users` và document với email của bạn
5. Cập nhật field `role` thành `"admin"`

Hoặc tạo thủ công trong Firestore:

- Collection: `whitelist`
- Document ID: `your-email@gmail.com`
- Fields:
  ```
  email: "your-email@gmail.com"
  role: "admin"
  addedAt: [timestamp]
  addedBy: "system"
  ```

#### 6.2. Tạo PWA icons (tùy chọn)

Nếu bạn muốn custom icons cho PWA, tạo các icon sau trong `public/icons/`:
- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png

Hoặc sử dụng tool online như [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator).

### 7. Chạy ứng dụng

#### Development mode

```bash
npm run dev
# hoặc
yarn dev
```

Ứng dụng sẽ chạy tại `http://localhost:5173` (hoặc port khác nếu 5173 đã được sử dụng).

#### Build cho production

```bash
npm run build
# hoặc
yarn build
```

File build sẽ nằm trong thư mục `dist/`.

#### Preview production build

```bash
npm run preview
# hoặc
yarn preview
```

### 8. Deploy lên Firebase Hosting (tùy chọn)

#### 8.1. Cài đặt Firebase CLI

```bash
npm install -g firebase-tools
```

#### 8.2. Login vào Firebase

```bash
firebase login
```

#### 8.3. Khởi tạo Firebase Hosting

```bash
firebase init hosting
```

Chọn:
- Use existing project: chọn project bạn đã tạo
- Public directory: `dist`
- Single-page app: `Yes`
- Automatic builds với GitHub: tùy chọn

#### 8.4. Deploy

```bash
# Build trước
npm run build

# Deploy
firebase deploy --only hosting
```

### 9. Kiểm tra ứng dụng

1. Truy cập URL của ứng dụng
2. Đăng nhập bằng Google
3. Kiểm tra các chức năng:
   - Authentication
   - Tạo/xem tasks (với role phù hợp)
   - Notifications
   - PWA (Install app trên mobile/desktop)

## Cấu trúc dự án

```
teacher-task-management/
├── public/
│   ├── icons/              # PWA icons
│   ├── firebase-messaging-sw.js  # Service worker cho FCM
│   └── manifest.json       # PWA manifest
├── src/
│   ├── components/         # React components
│   ├── features/          # Feature-based modules
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Utilities và config
│   │   └── firebase.ts    # Firebase configuration
│   ├── services/          # Business logic services
│   ├── stores/            # Zustand stores
│   └── types/             # TypeScript types
├── .env                   # Environment variables (không commit)
├── .env.example          # Template cho .env
└── package.json
```

## Troubleshooting

### Lỗi Firebase Authentication
- Kiểm tra Google Sign-In đã được bật trong Firebase Console
- Kiểm tra domain của bạn đã được authorize trong Firebase Console > Authentication > Settings > Authorized domains

### Lỗi Firestore Permission Denied
- Kiểm tra Firestore Security Rules
- Đảm bảo user đã được thêm vào whitelist và có role phù hợp

### Push Notifications không hoạt động
- Kiểm tra VAPID key đã đúng
- Kiểm tra browser hỗ trợ Push Notifications
- Kiểm tra đã cấp quyền notifications cho website

### Build bị lỗi
- Xóa `node_modules` và chạy lại `npm install`
- Xóa `.env` và tạo lại từ `.env.example`
- Kiểm tra phiên bản Node.js (yêu cầu >= 18)

## Hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra Firebase Console logs
2. Kiểm tra browser console
3. Xem lại các bước setup

## License

[Thêm license của bạn ở đây]
