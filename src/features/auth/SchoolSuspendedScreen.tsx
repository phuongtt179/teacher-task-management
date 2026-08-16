import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

export const SchoolSuspendedScreen = () => {
  const { suspendedSchoolName, logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
      <Card className="w-full max-w-md border-red-200">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-center text-red-600">Trường đã tạm khóa</CardTitle>
          <CardDescription className="text-center">
            {suspendedSchoolName ? <>Trường <strong>{suspendedSchoolName}</strong> hiện đang bị tạm khóa</> : 'Trường của bạn hiện đang bị tạm khóa'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Có thể do chưa hoàn tất thanh toán. Vui lòng liên hệ quản trị viên hệ thống để được mở lại quyền truy cập.
            </p>
            <Button onClick={logout} variant="outline" className="w-full">
              Đăng xuất
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
