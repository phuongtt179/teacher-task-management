# Prompt chuyển văn bản phân công sang dạng cấu trúc

## Cách dùng
1. Copy toàn bộ phần **PROMPT** bên dưới
2. Thay `[DÁN VĂN BẢN VÀO ĐÂY]` bằng nội dung copy từ Word
3. Gửi cho ChatGPT / Gemini / Claude
4. Kiểm tra và điền họ tên đầy đủ vào những chỗ có `[?]`
5. Copy kết quả → paste vào ứng dụng → bấm **"Phân tích bằng AI"**

---

## Lưu ý khi soạn văn bản phân công gốc

Để không phải sửa tay, ban giám hiệu nên ghi **họ tên đầy đủ** ngay trong văn bản:

| ❌ Không nên | ✅ Nên viết |
|---|---|
| Cô Bình | Ngô Thị Bình |
| Thầy Phương | Bùi Nguyên Phương |
| Tổ cấp dưỡng | Nguyễn Thị Ánh, Trần Thị Nhạn |
| Giáo viên nam | Bùi Nguyên Phương, Nguyễn Văn Công |
| GVCN | Liệt kê từng người cụ thể |
| Bí thư chi đoàn | Tên người đảm nhận vai trò đó |

---

## PROMPT

```
Bạn là trợ lý chuyển đổi văn bản phân công công việc của trường học Việt Nam.

Tôi sẽ dán văn bản phân công gốc (từ file Word), nhiệm vụ của bạn là chuyển sang dạng danh sách có cấu trúc chuẩn.

QUY TẮC CHUYỂN ĐỔI:
1. Gom các công việc liên quan thành 1 nhiệm vụ có ý nghĩa (không tách quá nhỏ lẻ)
2. Với mỗi nhiệm vụ, liệt kê ĐẦY ĐỦ họ tên từng người phụ trách (nếu trong văn bản chỉ ghi tên gọi tắt như "cô Bình", hãy giữ nguyên và đánh dấu [?] để tôi điền họ tên đầy đủ sau)
3. KHÔNG dùng chức danh nhóm như "tổ cấp dưỡng", "giáo viên nam", "GVCN", "bí thư chi đoàn" — thay bằng tên người cụ thể nếu có trong văn bản
4. Xác định deadline rõ ràng (định dạng DD/MM/YYYY)
5. Đánh giá mức ưu tiên: Cao / Trung bình / Thấp

FORMAT ĐẦU RA (giữ đúng format này):

[Số thứ tự]. [Tên công việc ngắn gọn]
   - Người thực hiện: [Họ tên 1], [Họ tên 2], ...
   - Deadline: DD/MM/YYYY
   - Ưu tiên: Cao / Trung bình / Thấp
   - Mô tả: [Tóm tắt nội dung nếu cần]

---
VĂN BẢN GỐC:
[DÁN VĂN BẢN VÀO ĐÂY]
```
