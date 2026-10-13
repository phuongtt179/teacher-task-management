# Chạy thử app với Firebase Emulator (không tốn quota, không đụng dữ liệu thật)

Dự án giả `demo-ttm`: Firebase bảo đảm dự án "demo-…" không bao giờ kết nối tới máy chủ thật.
Server ở chế độ này **không** tải file lên Google Drive (trả file giả).

## Chạy (4 cửa sổ dòng lệnh)

1. `npm run emulators` — Firestore (8080) + Auth (9099), giao diện xem dữ liệu http://localhost:4000
2. `npm run seed:emulator` — tạo dữ liệu giả đúng quy mô trường (~92 người, 7 tổ, 36 tuần, ~2.100 hồ sơ…)
3. `npm run server:emulator` — API ở http://localhost:3001 (có `GET /api/dev/reads` đếm lượt đọc của server)
4. `npm run dev:emulator` — app ở http://localhost:5173 (đọc `.env.emulator`)

Đăng nhập: trong DevTools gọi `__devLogin(token)` với custom token tạo từ Admin SDK (xem measure.mjs),
hoặc dùng kịch bản đo tự động bên dưới.

## Đo lượt đọc từng thao tác

Đo trên bản build giống production (bản dev của React chạy hiệu ứng 2 lần nên số bị phóng đại):

```
npx vite build --mode emulator --outDir dist-emulator
npx vite preview --mode emulator --outDir dist-emulator --port 5173
npm i --no-save puppeteer-core
node scripts/emulator/measure.mjs . teacher head vp
```

Mỗi dòng in: số lượt đọc phía trình duyệt (và số truy vấn — trên Firebase thật mỗi truy vấn còn tốn
thêm ~2 lượt đọc kiểm tra quyền trong firestore.rules) + số lượt đọc của server, kèm chi tiết theo bảng.
