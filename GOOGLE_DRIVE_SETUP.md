# Hướng dẫn Setup Google Drive API

## Tổng quan

Hướng dẫn này sẽ giúp bạn thiết lập Google Drive API để lưu trữ và quản lý hồ sơ điện tử trong ứng dụng Teacher Task Management.

## Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Đăng nhập với tài khoản Google của bạn
3. Click vào dropdown project ở góc trên bên trái
4. Click **"NEW PROJECT"**
5. Nhập thông tin:
   - **Project name**: `Teacher Task Management` (hoặc tên bạn muốn)
   - **Location**: Để mặc định hoặc chọn organization
6. Click **"CREATE"**
7. Đợi vài giây để project được tạo

## Bước 2: Enable Google Drive API và Google Picker API

### Enable Google Drive API:
1. Trong Google Cloud Console, vào **"APIs & Services"** > **"Library"**
2. Tìm kiếm **"Google Drive API"**
3. Click vào **"Google Drive API"**
4. Click nút **"ENABLE"**

### Enable Google Picker API:
1. Quay lại **"Library"**
2. Tìm kiếm **"Google Picker API"**
3. Click vào **"Google Picker API"**
4. Click nút **"ENABLE"**

## Bước 3: Cấu hình OAuth Consent Screen

1. Vào **"APIs & Services"** > **"OAuth consent screen"**
2. Chọn **"External"** (hoặc **"Internal"** nếu bạn có Google Workspace)
3. Click **"CREATE"**

### Thông tin ứng dụng:
4. Điền các thông tin sau:
   - **App name**: `Teacher Task Management`
   - **User support email**: Email của bạn
   - **App logo**: (Tùy chọn) Upload logo của ứng dụng
   - **App domain**: (Tùy chọn)
   - **Authorized domains**: Domain của bạn (nếu có)
   - **Developer contact information**: Email của bạn
5. Click **"SAVE AND CONTINUE"**

### Scopes (Phạm vi truy cập):
6. Click **"ADD OR REMOVE SCOPES"**
7. Tìm và chọn các scope sau:
   - `https://www.googleapis.com/auth/drive.file` - Xem và quản lý file do app tạo
   - `https://www.googleapis.com/auth/drive.readonly` - Xem và tải xuống file Drive
8. Click **"UPDATE"**
9. Click **"SAVE AND CONTINUE"**

### Test users:
10. Click **"ADD USERS"**
11. Thêm email của bạn và các tester khác
12. Click **"ADD"**
13. Click **"SAVE AND CONTINUE"**

### Summary:
14. Xem lại thông tin và click **"BACK TO DASHBOARD"**

## Bước 4: Tạo OAuth 2.0 Client ID

1. Vào **"APIs & Services"** > **"Credentials"**
2. Click **"CREATE CREDENTIALS"** > **"OAuth client ID"**

### Cấu hình OAuth Client:
3. Điền thông tin:
   - **Application type**: `Web application`
   - **Name**: `Teacher Task Management Web Client`

### Authorized JavaScript origins:
4. Click **"ADD URI"** và thêm:
   - `http://localhost:5173` (cho development)
   - URL production của bạn (VD: `https://yourdomain.com`)

### Authorized redirect URIs:
5. Click **"ADD URI"** và thêm:
   - `http://localhost:5173`
   - URL production của bạn (VD: `https://yourdomain.com`)

6. Click **"CREATE"**

### Lưu thông tin:
7. Một popup sẽ hiện ra với **Client ID** và **Client secret**
8. **LƯU LẠI CLIENT ID** - bạn sẽ cần nó cho bước sau!
9. Click **"OK"**

## Bước 5: Tạo API Key

1. Vẫn ở trang **"Credentials"**, click **"CREATE CREDENTIALS"** > **"API key"**
2. Một popup sẽ hiện ra với API key
3. **LƯU LẠI API KEY**
4. Click **"RESTRICT KEY"** để bảo mật API key

### Restrict API key:
5. Trong phần **"API restrictions"**:
   - Chọn **"Restrict key"**
   - Tìm và chọn:
     - **Google Drive API**
     - **Google Picker API**
6. Click **"SAVE"**

## Bước 6: Lấy Google App ID

1. Vẫn ở Google Cloud Console
2. Vào **"IAM & Admin"** > **"Settings"**
3. Tìm **"Project number"** - đây chính là **App ID** của bạn
4. **LƯU LẠI APP ID**

## Bước 7: Cấu hình Environment Variables

1. Mở file `.env` trong project
2. Thêm các thông tin sau (đã được chuẩn bị sẵn):

```env
# Google Drive API
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key-here
VITE_GOOGLE_APP_ID=your-app-id-here
```

3. Thay thế các giá trị:
   - `your-client-id-here.apps.googleusercontent.com` → Client ID từ Bước 4
   - `your-api-key-here` → API Key từ Bước 5
   - `your-app-id-here` → App ID từ Bước 6

