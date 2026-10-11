import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { schoolYearService } from '../../services/schoolYearService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { documentTypeService } from '../../services/documentTypeService';
import { departmentService } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { submissionSummaryService, NO_SUBCATEGORY_KEY, type SubmissionSummary } from '../../services/submissionSummaryService';
import {
  isTeacherPlanCategory,
  isDepartmentPlanCategory,
  normalizeName,
  SCHOOL_WIDE_ROLES,
} from '../../shared/trackedCategories';
import { DocumentCategory, DocumentSubCategory, Department, DocumentType, User } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Minus, Table as TableIcon } from 'lucide-react';

// Khi loại hồ sơ không giới hạn người nộp: coi giáo viên/tổ trưởng/tổ phó là người phải nộp.
const DEFAULT_SUBMITTER_ROLES = ['teacher', 'department_head', 'deputy_department_head'];
// Lựa chọn "Kế hoạch tổ chuyên môn" (bảng theo tổ) trong ô chọn — không phải id danh mục thật.
const DEPARTMENT_VIEW = '__department_plans__';

interface Column { key: string; name: string }
interface TeacherRow { uid: string; name: string; done: Set<string>; count: number }
// Bảng theo tổ: mỗi ô — 'done' đã nộp, 'missing' chưa nộp, 'none' tổ chưa tạo mục con này.
type DeptCell = 'done' | 'missing' | 'none';
interface DeptRow { categoryId: string; name: string; cells: Record<string, DeptCell>; count: number; total: number }

const byNaturalName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'vi', { numeric: true });

/**
 * Theo dõi nộp hồ sơ (năm học hiện tại).
 * - Kế hoạch bài dạy / Kế hoạch môn học: ✓/✗ theo từng giáo viên. Tổ trưởng/tổ phó chỉ
 *   thấy tổ mình; BGH/admin thấy toàn trường (server lọc).
 * - Kế hoạch tổ chuyên môn (chỉ BGH/admin): ✓/✗ theo từng tổ, cột là các mục con của hồ sơ tổ.
 * Danh mục được theo dõi: src/shared/trackedCategories.js (server cũng chặn các danh mục khác).
 * Dữ liệu nộp lấy từ bảng tổng hợp server lưu sẵn (~1 lượt đọc/danh mục).
 */
