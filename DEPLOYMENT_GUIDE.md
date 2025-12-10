# 🚀 HƯỚNG DẪN DEPLOY ỨNG DỤNG TEACHER-TASK-MANAGEMENT

**Platform khuyến nghị:** Render.com
**Thời gian deploy:** ~15 phút
**Chi phí:** Miễn phí (Free tier)

---

## 📋 CÁC BƯỚC CHUẨN BỊ

### 1. Push code lên GitHub

```bash
# Khởi tạo git (nếu chưa có)
git init

# Add files
git add .

# Commit
git commit -m "Initial commit - Ready for deployment"

# Tạo repository trên GitHub: https://github.com/new
# Sau đó push code:
git remote add origin https://github.com/YOUR_USERNAME/teacher-task-management.git
git branch -M main
git push -u origin main
```

### 2. Chuẩn bị Service Account Key

**QUAN TRỌNG:** Không push file `google-service-account-key.json` lên GitHub!

Đảm bảo file `.gitignore` đã có:
```
google-service-account-key.json
.env
.env.production
```

---

## 🎯 PHƯƠNG ÁN 1: DEPLOY TRÊN RENDER.COM (KHUYẾN NGHỊ)

### **A. Deploy Backend Server**

1. **Truy cập Render.com**
   - Đăng ký/đăng nhập: https://render.com
   - Kết nối GitHub account

2. **Tạo Web Service mới**
   - Click **"New +"** → **"Web Service"**
   - Chọn repository: `teacher-task-management`
   - Điền thông tin:
     ```
     Name: teacher-task-backend
     Region: Singapore (gần Việt Nam nhất)
     Branch: main
     Root Directory: (để trống)
     Runtime: Node
     Build Command: npm install
     Start Command: node server/index.js
     Instance Type: Free
     ```

3. **Thêm Environment Variables**

   Click **"Advanced"** → **"Add Environment Variable"**:

   ```
   PORT=3001
   NODE_ENV=production

   # Firebase Config (lấy từ .env)
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456:web:abc123
   VITE_FIREBASE_MEASUREMENT_ID=G-ABC123

   # Google Drive Config
   VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=your-drive-folder-id
   GOOGLE_WORKSPACE_USER_EMAIL=admin@yourdomain.com
   ```

4. **Upload Service Account Key**

   - Scroll xuống **"Secret Files"**
   - Click **"Add Secret File"**
   - Filename: `google-service-account-key.json`
   - Contents: Copy toàn bộ nội dung file `google-service-account-key.json`

5. **Deploy**
   - Click **"Create Web Service"**
   - Đợi ~5 phút build
   - Sau khi deploy xong, bạn sẽ có URL: `https://teacher-task-backend.onrender.com`

6. **Test Backend**
   ```bash
   curl https://teacher-task-backend.onrender.com/api/health

   # Kết quả mong đợi:
   {
     "status": "ok",
     "message": "Server is running",
     "driveConfigured": true,
     "rootFolderId": "configured"
   }
   ```

### **B. Deploy Frontend**

1. **Cập nhật Backend URL**

   Sửa file `src/services/googleDriveServiceBackend.ts`:
   ```typescript
   const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://teacher-task-backend.onrender.com';
   ```

2. **Thêm vào .env**
   ```
   VITE_BACKEND_URL=https://teacher-task-backend.onrender.com
   ```

3. **Commit và push**
   ```bash
   git add .
   git commit -m "Update backend URL for production"
   git push
   ```

4. **Tạo Static Site trên Render**
   - Click **"New +"** → **"Static Site"**
   - Chọn repository: `teacher-task-management`
   - Điền thông tin:
     ```
     Name: teacher-task-frontend
     Branch: main
     Build Command: npm install && npm run build
     Publish Directory: dist
     ```

5. **Thêm Environment Variables** (giống backend)

   Thêm tất cả biến VITE_* từ file `.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_FIREBASE_MEASUREMENT_ID=...
   VITE_GOOGLE_DRIVE_SHARED_DRIVE_ID=...
   VITE_BACKEND_URL=https://teacher-task-backend.onrender.com
   ```

6. **Thêm Redirect Rules**

   Tạo file `public/_redirects`:
   ```
   /*    /index.html   200
   ```

7. **Deploy**
   - Click **"Create Static Site"**
   - Đợi ~3 phút build
   - Frontend URL: `https://teacher-task-frontend.onrender.com`

### **C. Cấu hình CORS**

Sửa file `server/index.js`:

```javascript
// Cho phép frontend domain
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://teacher-task-frontend.onrender.com'
  ],
  credentials: true
}));
```

Commit và push để backend rebuild.

### **D. Cấu hình Firebase**

1. **Thêm Frontend Domain vào Firebase**
   - Truy cập Firebase Console: https://console.firebase.google.com
   - Chọn project → **Authentication** → **Settings** → **Authorized domains**
   - Thêm domain: `teacher-task-frontend.onrender.com`

2. **Kiểm tra Firestore Rules**
   - Đảm bảo rules cho phép authenticated users

---

## 🎯 PHƯƠNG ÁN 2: DEPLOY TRÊN RAILWAY.APP

### **A. Deploy cả Frontend + Backend cùng lúc**

1. **Truy cập Railway.app**
   - Đăng ký: https://railway.app
   - Click **"New Project"** → **"Deploy from GitHub repo"**

2. **Tạo 2 Services**

   **Service 1: Backend**
   ```
   Name: backend
   Root Directory: /
   Start Command: node server/index.js
   Environment Variables: (thêm tất cả biến từ .env)
   ```

   **Service 2: Frontend**
   ```
   Name: frontend
   Root Directory: /
   Build Command: npm run build
   Start Command: npx serve -s dist -p $PORT
   Environment Variables: (thêm VITE_BACKEND_URL=<backend-url>)
   ```

