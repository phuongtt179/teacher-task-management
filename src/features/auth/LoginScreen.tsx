import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DevLogin } from '@/components/DevLogin';

export const LoginScreen = () => {
  const { login, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const isDev = import.meta.env.DEV; // Kiểm tra môi trường dev

  const handleLogin = async () => {
    try {
      setError(null);
      await login();
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Quản lý Công việc Giáo viên</CardTitle>
          <CardDescription>
            Đăng nhập bằng Gmail được cấp phép
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Dev Login - Chỉ hiện trong development */}
          {isDev && <DevLogin />}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleLogin} 
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
          </Button>

          <div className="text-xs text-center text-gray-500">
            Chỉ email được Admin thêm vào whitelist mới có thể đăng nhập
          </div>
        </CardContent>
      </Card>
    </div>
  );
};