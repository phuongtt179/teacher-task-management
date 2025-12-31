# Hướng dẫn Thay đổi Tài khoản Google Drive

## 📋 Tổng quan

Hệ thống hiện đang sử dụng **Google Service Account** để upload file lên Google Drive.

**Cấu hình hiện tại:**
- 📧 Email workspace: `admin@thnguyenphanvinh-danang.edu.vn`
- 📁 Folder ID hiện tại: `1tHS4NdktiC_QmbyANEciNMHDHkwLm2Sd`
- 🔑 File key: `google-service-account-key.json`

---

## 🎯 Mục tiêu

Thay đổi tài khoản Google Drive để lưu trữ hồ sơ từ tài khoản cũ sang tài khoản mới.

**2 phương án:**
1. **Phương án A:** Đổi sang tài khoản Google Workspace khác (có domain riêng)
2. **Phương án B:** Đổi sang tài khoản Gmail cá nhân (không có domain)

---

# PHƯƠNG ÁN A: Đổi sang Google Workspace mới

## 📌 Điều kiện tiên quyết

- ✅ Có tài khoản **Google Workspace** (G Suite) với domain riêng
- ✅ Có quyền **Super Admin** trên Workspace
- ✅ Biết cách truy cập **Google Cloud Console**

---

## BƯỚC 1: Tạo Service Account mới

### 1.1. Truy cập Google Cloud Console

1. Mở trình duyệt, đăng nhập tài khoản **Super Admin** của Workspace mới
2. Truy cập: https://console.cloud.google.com
3. Chọn hoặc tạo **Project mới**:
   - Click dropdown ở góc trên bên trái
   - Click **"New Project"**
   - Tên project: VD `teacher-task-management`
   - Click **"Create"**

### 1.2. Bật Google Drive API

1. Trong Project vừa tạo, vào menu **APIs & Services** → **Library**
2. Tìm kiếm: `Google Drive API`
3. Click vào kết quả **Google Drive API**
4. Click nút **"Enable"**
5. Đợi vài giây để API được bật

### 1.3. Tạo Service Account

1. Vào menu **APIs & Services** → **Credentials**
2. Click nút **"+ Create Credentials"** → Chọn **"Service Account"**
3. **Điền thông tin:**
   - **Service account name**: `drive-uploader`
   - **Service account ID**: Tự động tạo (VD: `drive-uploader@project-id.iam.gserviceaccount.com`)
   - **Description**: `Service account for uploading files to Google Drive`
4. Click **"Create and Continue"**
5. **Grant permissions (bỏ qua):**
   - Click **"Continue"** (không cần chọn role)
6. **Grant users access (bỏ qua):**
   - Click **"Done"**

### 1.4. Tạo và tải Key JSON

1. Trong danh sách **Service Accounts**, click vào service account vừa tạo
2. Chọn tab **"Keys"**
3. Click **"Add Key"** → **"Create new key"**
4. Chọn **Key type: JSON**
5. Click **"Create"**
6. File JSON sẽ tự động tải về máy (VD: `project-id-xxxxxxxxx.json`)
7. **LƯU GIỮ FILE NÀY CẨN THẬN!** (Không chia sẻ cho ai)

---

## BƯỚC 2: Cấu hình Domain-Wide Delegation

### 2.1. Lấy Client ID

1. Trong Service Account vừa tạo, tab **"Details"**
2. Copy **"Client ID"** (dãy số dài, VD: `1234567890123456789`)
3. Lưu lại để dùng ở bước tiếp theo

### 2.2. Cấu hình trong Google Workspace Admin

1. Truy cập: https://admin.google.com
2. Đăng nhập bằng tài khoản **Super Admin**
3. Vào **Security** → **Access and data control** → **API controls**
4. Click **"Manage Domain Wide Delegation"**
5. Click **"Add new"**
6. **Điền thông tin:**
   - **Client ID**: Paste Client ID từ bước 2.1
   - **OAuth Scopes**:
     ```
     https://www.googleapis.com/auth/drive
     ```
   - (Chỉ cần scope Drive thôi, mỗi scope 1 dòng)
7. Click **"Authorize"**

