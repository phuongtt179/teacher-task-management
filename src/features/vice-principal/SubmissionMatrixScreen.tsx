import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { schoolYearService } from '../../services/schoolYearService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { documentTypeService } from '../../services/documentTypeService';
import { departmentService } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { submissionSummaryService, NO_SUBCATEGORY_KEY, type SubmissionSummary } from '../../services/submissionSummaryService';
import { DocumentCategory, DocumentSubCategory, Department, DocumentType, User } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Table as TableIcon } from 'lucide-react';

// Khi loại hồ sơ không giới hạn người nộp: coi giáo viên/tổ trưởng/tổ phó là người phải nộp.
const DEFAULT_SUBMITTER_ROLES = ['teacher', 'department_head', 'deputy_department_head'];

interface Column { key: string; name: string }
interface Row { uid: string; name: string; done: Set<string>; count: number }

/**
 * Theo dõi nộp hồ sơ — ✓/✗ theo từng người, từng mục con (tuần) của 1 danh mục.
 *
 * Dữ liệu nộp lấy từ bảng tổng hợp server lưu sẵn (submissionSummaryService, ~1 lượt
 * đọc/danh mục); danh mục, mục con, tổ, người dùng lấy từ bộ nhớ tạm 3 giờ trên máy.
 * BGH/admin thấy cả trường; tổ trưởng/tổ phó chỉ thấy thành viên tổ mình (server lọc).
 */
