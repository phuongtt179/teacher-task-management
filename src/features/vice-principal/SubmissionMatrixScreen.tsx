import { useEffect, useMemo, useState } from 'react';
import { schoolYearService } from '../../services/schoolYearService';
import { documentCategoryService } from '../../services/documentCategoryService';
import { documentService } from '../../services/documentService';
import { departmentService } from '../../services/departmentService';
import { userService } from '../../services/userService';
import { DocumentCategory, DocumentSubCategory, Department, DocumentStatus } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Clock, X, Table as TableIcon } from 'lucide-react';

type CellState = 'approved' | 'pending' | 'none';

interface Row {
  uid: string;
  name: string;
  cells: Record<string, CellState>; // subCategoryId -> state
  approved: number;
}

// Ưu tiên trạng thái tốt nhất khi 1 người có nhiều tài liệu cho cùng 1 mục con
const rank: Record<CellState, number> = { none: 0, pending: 1, approved: 2 };
const better = (a: CellState, b: CellState): CellState => (rank[b] > rank[a] ? b : a);
const toState = (s: DocumentStatus): CellState =>
  s === 'approved' ? 'approved' : s === 'pending' ? 'pending' : 'none'; // rejected coi như chưa nộp

export const SubmissionMatrixScreen = () => {
  const [schoolYearId, setSchoolYearId] = useState<string>('');
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [teachers, setTeachers] = useState<Array<{ uid: string; name: string }>>([]);

  const [subCategories, setSubCategories] = useState<DocumentSubCategory[]>([]);
  const [cellMap, setCellMap] = useState<Map<string, CellState>>(new Map()); // `${uid}|${subId}` -> state
  const [loading, setLoading] = useState(true);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Tải dữ liệu nền: năm học active, danh mục (có mục con), tổ, giáo viên
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const activeYear = await schoolYearService.getActiveSchoolYear();
        if (!activeYear) {
          setLoading(false);
          return;
        }
        setSchoolYearId(activeYear.id);

        const [cats, depts, users] = await Promise.all([
          documentCategoryService.getCategoriesBySchoolYear(activeYear.id),
          departmentService.getAllDepartments(),
          userService.getAllUsers(),
        ]);

        const withSubs = cats.filter(c => c.hasSubCategories);
        setCategories(withSubs);
        setDepartments(depts);
        setTeachers(
          users
            .filter(u => u.role === 'teacher' || u.role === 'department_head')
            .map(u => ({ uid: u.uid, name: u.displayName || u.email }))
            .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
        );

        // Mặc định chọn "Kế hoạch bài dạy" nếu có, không thì danh mục đầu tiên
        const prefer = withSubs.find(c => c.name.toLowerCase().includes('kế hoạch bài dạy'))
          || withSubs.find(c => c.name.toLowerCase().includes('giáo án'));
        setSelectedCategoryId((prefer || withSubs[0])?.id || '');
      } catch (e) {
        console.error('Error loading matrix base data:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Tải ma trận khi đổi danh mục
  useEffect(() => {
    const loadMatrix = async () => {
      if (!selectedCategoryId) {
        setSubCategories([]);
        setCellMap(new Map());
        return;
      }
      try {
        setLoadingMatrix(true);
        const [subs, cells] = await Promise.all([
          documentCategoryService.getSubCategories(selectedCategoryId),
          documentService.getSubmissionCells(selectedCategoryId),
        ]);
        setSubCategories(subs);

        const map = new Map<string, CellState>();
        cells.forEach(c => {
          if (!c.subCategoryId) return;
          const key = `${c.uploadedBy}|${c.subCategoryId}`;
          map.set(key, better(map.get(key) || 'none', toState(c.status)));
        });
        setCellMap(map);
      } catch (e) {
        console.error('Error loading matrix:', e);
      } finally {
        setLoadingMatrix(false);
      }
    };
    loadMatrix();
  }, [selectedCategoryId]);

  // Danh sách giáo viên theo bộ lọc tổ
  const visibleTeachers = useMemo(() => {
    if (selectedDeptId === 'all') return teachers;
    const dept = departments.find(d => d.id === selectedDeptId);
    const memberSet = new Set(dept?.memberIds || []);
    return teachers.filter(t => memberSet.has(t.uid));
  }, [teachers, departments, selectedDeptId]);

  // Dựng các hàng có sẵn ô + đếm đã duyệt
  const rows: Row[] = useMemo(() => {
    return visibleTeachers.map(t => {
      const cells: Record<string, CellState> = {};
      let approved = 0;
      subCategories.forEach(s => {
        const state = cellMap.get(`${t.uid}|${s.id}`) || 'none';
        cells[s.id] = state;
        if (state === 'approved') approved++;
      });
      return { uid: t.uid, name: t.name, cells, approved };
    });
  }, [visibleTeachers, subCategories, cellMap]);

  const totalCols = subCategories.length;

  const renderCell = (state: CellState) => {
    if (state === 'approved') return <Check className="w-4 h-4 text-green-600 mx-auto" />;
    if (state === 'pending') return <Clock className="w-4 h-4 text-amber-500 mx-auto" />;
    return <X className="w-4 h-4 text-gray-300 mx-auto" />;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải...</p>
      </div>
    );
  }

  if (!schoolYearId) {
    return <div className="text-center py-12 text-gray-600">Chưa có năm học nào đang hoạt động.</div>;
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <TableIcon className="w-6 h-6" /> Theo dõi nộp hồ sơ
        </h2>
        <p className="text-gray-600">Bảng ✓/✗ tiến độ nộp theo từng mục con (tuần)</p>
      </div>

      {/* Bộ lọc */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm text-gray-600 mb-1 block">Danh mục hồ sơ</label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
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
          <Select value={selectedDeptId} onValueChange={setSelectedDeptId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tất cả tổ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả tổ</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chú thích */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1"><Check className="w-4 h-4 text-green-600" /> Đã duyệt</span>
        <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-amber-500" /> Chờ duyệt</span>
        <span className="flex items-center gap-1"><X className="w-4 h-4 text-gray-300" /> Chưa nộp</span>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border text-gray-600">
          Chưa có danh mục hồ sơ nào có mục con (tuần) trong năm học này.
        </div>
      ) : loadingMatrix ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : totalCols === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border text-gray-600">
          Danh mục này chưa có mục con nào.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="text-sm border-collapse min-w-max">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-10 bg-gray-50 text-left px-3 py-2 border-b border-r font-semibold text-gray-700 min-w-[180px]">
                  Giáo viên
                </th>
                <th className="px-2 py-2 border-b border-r font-semibold text-gray-700 text-center whitespace-nowrap">
                  Đã duyệt
                </th>
                {subCategories.map(s => (
                  <th key={s.id} className="px-2 py-2 border-b border-r font-medium text-gray-600 text-center whitespace-nowrap">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={totalCols + 2} className="text-center py-8 text-gray-500">
                    Không có giáo viên nào trong phạm vi đã chọn.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.uid} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r font-medium text-gray-900 min-w-[180px]">
                      {row.name}
                    </td>
                    <td className="px-2 py-2 border-b border-r text-center whitespace-nowrap">
                      <span className={row.approved === totalCols ? 'text-green-600 font-semibold' : 'text-gray-600'}>
                        {row.approved}/{totalCols}
                      </span>
                    </td>
                    {subCategories.map(s => (
                      <td key={s.id} className="px-2 py-2 border-b border-r text-center">
                        {renderCell(row.cells[s.id])}
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