**Giải thích:** Bước này cho phép Service Account "giả làm" user trong domain để upload file.

---

## BƯỚC 3: Tạo Folder trên Google Drive

### 3.1. Đăng nhập Google Drive

1. Đăng nhập tài khoản Workspace admin (VD: `admin@tenmien.edu.vn`)
2. Truy cập: https://drive.google.com
3. Click **"My Drive"** hoặc **"Shared drives"** (nếu muốn dùng Shared Drive)

### 3.2. Tạo thư mục gốc

1. Click chuột phải → **"New folder"**
2. Đặt tên: VD `Teacher Documents` hoặc `Hồ sơ giáo viên`
3. Click **"Create"**

### 3.3. Lấy Folder ID

1. Mở folder vừa tạo
2. Nhìn vào URL trên thanh địa chỉ:
   ```
   https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXXXXX
   ```
3. **Copy phần XXXXXXXXXXXXXXXXXXXXX** (đây là Folder ID)
4. VD: `1tHS4NdktiC_QmbyANEciNMHDHkwLm2Sd`

### 3.4. Chia sẻ folder cho Service Account (Tùy chọn)

**Chỉ cần nếu không dùng domain-wide delegation:**

1. Click chuột phải vào folder → **"Share"**
2. Nhập email Service Account (VD: `drive-uploader@project-id.iam.gserviceaccount.com`)
3. Chọn quyền: **"Editor"**
4. Bỏ tick **"Notify people"**
5. Click **"Share"**

---

## BƯỚC 4: Cập nhật File Key trong Dự án

### 4.1. Backup file cũ

```bash
# Đổi tên file cũ để backup
mv google-service-account-key.json google-service-account-key.json.backup
```

### 4.2. Copy file key mới

1. Đổi tên file JSON vừa tải về thành: `google-service-account-key.json`
2. Copy file này vào thư mục gốc của dự án
   ```bash
   # Windows
   copy "C:\Downloads\project-id-xxxxxxxxx.json" google-service-account-key.json

   # Linux/Mac
   cp ~/Downloads/project-id-xxxxxxxxx.json google-service-account-key.json
   ```

### 4.3. Kiểm tra file

```bash
# Kiểm tra file tồn tại
ls -la google-service-account-key.json

# Xem nội dung (không share cho ai!)
cat google-service-account-key.json
```

**File phải có cấu trúc:**
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "drive-uploader@....iam.gserviceaccount.com",
  "client_id": "...",
  ...
}
```

---

## BƯỚC 5: Cập nhật biến môi trường (.env)

### 5.1. Mở file .env

```bash
# Mở bằng editor
notepad .env    # Windows
nano .env       # Linux
code .env       # VS Code
```

### 5.2. Thay đổi các giá trị

```env
# Folder ID mới (từ Bước 3.3)
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=XXXXXXXXXXXXXXXXXXXXX

# Email workspace admin (user để service account "giả làm")
GOOGLE_WORKSPACE_USER_EMAIL=admin@tenmien-moi.edu.vn
```

**Ví dụ cụ thể:**
```env
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ
GOOGLE_WORKSPACE_USER_EMAIL=admin@truongmoi.edu.vn
```

### 5.3. Lưu file

- Nhấn `Ctrl + S` để lưu
- Đóng editor

---

## BƯỚC 6: Kiểm tra và Test

### 6.1. Khởi động lại Backend

```bash
# Dừng server nếu đang chạy (Ctrl + C)