export const SubmissionMatrixScreen = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const [schoolYearId, setSchoolYearId] = useState('');
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [users, setUsers] = useState<User[]>([]);

  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState('');

  // Dữ liệu nền: năm học hiện tại, danh mục, loại hồ sơ, tổ, người dùng (đều từ bộ nhớ tạm).
  useEffect(() => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        const activeYear = await schoolYearService.getActiveSchoolYear(schoolId);
        if (!activeYear) return;
        setSchoolYearId(activeYear.id);

        const [cats, types, depts, allUsers] = await Promise.all([
          documentCategoryService.getCategoriesBySchoolYear(schoolId, activeYear.id),
          documentTypeService.getAllDocumentTypes(schoolId),
          departmentService.getAllDepartments(schoolId),
          userService.getAllUsersCached(schoolId),
        ]);
        const sorted = [...cats].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'vi'));
        setCategories(sorted);
        setDocumentTypes(types);
        setDepartments(depts);
        setUsers(allUsers.filter(u => u.isActive !== false));

        const prefer = sorted.find(c => c.name.toLowerCase().includes('kế hoạch bài dạy'))
          || sorted.find(c => c.name.toLowerCase().includes('giáo án'));
        setSelectedCategoryId((prefer || sorted[0])?.id || '');
      } catch (e) {
        console.error('Error loading matrix base data:', e);
        setError('Không tải được dữ liệu. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  // Đổi danh mục → mục con (bộ nhớ tạm) + bảng tổng hợp (server).
  useEffect(() => {
    if (!schoolId || !selectedCategoryId) {
      setSubCategories([]);
      setSummary(null);
      return;
    }
    let active = true;
    const loadMatrix = async () => {
      try {
        setLoadingMatrix(true);
        setError('');
        const category = categories.find(c => c.id === selectedCategoryId);
        const [subs, sum] = await Promise.all([
          category?.hasSubCategories ? documentCategoryService.getSubCategories(schoolId, selectedCategoryId) : Promise.resolve([]),
          submissionSummaryService.get(selectedCategoryId),
        ]);
        if (!active) return;
        setSubCategories([...subs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        setSummary(sum);
      } catch (e) {
        console.error('Error loading matrix:', e);
        if (active) setError('Không tải được bảng theo dõi. Vui lòng thử lại.');
      } finally {
        if (active) setLoadingMatrix(false);
      }
    };
    loadMatrix();
    return () => { active = false; };
  }, [schoolId, selectedCategoryId, categories]);

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  // Cột: các mục con (tuần) — danh mục không có mục con thì 1 cột "Đã nộp".
  const columns: Column[] = useMemo(() => {
    if (selectedCategory?.hasSubCategories) return subCategories.map(s => ({ key: s.id, name: s.name }));
    return [{ key: NO_SUBCATEGORY_KEY, name: 'Đã nộp' }];
  }, [selectedCategory, subCategories]);

  // Tổ trưởng/tổ phó: chỉ các tổ mình phụ trách (server trả về departmentIds).
  const visibleDepartments = useMemo(() => {
    if (summary?.scope !== 'department') return departments;
    const mine = new Set(summary.departmentIds || []);
    return departments.filter(d => mine.has(d.id));
  }, [departments, summary]);

  const rows: Row[] = useMemo(() => {
    if (!summary || !selectedCategory) return [];
    const docType = documentTypes.find(t => t.id === selectedCategory.documentTypeId);
    const uploaderIds = new Set(docType?.allowedUploaderUserIds || []);
    // Người phải nộp: người được phép nộp loại hồ sơ này (nếu có cấu hình), cộng thêm ai đã nộp.
    const expected = users.filter(u =>
      (uploaderIds.size > 0 ? uploaderIds.has(u.uid) : DEFAULT_SUBMITTER_ROLES.includes(u.role)) || summary.byTeacher[u.uid]
    );

    // Phạm vi: tổ trưởng/tổ phó chỉ thành viên tổ mình; lọc thêm theo ô "Tổ chuyên môn".
    let scoped = expected;
    if (summary.scope === 'department') {
      const memberSet = new Set(visibleDepartments.flatMap(d => [...d.memberIds, ...(d.headTeacherId ? [d.headTeacherId] : [])]));
      scoped = scoped.filter(u => memberSet.has(u.uid));
    }
    if (selectedDeptId !== 'all') {
      const dept = departments.find(d => d.id === selectedDeptId);
      const memberSet = new Set([...(dept?.memberIds || []), ...(dept?.headTeacherId ? [dept.headTeacherId] : [])]);
      scoped = scoped.filter(u => memberSet.has(u.uid));
    }

    const columnKeys = new Set(columns.map(c => c.key));
    return scoped
      .map(u => {
        // Chỉ tính các mục con còn tồn tại (mục con đã xóa không còn được tính).
        const done = new Set((summary.byTeacher[u.uid] || []).filter(k => columnKeys.has(k)));
        return { uid: u.uid, name: u.displayName || u.email, done, count: done.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [summary, selectedCategory, documentTypes, users, visibleDepartments, selectedDeptId, departments, columns]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải...</p>
      </div>
    );
  }

  if (!schoolYearId) {
    return <div className="text-center py-12 text-gray-600">{error || 'Chưa có năm học nào đang hoạt động.'}</div>;
  }

  const totalCols = columns.length;
  const doneAll = rows.filter(r => r.count === totalCols).length;

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TableIcon className="w-6 h-6" /> Theo dõi nộp hồ sơ
        </h2>
        <p className="text-gray-600">
          {summary?.scope === 'department' ? 'Tiến độ nộp hồ sơ của tổ bạn' : 'Tiến độ nộp hồ sơ toàn trường'} — năm học hiện tại
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm text-gray-600 mb-1 block">Danh mục hồ sơ</label>
          <Select value={selectedCategoryId} onValueChange={(v) => { if (v) setSelectedCategoryId(v); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn danh mục" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm text-gray-600 mb-1 block">Tổ chuyên môn</label>
          <Select value={selectedDeptId} onValueChange={(v) => { if (v) setSelectedDeptId(v); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tất cả tổ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{summary?.scope === 'department' ? 'Tất cả tổ của tôi' : 'Tất cả tổ'}</SelectItem>
              {visibleDepartments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chú thích + thời điểm cập nhật */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Đã nộp</span>
        <span className="flex items-center gap-1"><X className="w-4 h-4 text-gray-300" /> Chưa nộp</span>
        {rows.length > 0 && (
          <span>Nộp đủ: <b className="text-gray-900">{doneAll}/{rows.length}</b> người</span>
        )}
        {summary?.updatedAt && (
          <span className="text-gray-400">Cập nhật lúc {new Date(summary.updatedAt).toLocaleString('vi-VN')}</span>
        )}
      </div>

      {error ? (
        <div className="text-center py-12 bg-white rounded-lg border text-red-600">{error}</div>
      ) : categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border text-gray-600">
          Năm học này chưa có danh mục hồ sơ nào.
        </div>
      ) : loadingMatrix || !summary ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : selectedCategory?.hasSubCategories && totalCols === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border text-gray-600">
          Danh mục này chưa có mục con nào.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="text-sm border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r font-semibold text-gray-700 min-w-[180px]">
                  Họ và tên
                </th>
                {totalCols > 1 && (
                  <th className="px-2 py-2 border-b border-r font-semibold text-gray-700 text-center whitespace-nowrap">
                    Đã nộp
                  </th>
                )}
                {columns.map(c => (
                  <th key={c.key} className="px-2 py-2 border-b border-r font-medium text-gray-600 text-center whitespace-nowrap">
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={totalCols + 2} className="text-center py-8 text-gray-500">
                    Không có ai trong phạm vi đã chọn.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.uid} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r font-medium text-gray-900 min-w-[180px]">
                      {row.name}
                    </td>
                    {totalCols > 1 && (
                      <td className="px-2 py-2 border-b border-r text-center whitespace-nowrap">
                        <span className={row.count === totalCols ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                          {row.count}/{totalCols}
                        </span>
                      </td>
                    )}
                    {columns.map(c => (
                      <td key={c.key} className="px-2 py-2 border-b border-r text-center">
                        {row.done.has(c.key)
                          ? <Check className="w-4 h-4 text-green-600 mx-auto" />
                          : <X className="w-4 h-4 text-gray-300 mx-auto" />}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