3. **Deploy**
   - Railway tự động deploy
   - Lấy URLs từ Settings

---

## 🎯 PHƯƠNG ÁN 3: VERCEL (Frontend) + RENDER (Backend)

### **A. Deploy Backend trên Render** (theo hướng dẫn phần 1A)

### **B. Deploy Frontend trên Vercel**

1. **Truy cập Vercel.com**
   - Đăng ký: https://vercel.com
   - Click **"Add New..."** → **"Project"**
   - Import repository: `teacher-task-management`

2. **Configure Project**
   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   ```

3. **Environment Variables**
   - Thêm tất cả biến VITE_* từ .env
   - Thêm `VITE_BACKEND_URL=https://teacher-task-backend.onrender.com`

4. **Deploy**
   - Click **"Deploy"**
   - URL: `https://teacher-task-management.vercel.app`

---

## ⚙️ AUTO-DEPLOY VỚI GITHUB

Sau khi setup xong, mỗi lần push code:

```bash
git add .
git commit -m "Update feature"
git push
```

→ Render/Railway/Vercel sẽ **tự động rebuild và deploy**!

---

## 🔍 KIỂM TRA SAU KHI DEPLOY

### 1. Test Backend
```bash
curl https://your-backend-url.onrender.com/api/health

# Kết quả:
{
  "status": "ok",
  "driveConfigured": true
}
```

### 2. Test Frontend
- Mở `https://your-frontend-url`
- Đăng nhập
- Thử tạo task
- Thử upload document
- Kiểm tra Google Drive có file không

### 3. Kiểm tra Logs
- **Render**: Dashboard → Service → Logs
- **Railway**: Dashboard → Service → Deployments → Logs
- **Vercel**: Dashboard → Deployments → Function Logs

---

## 🐛 XỬ LÝ LỖI THƯỜNG GẶP

### Lỗi 1: Backend không kết nối được Google Drive

**Nguyên nhân:** Service Account Key không đúng

**Fix:**
- Kiểm tra Secret File `google-service-account-key.json` đã upload đúng chưa
- Verify Service Account có quyền truy cập Drive folder

### Lỗi 2: CORS Error khi upload file

**Nguyên nhân:** Backend chưa allow frontend domain

**Fix:**
```javascript
// server/index.js
app.use(cors({
  origin: ['https://your-frontend-url.com'],
  credentials: true
}));
```

### Lỗi 3: Firebase Auth không hoạt động

**Nguyên nhân:** Domain chưa được authorize

**Fix:**
- Firebase Console → Authentication → Settings → Authorized domains
- Thêm domain production

### Lỗi 4: Build failed - Environment variables not found

**Nguyên nhân:** Thiếu env vars

**Fix:**
- Render/Railway/Vercel → Settings → Environment Variables
- Thêm tất cả biến từ `.env`

### Lỗi 5: Backend sleep sau 15 phút (Render Free)

**Nguyên nhân:** Free tier có sleep mode

**Solutions:**
1. **Upgrade to Paid plan** ($7/month) → Không sleep
2. **Sử dụng cron job** ping backend mỗi 10 phút:
   - Dùng cron-job.org hoặc UptimeRobot
   - Ping `https://your-backend.onrender.com/api/health` mỗi 10 phút

---

## 💰 CHI PHÍ DỰ KIẾN

### Option 1: Render (Free tier)
- Frontend: **Miễn phí** (Static site)
- Backend: **Miễn phí** (750 giờ/tháng, có sleep)
- **Total: $0/tháng**

### Option 2: Render (Paid)
- Frontend: **Miễn phí**
- Backend: **$7/tháng** (Starter plan, không sleep)
- **Total: $7/tháng**

### Option 3: Railway
- **$5 credit miễn phí/tháng** (~500 giờ)
- Sau khi hết: **$10-20/tháng** tùy usage
- **Total: $0-20/tháng**

### Option 4: Vercel + Render
- Vercel Frontend: **Miễn phí**
- Render Backend: **$0-7/tháng**
- **Total: $0-7/tháng**

---

## 📝 CHECKLIST DEPLOY

- [ ] Push code lên GitHub
- [ ] Tạo Render/Railway/Vercel account
- [ ] Deploy backend
  - [ ] Add environment variables
  - [ ] Upload Service Account Key
  - [ ] Test /api/health endpoint
- [ ] Deploy frontend
  - [ ] Add environment variables
  - [ ] Add VITE_BACKEND_URL
  - [ ] Test đăng nhập
- [ ] Cấu hình Firebase
  - [ ] Add authorized domain
  - [ ] Verify Firestore rules
- [ ] Test toàn bộ features
  - [ ] Đăng nhập/đăng xuất
  - [ ] Tạo task
  - [ ] Nộp báo cáo
  - [ ] Upload document
  - [ ] Chấm điểm
  - [ ] Xem statistics
- [ ] Setup auto-deploy từ GitHub
- [ ] Setup monitoring (optional)

---

## 🎉 HOÀN THÀNH!

Sau khi deploy xong, bạn sẽ có:
- ✅ Frontend URL: `https://your-app.onrender.com`
- ✅ Backend URL: `https://your-backend.onrender.com`
- ✅ Auto-deploy từ GitHub
- ✅ HTTPS miễn phí
- ✅ Global CDN

**Chia sẻ link cho giáo viên sử dụng!** 🚀

---

**Cần hỗ trợ?**
- Render Docs: https://render.com/docs
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
