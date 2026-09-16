import { useState, useEffect } from 'react';
import { deleteDoc, doc, getDocs, query, orderBy, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { tenantCollection } from '../../lib/tenantQuery';
import { useAuth } from '../../hooks/useAuth';
import { departmentService } from '../../services/departmentService';
import { campusService } from '../../services/campusService';
import { userService } from '../../services/userService';
import { UserRole, WhitelistEmail, Department, Campus, User } from '../../types';
import { getRoleLabel, MANAGEABLE_ROLES } from '../../lib/roleLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Mail, Upload, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Nhãn lấy động qua getRoleLabel() (admin có thể đổi tên ở "Quản lý vai trò") —
// KHÔNG cache thành mảng cố định vì tên có thể đổi sau khi load trang.
const getRoleOptions = () => MANAGEABLE_ROLES.map(value => ({ value, label: getRoleLabel(value) }));
const ROLE_VALUES = new Set<UserRole>(MANAGEABLE_ROLES);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface BulkRow {
  line: number;
  email: string;
  displayName: string;
  role: UserRole | null;
  roleRaw: string;
  subject: string;
  deptRaw: string;
  departmentId: string | null;
  campusRaw: string;
  campusIds: string[];
  status: 'new' | 'update' | 'error';
  hasAccount: boolean; // đã có users/{uid} thật (từng đăng nhập) hay chưa
  error?: string;
}

// Dán từ Excel: mỗi dòng 1 người, cột cách nhau bằng Tab (copy nguyên bảng Excel
// dán vào là tự tách đúng cột). Cũng chấp nhận phẩy nếu dòng không có Tab (dán
// dạng CSV). Thứ tự cột cố định: Email, Họ tên, Vai trò, Môn dạy, Tổ, Cơ sở.
function parseBulkRow(
  rawLine: string,
  line: number,
  departments: Department[],
  campuses: Campus[],
  emailsSeenInBatch: Set<string>,
  existingEmails: Set<string>,
  existingAccountEmails: Set<string>
): BulkRow {
  const cols = (rawLine.includes('\t') ? rawLine.split('\t') : rawLine.split(',')).map(c => c.trim());
  const [emailRaw = '', nameRaw = '', roleRaw = '', subjectRaw = '', deptRaw = '', campusRaw = ''] = cols;
  const email = emailRaw.toLowerCase();

  const base = {
    line,
    email,
    displayName: nameRaw,
    roleRaw,
    subject: subjectRaw,
    deptRaw,
    departmentId: null,
    campusRaw,
    campusIds: [] as string[],
    hasAccount: existingAccountEmails.has(email),
  };

  if (!email || !EMAIL_RE.test(email)) {
    return { ...base, role: null, status: 'error', error: 'Email không hợp lệ hoặc thiếu' };
  }
  if (emailsSeenInBatch.has(email)) {
    return { ...base, role: null, status: 'error', error: 'Email bị trùng trong danh sách đang dán' };
  }
  emailsSeenInBatch.add(email);

  let role: UserRole = 'teacher';
  if (roleRaw) {
    const normalized = roleRaw.toLowerCase();
    const roleOptions = getRoleOptions(); // nhãn động, phản ánh tên đã đổi (nếu có)
    let matched = ROLE_VALUES.has(roleRaw as UserRole)
      ? (roleRaw as UserRole)
      : roleOptions.find(o => o.label.toLowerCase() === normalized)?.value;

    // Gõ tắt/thiếu chữ (vd "Tổng phụ trách" thay vì "Tổng phụ trách Đội") — chấp
    // nhận nếu chỉ khớp DUY NHẤT 1 vai trò theo kiểu chứa cụm từ.
    if (!matched) {
      const candidates = roleOptions.filter(
        o => o.label.toLowerCase().includes(normalized) || normalized.includes(o.label.toLowerCase())
      );
      if (candidates.length === 1) {
        matched = candidates[0].value;
      } else if (candidates.length > 1) {
        return {
          ...base, role: null, status: 'error',
          error: `Vai trò "${roleRaw}" không rõ — có thể là ${candidates.map(c => `"${c.label}"`).join(' hoặc ')}, ghi đầy đủ tên`,
        };
      }
    }

    if (!matched) {
      return { ...base, role: null, status: 'error', error: `Vai trò "${roleRaw}" không hợp lệ` };
    }
    role = matched;
  }

  let departmentId: string | null = null;
  if (deptRaw) {
    const match = departments.find(d => d.name.toLowerCase() === deptRaw.toLowerCase());
    if (!match) {
      return { ...base, role, status: 'error', error: `Không tìm thấy tổ "${deptRaw}"` };
    }
    departmentId = match.id;
  }

  const campusIds: string[] = [];
  if (campusRaw) {
    const names = campusRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    for (const n of names) {
      const match = campuses.find(c => c.name.toLowerCase() === n.toLowerCase());
      if (!match) {
        return { ...base, role, departmentId, status: 'error', error: `Không tìm thấy cơ sở "${n}"` };
      }
      campusIds.push(match.id);
    }
  }

  return {
    ...base,
    role,
    departmentId,
    campusIds,
    status: existingEmails.has(email) ? 'update' : 'new',
  };
}

export const WhitelistScreen = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<WhitelistEmail[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('teacher');
  const [isLoading, setIsLoading] = useState(false);
  const schoolId = user?.schoolId;

  // Nhập hàng loạt
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [existingUsers, setExistingUsers] = useState<User[]>([]);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

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

  useEffect(() => {
    if (!schoolId) return;
    departmentService.getAllDepartments(schoolId).then(setDepartments).catch(console.error);
    campusService.getAllCampuses(schoolId).then(setCampuses).catch(console.error);
    userService.getAllUsers(schoolId).then(setExistingUsers).catch(console.error);
  }, [schoolId]);

  const handlePreviewBulk = () => {
    const existingEmails = new Set(emails.map(e => e.email));
    const existingAccountEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
    const emailsSeenInBatch = new Set<string>();
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const rows = lines.map((line, i) =>
      parseBulkRow(line, i + 1, departments, campuses, emailsSeenInBatch, existingEmails, existingAccountEmails)
    );
    setBulkRows(rows);
    if (rows.length === 0) {
      toast({ variant: 'destructive', title: 'Chưa có dữ liệu', description: 'Dán ít nhất 1 dòng để xem trước' });
    }
  };

  const handleSubmitBulk = async () => {
    if (!schoolId) return;
    const validRows = bulkRows.filter(r => r.status !== 'error');
    if (validRows.length === 0) return;

    setIsBulkSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    let profileUpdateCount = 0;
    const existingWhitelistByEmail = new Map(emails.map(e => [e.email, e]));
    const existingUserByEmail = new Map(existingUsers.map(u => [u.email.toLowerCase(), u]));

    for (const row of validRows) {
      try {
        const existingWhitelist = existingWhitelistByEmail.get(row.email);
        const existingUserAccountForRole = existingUserByEmail.get(row.email);
        // Ô Vai trò để trống + người này đã có tài khoản → giữ đúng vai trò thật
        // hiện tại của họ trên whitelist, không ghi đè về mặc định "Giáo viên".
        const effectiveRole = (!row.roleRaw && existingUserAccountForRole) ? existingUserAccountForRole.role : row.role;
        const data: Record<string, any> = {
          email: row.email,
          schoolId,
          role: effectiveRole,
          addedBy: user?.email || 'admin',
          // Giữ nguyên ngày thêm ban đầu nếu đây là cập nhật, không phải mới tạo.
          addedAt: existingWhitelist?.addedAt ? Timestamp.fromDate(existingWhitelist.addedAt) : Timestamp.now(),
        };
        if (row.displayName) data.pendingDisplayName = row.displayName;
        if (row.subject) data.pendingSubject = row.subject;
        if (row.departmentId) data.pendingDepartmentId = row.departmentId;
        if (row.campusIds.length > 0) data.pendingCampusIds = row.campusIds;

        await setDoc(doc(db, 'whitelist', row.email), data);

        // Người này ĐÃ đăng nhập rồi (có users/{uid} thật) — pending* ở whitelist
        // sẽ không tự áp dụng nữa (chỉ áp dụng lúc tạo tài khoản lần đầu), nên cập
        // nhật thẳng vào hồ sơ ngay tại đây. Chỉ ghi đè field nào có dữ liệu mới,
        // không xóa mất dữ liệu cũ nếu ô tương ứng để trống.
        const existingUserAccount = existingUserByEmail.get(row.email);
        if (existingUserAccount) {
          const userUpdates: Record<string, any> = {};
          if (row.roleRaw) userUpdates.role = row.role;
          if (row.displayName) userUpdates.displayName = row.displayName;
          if (row.subject) userUpdates.subject = row.subject;
          if (row.campusIds.length > 0) {
            userUpdates.primaryCampusId = row.campusIds[0];
            userUpdates.campusIds = row.campusIds;
          }
          if (Object.keys(userUpdates).length > 0) {
            await userService.updateUser(existingUserAccount.uid, userUpdates);
            profileUpdateCount++;
          }
          if (row.departmentId) {
            await departmentService.addMember(row.departmentId, existingUserAccount.uid);
          }
        }

        successCount++;
      } catch (error) {
        console.error(`Error importing ${row.email}:`, error);
        failCount++;
      }
    }

    setIsBulkSubmitting(false);
    toast({
      title: 'Nhập hàng loạt hoàn tất',
      description: `${successCount} thành công (${profileUpdateCount} người đã có tài khoản được cập nhật hồ sơ ngay)${failCount > 0 ? `, ${failCount} lỗi` : ''}${
        bulkRows.length - validRows.length > 0 ? `, ${bulkRows.length - validRows.length} dòng bị bỏ qua do lỗi` : ''
      }`,
    });
    setBulkText('');
    setBulkRows([]);
    setShowBulkImport(false);
    loadWhitelist();
    if (schoolId) userService.getAllUsers(schoolId).then(setExistingUsers).catch(console.error);
  };

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
                {getRoleOptions().map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddEmail} disabled={isLoading}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={() => setShowBulkImport(v => !v)}>
            <Upload className="w-4 h-4 mr-2" />
            {showBulkImport ? 'Đóng nhập hàng loạt' : 'Nhập hàng loạt'}
          </Button>

          {showBulkImport && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6 space-y-3">
                <div>
                  <p className="text-sm font-medium mb-1">Dán danh sách từ Excel/Google Sheets</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Mỗi dòng 1 người, thứ tự cột: <strong>Email, Họ tên, Vai trò, Môn dạy, Tổ, Cơ sở</strong>
                    {' '}(copy nguyên bảng Excel dán vào là tự tách đúng cột; Vai trò/Môn dạy/Tổ/Cơ sở để trống nếu chưa có.
                    Cơ sở nhập nhiều thì cách nhau bằng dấu phẩy).
                  </p>
                  <Textarea
                    rows={6}
                    placeholder={'vd1@gmail.com\tNguyễn Văn A\tGiáo viên\tToán\tTổ 1\tCơ sở chính\nvd2@gmail.com\tTrần Thị B\tTổ trưởng\t\tTổ 2\tCơ sở chính, Phân hiệu 1'}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" onClick={handlePreviewBulk} disabled={!bulkText.trim()}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Xem trước
                    </Button>
                  </div>
                </div>

                {bulkRows.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {bulkRows.filter(r => r.status !== 'error').length}/{bulkRows.length} dòng hợp lệ
                      {bulkRows.some(r => r.status === 'error') && ' — dòng lỗi sẽ bị bỏ qua khi tạo'}
                    </p>
                    <div className="max-h-72 overflow-y-auto border rounded-lg bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left">#</th>
                            <th className="px-2 py-2 text-left">Email</th>
                            <th className="px-2 py-2 text-left">Họ tên</th>
                            <th className="px-2 py-2 text-left">Vai trò</th>
                            <th className="px-2 py-2 text-left">Môn dạy</th>
                            <th className="px-2 py-2 text-left">Tổ</th>
                            <th className="px-2 py-2 text-left">Cơ sở</th>
                            <th className="px-2 py-2 text-left">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bulkRows.map((row) => (
                            <tr key={row.line} className={row.status === 'error' ? 'bg-red-50' : undefined}>
                              <td className="px-2 py-2">{row.line}</td>
                              <td className="px-2 py-2">{row.email || '—'}</td>
                              <td className="px-2 py-2">{row.displayName || '—'}</td>
                              <td className="px-2 py-2">{row.role ? getRoleLabel(row.role) : '—'}</td>
                              <td className="px-2 py-2">{row.subject || '—'}</td>
                              <td className="px-2 py-2">{row.deptRaw || '—'}</td>
                              <td className="px-2 py-2">{row.campusRaw || '—'}</td>
                              <td className="px-2 py-2">
                                {row.status === 'error' ? (
                                  <span className="inline-flex items-center gap-1 text-red-600">
                                    <XCircle className="w-3 h-3" /> {row.error}
                                  </span>
                                ) : row.status === 'update' ? (
                                  <span className="inline-flex items-center gap-1 text-amber-600" title={row.hasAccount ? 'Đã có tài khoản — hồ sơ được cập nhật ngay' : 'Chỉ mới có trong whitelist, chưa từng đăng nhập — áp dụng khi đăng nhập lần đầu'}>
                                    <CheckCircle2 className="w-3 h-3" />
                                    {row.hasAccount ? 'Cập nhật hồ sơ ngay' : 'Cập nhật whitelist (chưa đăng nhập)'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="w-3 h-3" /> Mới
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Button
                      onClick={handleSubmitBulk}
                      disabled={isBulkSubmitting || bulkRows.every(r => r.status === 'error')}
                    >
                      {isBulkSubmitting
                        ? 'Đang tạo...'
                        : `Tạo hàng loạt (${bulkRows.filter(r => r.status !== 'error').length})`}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                            ({getRoleLabel(item.role)})
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