# Khởi động lại
npm run server
```

**Kiểm tra log:**
```
✅ Google Drive API initialized successfully (using JWT)
📧 Service Account: drive-uploader@project-id.iam.gserviceaccount.com
👤 Impersonating user: admin@truongmoi.edu.vn
✅ JWT Client authorized successfully
🚀 Server running on http://localhost:3001
📁 Root Folder ID: configured
🔑 Service Account Key: Found
```

**Nếu thấy lỗi:**
- ❌ `Private key not found`: File JSON bị lỗi, tải lại
- ❌ `JWT Client authorization failed`: Domain-wide delegation chưa đúng, kiểm tra lại Bước 2
- ❌ `Service Account Key: NOT FOUND`: File không đúng vị trí

### 6.2. Test upload file

1. Mở app frontend (nếu chưa chạy):
   ```bash
   npm run dev
   ```
2. Đăng nhập với tài khoản giáo viên
3. Thử upload 1 file hồ sơ
4. Kiểm tra xem file có xuất hiện trong Google Drive không

### 6.3. Kiểm tra trên Google Drive

1. Đăng nhập: https://drive.google.com (tài khoản admin mới)
2. Mở folder gốc đã tạo (VD: `Teacher Documents`)
3. Kiểm tra cấu trúc folder:
   ```
   Teacher Documents/
     └── 2024-2025/
         └── Giáo án/
             └── Tổ 1 - Toán Lý/
                 └── Nguyễn Văn A/
                     └── Giáo án Toán 10/
                         └── file.pdf
   ```

---

## BƯỚC 7: Deploy lên Render.com

### 7.1. Cập nhật file lên Git

```bash
# Stage thay đổi
git add .env google-service-account-key.json

# HOẶC nếu không muốn commit file nhạy cảm:
# Chỉ commit .env (đã có trong .gitignore)
# Upload file key thủ công lên server
```

### 7.2. Cập nhật Environment Variables trên Render

1. Vào dashboard Render.com
2. Chọn service của bạn
3. Vào **Environment** tab
4. Cập nhật các biến:
   - `VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID`: Folder ID mới
   - `GOOGLE_WORKSPACE_USER_EMAIL`: Email admin mới

### 7.3. Upload Service Account Key

**Cách 1: Qua Render Dashboard (không khuyến khích - không bảo mật)**
- Tạo biến môi trường `GOOGLE_SERVICE_ACCOUNT_KEY`
- Copy toàn bộ nội dung file JSON vào giá trị

**Cách 2: SSH vào server (khuyến khích)**
1. Vào Render Dashboard → Shell tab
2. Tạo file:
   ```bash
   nano google-service-account-key.json
   ```
3. Paste nội dung file JSON
4. Save: `Ctrl + X`, `Y`, `Enter`

**Cách 3: Dùng Render Secret Files (tốt nhất)**
1. Vào **Settings** → **Secret Files**
2. Click **"Add Secret File"**
3. Filename: `google-service-account-key.json`
4. Contents: Paste toàn bộ nội dung file JSON
5. Click **"Save"**

### 7.4. Redeploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Hoặc push code lên Git để tự động deploy
3. Đợi deploy xong
4. Test lại trên production

---

# PHƯƠNG ÁN B: Đổi sang Gmail cá nhân

## ⚠️ Lưu ý

Gmail cá nhân **KHÔNG hỗ trợ Domain-Wide Delegation**, nên:
- Phải share folder trực tiếp cho Service Account
- Service Account upload file vào folder được share

## BƯỚC 1-3: Giống Phương án A

Làm theo **Bước 1-3** của Phương án A (tạo Service Account, tạo key, tạo folder)

**Khác biệt:**
- Không cần làm **Bước 2** (Domain-Wide Delegation)
- Project có thể tạo bằng bất kỳ tài khoản Google nào

---

## BƯỚC 4: Chia sẻ Folder cho Service Account

### 4.1. Lấy email Service Account

1. Mở file `google-service-account-key.json`
2. Tìm dòng `"client_email"`:
   ```json
   "client_email": "drive-uploader@project-id.iam.gserviceaccount.com"
   ```
3. Copy email này

### 4.2. Share folder

1. Truy cập: https://drive.google.com
2. Tìm folder gốc (VD: `Teacher Documents`)
3. Click chuột phải → **"Share"**
4. Paste email Service Account vào ô **"Add people and groups"**
5. Chọn quyền: **"Editor"**
6. **BỎ TICK** "Notify people" (không cần gửi email)
7. Click **"Share"**

---

## BƯỚC 5-7: Giống Phương án A

### KHÁC BIỆT quan trọng:

Trong file `.env`, **BỎ TRỐNG** biến `GOOGLE_WORKSPACE_USER_EMAIL`:

```env
# Folder ID
VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=1aBcDeFgHiJkLmNoPqRsTuVwXyZ

