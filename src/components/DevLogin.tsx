import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export const DevLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Quick login buttons cho test nhanh - CÓ 5 TEACHERS
  const quickLogin = async (role: string) => {
    const accounts = {
      teacher1: { email: 'teacher1@test.com', password: '123456' },
      teacher2: { email: 'teacher2@test.com', password: '123456' },
      teacher3: { email: 'teacher3@test.com', password: '123456' },
      teacher4: { email: 'teacher4@test.com', password: '123456' },
      teacher5: { email: 'teacher5@test.com', password: '123456' },
      vp: { email: 'vp@test.com', password: '123456' },
      admin: { email: 'admin@test.com', password: '123456' },
    };

    const account = accounts[role as keyof typeof accounts];
    if (account) {
      setEmail(account.email);
      setPassword(account.password);
      setLoading(true);
      try {
        await signInWithEmailAndPassword(auth, account.email, account.password);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🧪</span>
        <h3 className="font-bold text-sm">Chế Độ Test - Dev Login</h3>
      </div>

      {/* Quick Login Buttons - 5 TEACHERS */}
      <div className="space-y-2 mb-3">
        {/* Teachers Row */}
        <div className="grid grid-cols-5 gap-1">
          <Button
            onClick={() => quickLogin('teacher1')}
            variant="outline"
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 text-xs px-1"
          >
            👨‍🏫 T1
          </Button>
          <Button
            onClick={() => quickLogin('teacher2')}
            variant="outline"
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 text-xs px-1"
          >
            👩‍🏫 T2
          </Button>
          <Button
            onClick={() => quickLogin('teacher3')}
            variant="outline"
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 text-xs px-1"
          >
            👨‍🏫 T3
          </Button>
          <Button
            onClick={() => quickLogin('teacher4')}
            variant="outline"
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 text-xs px-1"
          >
            👩‍🏫 T4
          </Button>
          <Button
            onClick={() => quickLogin('teacher5')}
            variant="outline"
            size="sm"
            className="bg-blue-500 text-white hover:bg-blue-600 border-blue-600 text-xs px-1"
          >
            👨‍🏫 T5
          </Button>
        </div>

        {/* VP & Admin Row */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => quickLogin('vp')}
            variant="outline"
            size="sm"
            className="bg-purple-500 text-white hover:bg-purple-600 border-purple-600"
          >
            👔 Vice Principal
          </Button>
          <Button
            onClick={() => quickLogin('admin')}
            variant="outline"
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600 border-red-600"
          >
            ⚙️ Admin
          </Button>
        </div>
      </div>

      <div className="border-t border-yellow-300 my-3"></div>

      {/* Manual Login Form */}
      <form onSubmit={handleLogin} className="space-y-2">
        <div>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teacher1@test.com"
            className="text-sm"
            required
          />
        </div>
        <div>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="123456"
            className="text-sm"
            required
          />
        </div>
        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-3 w-3" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="w-full"
          size="sm"
          variant="secondary"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng Nhập Test'}
        </Button>
      </form>

      <p className="text-xs text-yellow-700 mt-3 text-center">
        ⚠️ Chế độ này chỉ hiển thị trong môi trường development
      </p>
    </div>
  );
};