export const SubmissionMatrixScreen = () => {
  const { user } = useAuth();
  const schoolId = user?.schoolId;
  const isSchoolWide = !!user && SCHOOL_WIDE_ROLES.includes(user.role);

  const [schoolYearId, setSchoolYearId] = useState('');
  const [teacherCategories, setTeacherCategories] = useState<DocumentCategory[]>([]);
  const [departmentCategories, setDepartmentCategories] = useState<DocumentCategory[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedView, setSelectedView] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState('all');
  const [users, setUsers] = useState<User[]>([]);

  // Bảng theo giáo viên
  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [summary, setSummary] = useState<SubmissionSummary | null>(null);
  // Bảng theo tổ
  const [deptData, setDeptData] = useState<Array<{ category: DocumentCategory; subs: DocumentSubCategory[]; summary: SubmissionSummary }> | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [error, setError] = useState('');

  // Dữ liệu nền: năm học hiện tại, danh mục được theo dõi, loại hồ sơ, tổ, người dùng.
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
        const teacherCats = cats.filter(c => isTeacherPlanCategory(c.name)).sort(byNaturalName);
        const deptCats = isSchoolWide ? cats.filter(c => isDepartmentPlanCategory(c.name)).sort(byNaturalName) : [];
        setTeacherCategories(teacherCats);
        setDepartmentCategories(deptCats);
        setDocumentTypes(types);
        setDepartments(depts);
        setUsers(allUsers.filter(u => u.isActive !== false));

        const prefer = teacherCats.find(c => normalizeName(c.name) === 'ke hoach bai day') || teacherCats[0];
        setSelectedView(prefer?.id || (deptCats.length ? DEPARTMENT_VIEW : ''));
      } catch (e) {
        console.error('Error loading matrix base data:', e);
        setError('Không tải được dữ liệu. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId, isSchoolWide]);

  // Đổi lựa chọn → tải bảng tương ứng.
  useEffect(() => {
    if (!schoolId || !selectedView) return;
    let active = true;
    const loadMatrix = async () => {
      try {
        setLoadingMatrix(true);
        setError('');
        if (selectedView === DEPARTMENT_VIEW) {
          const data = await Promise.all(departmentCategories.map(async category => {
            const [subs, sum] = await Promise.all([
              category.hasSubCategories ? documentCategoryService.getSubCategories(schoolId, category.id) : Promise.resolve([]),
              submissionSummaryService.get(category.id),
            ]);
            return { category, subs: [...subs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), summary: sum };
          }));
          if (active) setDeptData(data);
        } else {
          const category = teacherCategories.find(c => c.id === selectedView);
          const [subs, sum] = await Promise.all([
            category?.hasSubCategories ? documentCategoryService.getSubCategories(schoolId, selectedView) : Promise.resolve([]),
            submissionSummaryService.get(selectedView),
          ]);
          if (!active) return;
          setSubCategories([...subs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
          setSummary(sum);
        }
      } catch (e) {
        console.error('Error loading matrix:', e);
        if (active) setError('Không tải được bảng theo dõi. Vui lòng thử lại.');
      } finally {
        if (active) setLoadingMatrix(false);
      }
    };
    loadMatrix();
    return () => { active = false; };
  }, [schoolId, selectedView, teacherCategories, departmentCategories]);

  const isDeptView = selectedView === DEPARTMENT_VIEW;
  const selectedCategory = teacherCategories.find(c => c.id === selectedView);

  // ---------- Bảng theo giáo viên ----------
  const teacherColumns: Column[] = useMemo(() => {
    if (selectedCategory?.hasSubCategories) return subCategories.map(s => ({ key: s.id, name: s.name }));
    return [{ key: NO_SUBCATEGORY_KEY, name: 'Đã nộp' }];
  }, [selectedCategory, subCategories]);

  // Tổ trưởng/tổ phó: chỉ các tổ mình phụ trách (server trả về departmentIds).
  const visibleDepartments = useMemo(() => {
    if (summary?.scope !== 'department') return departments;
    const mine = new Set(summary.departmentIds || []);
    return departments.filter(d => mine.has(d.id));
  }, [departments, summary]);

  const teacherRows: TeacherRow[] = useMemo(() => {
    if (isDeptView || !summary || !selectedCategory) return [];
    const docType = documentTypes.find(t => t.id === selectedCategory.documentTypeId);
    const uploaderIds = new Set(docType?.allowedUploaderUserIds || []);
    // Người phải nộp: người được phép nộp loại hồ sơ này (nếu có cấu hình), cộng thêm ai đã nộp.
    let scoped = users.filter(u =>
      (uploaderIds.size > 0 ? uploaderIds.has(u.uid) : DEFAULT_SUBMITTER_ROLES.includes(u.role)) || summary.byTeacher[u.uid]
    );
    const membersOf = (d?: Department) => new Set([...(d?.memberIds || []), ...(d?.headTeacherId ? [d.headTeacherId] : [])]);
    if (summary.scope === 'department') {
      const memberSet = new Set(visibleDepartments.flatMap(d => [...membersOf(d)]));
      scoped = scoped.filter(u => memberSet.has(u.uid));
    }
    if (selectedDeptId !== 'all') {
      const memberSet = membersOf(departments.find(d => d.id === selectedDeptId));
      scoped = scoped.filter(u => memberSet.has(u.uid));
    }
    const columnKeys = new Set(teacherColumns.map(c => c.key));
    return scoped
      .map(u => {
        // Chỉ tính các mục con còn tồn tại (mục con đã xóa không còn được tính).
        const done = new Set((summary.byTeacher[u.uid] || []).filter(k => columnKeys.has(k)));
        return { uid: u.uid, name: u.displayName || u.email, done, count: done.size };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [isDeptView, summary, selectedCategory, documentTypes, users, visibleDepartments, selectedDeptId, departments, teacherColumns]);

  // ---------- Bảng theo tổ ----------
  // Cột: hợp các mục con của mọi tổ, ghép theo TÊN (các tổ tạo mục con giống nhau).
  const deptColumns: Column[] = useMemo(() => {
    if (!deptData) return [];
    const seen = new Map<string, { name: string; order: number }>();
    deptData.forEach(({ subs }) => subs.forEach(s => {
      const key = normalizeName(s.name);
      if (!seen.has(key)) seen.set(key, { name: s.name, order: s.order ?? 0 });
    }));
    return [...seen.entries()].sort((a, b) => a[1].order - b[1].order).map(([key, v]) => ({ key, name: v.name }));
  }, [deptData]);

  const deptRows: DeptRow[] = useMemo(() => {
    if (!deptData) return [];
    return deptData.map(({ category, subs, summary: sum }) => {
      const submitted = new Set(Object.values(sum.byTeacher).flat());
      const cells: Record<string, DeptCell> = {};
      let count = 0;
      let total = 0;
      deptColumns.forEach(col => {
        const sub = subs.find(s => normalizeName(s.name) === col.key);
        if (!sub) { cells[col.key] = 'none'; return; }
        total++;
        if (submitted.has(sub.id)) { cells[col.key] = 'done'; count++; } else cells[col.key] = 'missing';
      });
      return { categoryId: category.id, name: category.name, cells, count, total };
    });
  }, [deptData, deptColumns]);

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

  const noOptions = teacherCategories.length === 0 && departmentCategories.length === 0;
  const updatedAt = isDeptView
    ? Math.max(0, ...(deptData || []).map(d => d.summary.updatedAt || 0)) || null
    : summary?.updatedAt;

  const renderMark = (state: 'done' | 'missing' | 'none') =>
    state === 'done' ? <Check className="w-4 h-4 text-green-600 mx-auto" />
      : state === 'missing' ? <X className="w-4 h-4 text-gray-300 mx-auto" />
        : <Minus className="w-4 h-4 text-gray-200 mx-auto" />;

  const spinner = (
    <div className="text-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
    </div>
  );
  const box = (text: string, cls = 'text-gray-600') => (
    <div className={`text-center py-12 bg-white rounded-lg border ${cls}`}>{text}</div>
  );

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TableIcon className="w-6 h-6" /> Theo dõi nộp hồ sơ
        </h2>
        <p className="text-gray-600">
          {isSchoolWide ? 'Tiến độ nộp kế hoạch toàn trường' : 'Tiến độ nộp kế hoạch của tổ bạn'} — năm học hiện tại
        </p>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm text-gray-600 mb-1 block">Theo dõi</label>
          <Select value={selectedView} onValueChange={(v) => { if (v) setSelectedView(v); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn hồ sơ cần theo dõi" />
            </SelectTrigger>
            <SelectContent>
              {teacherCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
              {departmentCategories.length > 0 && (
                <SelectItem value={DEPARTMENT_VIEW}>Kế hoạch tổ chuyên môn (theo tổ)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        {!isDeptView && (
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
        )}
      </div>

      {/* Chú thích + thời điểm cập nhật */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Đã nộp</span>
        <span className="flex items-center gap-1"><X className="w-4 h-4 text-gray-300" /> Chưa nộp</span>
        {isDeptView && <span className="flex items-center gap-1"><Minus className="w-4 h-4 text-gray-300" /> Tổ chưa tạo mục này</span>}
        {!isDeptView && teacherRows.length > 0 && (
          <span>Nộp đủ: <b className="text-gray-900">{teacherRows.filter(r => r.count === teacherColumns.length).length}/{teacherRows.length}</b> người</span>
        )}
        {updatedAt && <span className="text-gray-400">Cập nhật lúc {new Date(updatedAt).toLocaleString('vi-VN')}</span>}
      </div>

      {error ? box(error, 'text-red-600')
        : noOptions ? box('Năm học này chưa có danh mục "Kế hoạch bài dạy", "Kế hoạch môn học" hoặc hồ sơ tổ chuyên môn.')
        : loadingMatrix ? spinner
        : isDeptView ? (
          !deptData ? spinner
            : deptColumns.length === 0 ? box('Các tổ chưa tạo mục con nào (ví dụ "Kế hoạch TCM") trong hồ sơ tổ.')
            : (
              <div className="bg-white rounded-lg border overflow-x-auto">
                <table className="text-sm border-collapse min-w-max">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r font-semibold text-gray-700 min-w-[160px]">Tổ</th>
                      <th className="px-2 py-2 border-b border-r font-semibold text-gray-700 text-center whitespace-nowrap">Đã nộp</th>
                      {deptColumns.map(c => (
                        <th key={c.key} className="px-3 py-2 border-b border-r font-medium text-gray-600 text-center whitespace-nowrap">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {deptRows.map(row => (
                      <tr key={row.categoryId} className="hover:bg-gray-50">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r font-medium text-gray-900 min-w-[160px]">{row.name}</td>
                        <td className="px-2 py-2 border-b border-r text-center whitespace-nowrap">
                          {row.total === 0
                            ? <span className="text-gray-400 text-xs">chưa tạo mục</span>
                            : <span className={row.count === row.total ? 'text-green-600 font-semibold' : 'text-gray-600'}>{row.count}/{row.total}</span>}
                        </td>
                        {deptColumns.map(c => (
                          <td key={c.key} className="px-3 py-2 border-b border-r text-center">{renderMark(row.cells[c.key])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        ) : !summary ? spinner
        : selectedCategory?.hasSubCategories && subCategories.length === 0 ? box('Danh mục này chưa có mục con nào.')
        : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="text-sm border-collapse min-w-max">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r font-semibold text-gray-700 min-w-[180px]">Họ và tên</th>
                  {teacherColumns.length > 1 && (
                    <th className="px-2 py-2 border-b border-r font-semibold text-gray-700 text-center whitespace-nowrap">Đã nộp</th>
                  )}
                  {teacherColumns.map(c => (
                    <th key={c.key} className="px-2 py-2 border-b border-r font-medium text-gray-600 text-center whitespace-nowrap">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teacherRows.length === 0 ? (
                  <tr>
                    <td colSpan={teacherColumns.length + 2} className="text-center py-8 text-gray-500">Không có ai trong phạm vi đã chọn.</td>
                  </tr>
                ) : (
                  teacherRows.map(row => (
                    <tr key={row.uid} className="hover:bg-gray-50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r font-medium text-gray-900 min-w-[180px]">{row.name}</td>
                      {teacherColumns.length > 1 && (
                        <td className="px-2 py-2 border-b border-r text-center whitespace-nowrap">
                          <span className={row.count === teacherColumns.length ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                            {row.count}/{teacherColumns.length}
                          </span>
                        </td>
                      )}
                      {teacherColumns.map(c => (
                        <td key={c.key} className="px-2 py-2 border-b border-r text-center">{renderMark(row.done.has(c.key) ? 'done' : 'missing')}</td>
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
