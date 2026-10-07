// Dùng chung ĐÚNG 1 bộ thông báo với <Toaster /> (src/components/ui/use-toast.ts).
// Trước đây file này là 1 bản sao riêng có kho dữ liệu riêng, nên mọi thông báo gửi
// qua "@/hooks/use-toast" (Hồ sơ cá nhân, Hồ sơ điện tử, Duyệt hồ sơ, Quản lý user,
// Cấu hình hồ sơ, Trợ lý AI...) không bao giờ hiện lên — vd bấm Lưu không thấy phản hồi.
export { useToast, toast } from '@/components/ui/use-toast';