4. **LƯU Ý**: File `.env` không nên commit lên Git. Đảm bảo file này đã có trong `.gitignore`

## Bước 8: Cài đặt Dependencies

Các package cần thiết đã được cài đặt:
- `@react-oauth/google` - Google OAuth authentication
- `gapi-script` - Google API client library

## Bước 9: Cấu trúc Code đã được tạo

### Services:
- `src/services/googleDriveService.ts` - Service xử lý tất cả các tác vụ với Google Drive
  - Sign in/Sign out
  - Upload file
  - Delete file
  - Create folders
  - Get file metadata
  - Make file public

### Hooks:
- `src/hooks/useGoogleDrive.ts` - React hook để sử dụng Google Drive service

### Integration:
- `src/features/documents/DocumentBrowseScreen.tsx` - Đã được tích hợp với Google Drive
  - Auto sign in khi upload
  - Upload với progress bar
  - Tạo folder structure tự động (Năm học > Danh mục > Danh mục con)
  - Lưu metadata vào Firestore

## Bước 10: Test Setup

### Khởi động ứng dụng:
```bash
npm run dev
```

### Test upload:
1. Đăng nhập vào ứng dụng
2. Vào **"Hồ sơ điện tử"**
3. Chọn năm học và danh mục
4. Click **"Thêm hồ sơ"**
5. Điền tên hồ sơ và chọn file
6. Click **"Tải lên"**

### Kết quả mong đợi:
- Popup yêu cầu đăng nhập Google (lần đầu tiên)
- Hiển thị progress bar khi upload
- File được upload lên Google Drive
- Cấu trúc folder tự động tạo trên Drive
- Metadata được lưu vào Firestore
- Toast notification hiển thị thành công

### Kiểm tra trên Google Drive:
1. Vào [Google Drive](https://drive.google.com/)
2. Bạn sẽ thấy cấu trúc folder:
   ```
   Hồ sơ (hoặc Năm học 2023-2024)
   └── Hồ sơ chuyên môn
       └── Kế hoạch giáo dục
           └── file-da-upload.pdf
   ```

## Bước 11: Publish OAuth App (Sau khi test xong)

Khi ứng dụng đã sẵn sàng cho production:

1. Vào **"OAuth consent screen"**
2. Click **"PUBLISH APP"**
3. Điền thêm thông tin nếu cần
4. Submit for verification (nếu cần thiết)

**LƯU Ý**: Nếu app ở chế độ "Testing", chỉ có các test users được thêm ở Bước 3 mới có thể đăng nhập.

## Troubleshooting

### Lỗi "Access blocked: This app's request is invalid"
- Kiểm tra **Authorized JavaScript origins** và **Authorized redirect URIs** đã đúng chưa
- Đảm bảo URL trong credentials khớp với URL bạn đang chạy app

### Lỗi "The API is not enabled"
- Kiểm tra lại Bước 2, đảm bảo đã enable Google Drive API và Google Picker API

### Lỗi "Invalid client"
- Kiểm tra lại Client ID trong file `.env`
- Đảm bảo không có khoảng trắng thừa

### Upload không hoạt động
- Mở Console (F12) để xem error message chi tiết
- Kiểm tra API Key đã được restrict đúng chưa
- Đảm bảo đã sign in Google Drive

### File không hiển thị trên Drive
- Kiểm tra permissions của file
- File có thể ở trong "My Drive" của tài khoản đã authorized

## Bảo mật

### Bảo vệ credentials:
- ✅ File `.env` đã có trong `.gitignore`
- ✅ API Key đã được restrict chỉ cho Google Drive API và Google Picker API
- ✅ OAuth Client đã được restrict domain

### Best practices:
- Không share Client ID và API Key công khai
- Sử dụng environment variables khác nhau cho dev và production
- Định kỳ rotate API keys
- Monitor usage trong Google Cloud Console

## Tính năng đã implement

✅ Auto sign in to Google Drive
✅ Upload file với progress tracking
✅ Tự động tạo folder structure
✅ Make file public và lấy shareable link
✅ Lưu metadata vào Firestore
✅ Xem file trực tiếp từ Drive
✅ Download file
✅ Integration với approval workflow

## Tính năng có thể mở rộng

- 🔄 Delete file từ Google Drive khi xóa document
- 🔄 Update file (upload version mới)
- 🔄 Google Drive Picker để chọn file có sẵn trên Drive
- 🔄 Sync folder structure với categories
- 🔄 Batch upload nhiều files
- 🔄 Shared Drive support cho organization

## Liên hệ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra lại từng bước trong hướng dẫn
2. Xem error message trong Console (F12)
3. Tham khảo [Google Drive API documentation](https://developers.google.com/drive/api/guides/about-sdk)
