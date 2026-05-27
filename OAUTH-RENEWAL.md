# Hướng dẫn gia hạn Google OAuth Token

## Khi nào cần làm?
Token hết hạn sau **7 ngày** (do app đang ở chế độ Testing trên Google Cloud).  
Triệu chứng: upload file báo lỗi `invalid_grant` hoặc `500 error`.

---

## Các bước làm thủ công

### Bước 1 — Chạy backend local
```bash
npm run server
```

### Bước 2 — Authorize lại
Mở trình duyệt, truy cập:
```
http://localhost:3001/api/auth/google
```
Đăng nhập bằng tài khoản **`phuongtt179stnpv@gmail.com`** (tài khoản lưu dữ liệu Drive).

Thấy "Authorization Successful!" là xong.

### Bước 3 — Lấy refresh token mới
File `google-oauth-tokens.json` ở thư mục gốc project sẽ được cập nhật tự động.  
Copy giá trị của field `refresh_token` (không kèm dấu ngoặc kép).

### Bước 4 — Cập nhật lên Render
1. Vào [Render Dashboard](https://dashboard.render.com)
2. Chọn service **teacher-task-backend**
3. Vào tab **Environment**
4. Tìm biến `GOOGLE_REFRESH_TOKEN` → paste giá trị mới vào
5. Bấm **Save** → Render tự restart

---

## Cách không phải làm thủ công nữa

Publish app trên Google Cloud Console → token sẽ không hết hạn sau 7 ngày.  
Xem file [OAUTH-PUBLISH.md](./OAUTH-PUBLISH.md) để biết cách làm.
