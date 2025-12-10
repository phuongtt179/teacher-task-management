# Hướng dẫn tạo Admin User đầu tiên

## Cách 1: Thủ công qua Firebase Console (Đơn giản nhất)

### Bước 1: Chạy app và đăng nhập
```bash
npm run dev
```

Truy cập `http://localhost:5173` và đăng nhập bằng email Google bạn muốn làm admin.

### Bước 2: Tạo whitelist trong Firestore

1. Vào Firebase Console → Firestore Database
2. Click **"Start collection"**
3. Collection ID: `whitelist`
4. Document ID: `your-email@gmail.com` (thay bằng email bạn vừa đăng nhập)
5. Thêm các fields:

| Field | Type | Value |
|-------|------|-------|
| `email` | string | `your-email@gmail.com` |
| `role` | string | `admin` |
| `addedAt` | timestamp | Click "Insert timestamp" |
| `addedBy` | string | `system` |

6. Click **"Save"**

### Bước 3: Reload lại app

Reload trang web, bạn sẽ thấy giao diện Admin Dashboard.

---

## Cách 2: Dùng Firebase CLI (Nâng cao)

### Yêu cầu:
- Node.js đã cài
- Firebase CLI: `npm install -g firebase-tools`

### Các bước:

```bash
# 1. Login vào Firebase
firebase login

# 2. Chọn project
firebase use task-manager-npv

# 3. Chạy script
node scripts/add-admin.js your-email@gmail.com
```

Tạo file `scripts/add-admin.js`:

```javascript
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Khởi tạo Firebase Admin SDK
const serviceAccount = JSON.parse(
  readFileSync('./serviceAccountKey.json', 'utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addAdmin(email) {
  try {
    await db.collection('whitelist').doc(email).set({
      email: email,
      role: 'admin',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: 'system'
    });

    console.log(`✅ Đã thêm ${email} vào whitelist với role admin`);
  } catch (error) {
    console.error('❌ Lỗi:', error);
  }
}

const email = process.argv[2];
if (!email) {
  console.error('❌ Vui lòng cung cấp email: node add-admin.js email@example.com');
  process.exit(1);
}

addAdmin(email).then(() => process.exit(0));
```

**Lưu ý:** Cần tải Service Account Key từ Firebase Console:
- Project Settings → Service accounts → Generate new private key
- Lưu file dưới tên `serviceAccountKey.json` (không commit vào git!)

---

## Sau khi tạo Admin:

1. ✅ Đăng nhập vào app
2. ✅ Truy cập Admin Dashboard
3. ✅ Thêm users khác vào whitelist qua giao diện
4. ✅ Phân quyền cho Vice Principal và Teacher

---

## Troubleshooting

### Vẫn không vào được sau khi tạo whitelist?

1. Kiểm tra email trong Firestore có đúng với email đăng nhập không (phân biệt hoa thường)
2. Clear cache và cookies của browser
3. Logout và login lại
4. Kiểm tra Console (F12) xem có lỗi gì không
5. Kiểm tra Firestore Rules đã được apply chưa

### Lỗi Permission Denied?

- Kiểm tra Firestore Security Rules đã được publish
- Đảm bảo bạn đã đăng nhập (check Firebase Auth trong Console)
- Document ID phải chính xác là email của user