# Để trống (không dùng domain-wide delegation)
GOOGLE_WORKSPACE_USER_EMAIL=
```

**Hoặc xóa dòng này đi:**
```env
# GOOGLE_WORKSPACE_USER_EMAIL=
```

---

# ❓ Câu hỏi thường gặp

## Q1: Tại sao cần Domain-Wide Delegation?

**A:** Để Service Account có thể "giả làm" user trong domain và upload file như thể user đó đang upload. Điều này giúp:
- File thuộc về user thật (không phải Service Account)
- Dễ quản lý quyền
- Phù hợp với Google Workspace

## Q2: Có thể dùng nhiều Folder ID không?

**A:** Có thể, nhưng hiện tại hệ thống chỉ hỗ trợ 1 folder gốc. Nếu muốn nhiều folder, cần sửa code.

## Q3: File cũ ở Drive cũ có bị mất không?

**A:** KHÔNG. File cũ vẫn ở Drive cũ. Hệ thống chỉ upload file mới vào Drive mới từ thời điểm thay đổi.

## Q4: Có thể migrate file cũ sang Drive mới không?

**A:** Có thể bằng cách:
1. Tải toàn bộ folder cũ về máy (Google Takeout)
2. Upload lên folder mới
3. Hoặc dùng Google Drive desktop app để sync

## Q5: Service Account Key bị lộ thì sao?

**A:** NGUY HIỂM! Ai có key này có thể upload/xóa file. Cần:
1. Xóa ngay Service Account cũ
2. Tạo Service Account mới
3. Tạo key mới
4. Cập nhật vào hệ thống

## Q6: Quota upload có giới hạn không?

**A:** Có. Google Drive có giới hạn:
- **Workspace Business Standard**: 2TB/user
- **Gmail miễn phí**: 15GB tổng (Drive + Gmail + Photos)
- **Bandwidth**: 750GB/ngày upload limit

## Q7: Làm sao kiểm tra Service Account đang hoạt động?

**A:** Xem log server khi khởi động:
```bash
npm run server
```
Nếu thấy:
```
✅ Google Drive API initialized successfully
✅ JWT Client authorized successfully
```
→ OK!

---

# 🔒 Bảo mật

## ⚠️ QUAN TRỌNG - Không được làm:

1. ❌ KHÔNG commit file `google-service-account-key.json` lên Git public
2. ❌ KHÔNG chia sẻ file key cho ai
3. ❌ KHÔNG để file key trong folder public trên server
4. ❌ KHÔNG gửi key qua email/chat

## ✅ NÊN làm:

1. ✅ Thêm `google-service-account-key.json` vào `.gitignore`
2. ✅ Dùng Render Secret Files để lưu key
3. ✅ Định kỳ rotate key (tạo key mới, xóa key cũ) mỗi 6 tháng
4. ✅ Giới hạn scope chỉ `drive` (không cần thêm scope khác)
5. ✅ Kiểm tra log thường xuyên để phát hiện hoạt động bất thường

---

# 📞 Liên hệ hỗ trợ

Nếu gặp vấn đề:
1. Kiểm tra lại từng bước
2. Xem log server (`npm run server`)
3. Xem log browser console (F12 → Console tab)
4. Liên hệ IT support

**Log quan trọng:**
- Backend: Console khi chạy `npm run server`
- Frontend: Browser DevTools → Console tab
- Network: Browser DevTools → Network tab

---

# 🎓 Tổng kết

**Checklist hoàn thành:**
- [ ] Tạo Service Account mới
- [ ] Tải key JSON
- [ ] Cấu hình Domain-Wide Delegation (nếu Workspace)
- [ ] Tạo folder trên Drive
- [ ] Lấy Folder ID
- [ ] Share folder (nếu Gmail cá nhân)
- [ ] Cập nhật file key trong dự án
- [ ] Cập nhật `.env`
- [ ] Test local
- [ ] Deploy lên Render
- [ ] Test production

**Thời gian ước tính:**
- Phương án A (Workspace): 30-45 phút
- Phương án B (Gmail): 20-30 phút

**Nếu thành công:**
- File upload sẽ xuất hiện trong folder mới
- Log không có lỗi
- Giáo viên có thể xem file trên Google Drive

Chúc bạn thành công! 🎉
