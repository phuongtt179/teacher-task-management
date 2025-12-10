# Quick Start - Setup Nhanh

Hướng dẫn setup nhanh cho dự án Teacher Task Management.

## Bước 1: Cài đặt Dependencies

```bash
npm install
```

## Bước 2: Tạo Firebase Project

1. Truy cập [Firebase Console](https://console.firebase.google.com/)
2. Tạo project mới
3. Thêm Web App và lưu lại Firebase Config
4. Bật các services:
   - **Authentication** → Google Sign-in
   - **Firestore Database**
   - **Cloud Messaging** → Lấy VAPID Key

## Bước 3: Cấu hình Environment Variables

```bash
# Copy file .env.example
cp .env.example .env

# Mở .env và điền thông tin Firebase
# VITE_FIREBASE_API_KEY=...
# VITE_FIREBASE_AUTH_DOMAIN=...
# VITE_FIREBASE_PROJECT_ID=...
# VITE_FIREBASE_STORAGE_BUCKET=...
# VITE_FIREBASE_MESSAGING_SENDER_ID=...
# VITE_FIREBASE_APP_ID=...
# VITE_FIREBASE_VAPID_KEY=...
```

## Bước 4: Update Service Worker Config

```bash
# Chạy script tự động cập nhật config vào service worker
npm run setup:firebase
```

## Bước 5: Thiết lập Firestore Rules

Vào Firebase Console > Firestore Database > Rules, copy rules từ file [SETUP.md](./SETUP.md#34-thiết-lập-firestore-security-rules)

## Bước 6: Tạo Admin User

1. Chạy app: `npm run dev`
2. Đăng nhập bằng Google
3. Vào Firestore Console, tạo document trong collection `whitelist`:
   - Document ID: `your-email@gmail.com`
   - Fields:
     ```
     email: "your-email@gmail.com"
     role: "admin"
     addedAt: [timestamp]
     addedBy: "system"
     ```

## Bước 7: Chạy Ứng Dụng

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview
```

## Tóm tắt Commands

```bash
npm install                  # Cài dependencies
cp .env.example .env        # Tạo file .env
npm run setup:firebase      # Cập nhật service worker config
npm run dev                 # Chạy development server
npm run build               # Build production
npm run preview             # Preview production build
```

## Lưu ý quan trọng

- ✅ Luôn chạy `npm run setup:firebase` sau khi thay đổi Firebase config trong `.env`
- ✅ File `.env` không được commit vào git (đã có trong .gitignore)
- ✅ Nhớ setup Firestore Security Rules trước khi deploy production
- ✅ Tạo admin user trước khi sử dụng các chức năng quản lý

## Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| Không đăng nhập được | Kiểm tra Google Sign-in đã bật trong Firebase |
| Permission denied Firestore | Kiểm tra Security Rules và whitelist |
| Push notifications không hoạt động | Kiểm tra VAPID key và đã chạy `setup:firebase` |

## Hỗ trợ

Xem hướng dẫn chi tiết tại [SETUP.md](./SETUP.md)
