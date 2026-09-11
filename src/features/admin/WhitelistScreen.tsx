import { useState, useEffect } from 'react';
import { deleteDoc, doc, getDocs, query, orderBy, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { tenantCollection } from '../../lib/tenantQuery';
import { useAuth } from '../../hooks/useAuth';
import { UserRole, WhitelistEmail } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Mail } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'teacher', label: 'Giáo viên' },
  { value: 'department_head', label: 'Tổ trưởng' },
  { value: 'deputy_department_head', label: 'Tổ phó' },
  { value: 'vice_principal', label: 'Hiệu phó' },
  { value: 'youth_leader', label: 'Tổng phụ trách Đội' },
  { value: 'principal', label: 'Hiệu trưởng' },
  { value: 'staff', label: 'Nhân viên' },
  { value: 'van_thu', label: 'Văn thư' },
  { value: 'admin', label: 'Admin' },
];

export const WhitelistScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<WhitelistEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [isLoading, setIsLoading] = useState(false);
  const schoolId = user?.schoolId;

  // Load whitelist for this school only
  const loadWhitelist = async () => {
    if (!schoolId) return;
    try {
      const q = query(tenantCollection('whitelist', schoolId), orderBy('addedAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        addedAt: doc.data().addedAt?.toDate(),
      })) as WhitelistEmail[];
      setEmails(data);
    } catch (error) {
      console.error('Error loading whitelist:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải danh sách whitelist',
      });
    }
  };

  useEffect(() => {
    loadWhitelist();
  }, [schoolId]);

  // Add email to whitelist — doc ID is the email itself (matches firestore.rules
  // and userService.addToWhitelist's convention).
  const handleAddEmail = async () => {
    if (!newEmail.trim() || !schoolId) return;

    // Validate email
    if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      toast({
        variant: 'destructive',
        title: 'Email không hợp lệ',
        description: 'Vui lòng nhập đúng định dạng email',
      });
      return;
    }

    const emailLower = newEmail.toLowerCase();

    // Check duplicate
    if (emails.some(e => e.email === emailLower)) {
      toast({
        variant: 'destructive',
        title: 'Email đã tồn tại',
        description: 'Email này đã có trong whitelist',
      });
      return;
    }

    setIsLoading(true);
    try {
      await setDoc(doc(db, 'whitelist', emailLower), {
        email: emailLower,
        schoolId,
        role: newRole,
        addedBy: user?.email || 'admin',
        addedAt: Timestamp.now(),
      });

      toast({
        title: 'Thành công',
        description: `Đã thêm ${newEmail} vào whitelist`,
      });

      setNewEmail('');
      loadWhitelist();
    } catch (error) {
      console.error('Error adding email:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể thêm email',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Remove email from whitelist (doc ID == id == email)
  const handleRemoveEmail = async (id: string, email: string) => {
    if (!confirm(`Xóa ${email} khỏi whitelist?`)) return;

    try {
      await deleteDoc(doc(db, 'whitelist', id));
      toast({
        title: 'Đã xóa',
        description: `${email} đã được xóa khỏi whitelist`,
      });
      loadWhitelist();
    } catch (error) {
      console.error('Error removing email:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể xóa email',
      });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý Whitelist Gmail</CardTitle>
          <CardDescription>
            Chỉ những email trong danh sách này mới được phép đăng nhập hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new email */}
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Nhập email cần thêm..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
            />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddEmail} disabled={isLoading}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm
            </Button>
          </div>

          {/* Email list */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-gray-600">
              Danh sách email ({emails.length})
            </h3>
            
            {emails.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Mail className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có email nào trong whitelist</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {emails.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium">
                        {item.email}
                        {item.role && (
                          <span className="ml-2 text-xs text-gray-500">
                            ({ROLE_OPTIONS.find(o => o.value === item.role)?.label || item.role})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        Thêm bởi {item.addedBy} • {item.addedAt?.toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEmail(item.id, item.email)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Demo emails suggestion */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-semibold mb-2 text-blue-900">💡 Email mẫu để test:</h4>
          <ul className="text-sm space-y-1 text-blue-800">
            <li>• [email protected] (Admin)</li>
            <li>• [email protected] (Hiệu trưởng)</li>
            <li>• [email protected] (Giáo viên 1)</li>
            <li>• [email protected] (Giáo viên 2)</li>
            <li>• [email protected] (Giáo viên 3)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};