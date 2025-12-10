# 👥 PHÂN CÔNG VAI TRÒ TEST

**In ra và phát cho từng người**

---

## 🎭 NGƯỜI 1: ADMIN (Bạn)

**Vai trò:** Quản trị viên hệ thống

**Nhiệm vụ:**
1. ✅ Thêm 10 email vào whitelist
2. ✅ Gán role cho từng người
3. ✅ Tạo năm học, tổ chuyên môn, danh mục
4. ✅ Monitor toàn bộ quá trình test
5. ✅ Ghi chép bugs/feedback

**Quyền hạn:**
- Quản lý người dùng
- Whitelist
- Xem tất cả tài liệu

---

## 👔 NGƯỜI 2: VICE PRINCIPAL

**Vai trò:** Hiệu trưởng

**Nhiệm vụ trong test:**
1. ✅ Tạo 2 công việc
2. ✅ Giao công việc cho giáo viên
3. ✅ Xem danh sách bài nộp
4. ✅ Chấm điểm các bài nộp
5. ✅ Xem thống kê
6. ✅ Upload tài liệu công khai

**Test cases:**
- Test Case 2: Tạo công việc
- Test Case 4: Chấm điểm
- Test Case 5C: Upload tài liệu công khai
- Test Case 6A: Xem thống kê

---

## 👨‍🏫 NGƯỜI 3: DEPARTMENT HEAD - TỔ TOÁN-LÝ

**Vai trò:** Tổ trưởng Toán-Lý

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc (như giáo viên)
2. ✅ Phê duyệt tài liệu của giáo viên trong tổ
3. ✅ Phê duyệt request xóa/sửa file
4. ✅ Test xem tài liệu tổ khác (không được)

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 5B: Phê duyệt tài liệu
- Test Case 7C: Thử xem tài liệu tổ khác
- Test Case 7D: Phê duyệt request

---

## 👨‍🏫 NGƯỜI 4: DEPARTMENT HEAD - TỔ VĂN-SỬ

**Vai trò:** Tổ trưởng Văn-Sử

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc (như giáo viên)
2. ✅ Phê duyệt tài liệu của giáo viên trong tổ
3. ✅ Nộp báo cáo

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3: Nộp báo cáo
- Test Case 5B: Phê duyệt tài liệu

---

## 👨‍🎓 NGƯỜI 5: TEACHER D (Tổ Toán-Lý)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc
2. ✅ **NỘP TRƯỚC DEADLINE 1** → Điểm 10
3. ✅ Upload tài liệu
4. ✅ Request xóa file
5. ✅ Xem điểm của mình

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3A: Nộp trước deadline (ĐIỂM 10)
- Test Case 5A: Upload tài liệu
- Test Case 6B: Xem điểm
- Test Case 7D: Request xóa file

---

## 👨‍🎓 NGƯỜI 6: TEACHER E (Tổ Toán-Lý)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc
2. ✅ **NỘP TRƯỚC DEADLINE 1** → Điểm 10
3. ✅ **THỬ NỘP LẠI** (không được)
4. ✅ Xem rankings

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3A: Nộp trước deadline (ĐIỂM 10)
- Test Case 6C: Xem rankings
- Test Case 7A: Thử nộp lại

---

## 👨‍🎓 NGƯỜI 7: TEACHER F (Tổ Toán-Lý)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc
2. ✅ **ĐỢI 5 PHÚT RỒI NỘP** (sau deadline 1) → Điểm 5

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3B: Nộp sau deadline 1 (ĐIỂM 5)

---

## 👨‍🎓 NGƯỜI 8: TEACHER G (Tổ Văn-Sử)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc
2. ⛔ **KHÔNG NỘP BÀI** (để test trường hợp quá hạn)

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3C: KHÔNG NỘP (quá hạn)

---

## 👨‍🎓 NGƯỜI 9: TEACHER H (Tổ Văn-Sử)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc
2. ⛔ **KHÔNG NỘP BÀI** (để test trường hợp quá hạn)

**Test cases:**
- Test Case 2B: Nhận công việc
- Test Case 3C: KHÔNG NỘP (quá hạn)

---

## 👨‍🎓 NGƯỜI 10: TEACHER I (Tổ Văn-Sử)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc thứ 2 (báo cáo tháng 12)
2. ✅ Xem file PDF đính kèm
3. ✅ Nộp báo cáo

**Test cases:**
- Test Case 2C: Nhận công việc có PDF
- Test Case 3: Nộp báo cáo

---

## 👨‍🎓 NGƯỜI 11: TEACHER J (Tổ Văn-Sử)

**Vai trò:** Giáo viên

**Nhiệm vụ trong test:**
1. ✅ Nhận công việc thứ 2 (báo cáo tháng 12)
2. ✅ Xem file PDF đính kèm
3. ✅ Nộp báo cáo

**Test cases:**
- Test Case 2C: Nhận công việc có PDF
- Test Case 3: Nộp báo cáo

---

## 📱 TẤT CẢ MỌI NGƯỜI

**Test Case 8: Performance Test**

### **Bước 1: Logout tất cả**
- Tất cả logout

### **Bước 2: Login đồng thời**
- Admin đếm "3, 2, 1, LOGIN!"
- Tất cả cùng click "Đăng nhập với Google"
- Ghi nhận thời gian

### **Bước 3: Load page đồng thời**
- Admin đếm "3, 2, 1, REFRESH!"
- Tất cả cùng refresh trang "Công việc của tôi"
- Ghi nhận thời gian

---

## ⏰ TIMELINE

```
00:00 - 00:10   Đăng nhập lần đầu
00:10 - 00:30   VP tạo công việc
00:30 - 00:50   Giáo viên nộp bài
00:50 - 01:00   VP chấm điểm
01:00 - 01:20   Upload & phê duyệt tài liệu
01:20 - 01:40   Xem thống kê & rankings
01:40 - 01:50   Edge cases
01:50 - 02:00   Performance test
02:00 - 02:10   Q&A
```

---

## 📝 GHI CHÚ CÁ NHÂN

**Bugs gặp phải:**
1. _______________________________
2. _______________________________
3. _______________________________

**Feedback:**
1. _______________________________
2. _______________________________
3. _______________________________

**Đánh giá UX (1-10):** ____/10

**Có dùng trong thực tế không?** ⭕ YES / ⭕ NO
