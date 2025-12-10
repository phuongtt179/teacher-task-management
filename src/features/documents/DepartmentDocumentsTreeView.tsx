import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { departmentService } from '@/services/departmentService';
import { userService } from '@/services/userService';
import { documentService } from '@/services/documentService';
import { Department, User, Document } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ChevronRight,
  ChevronDown,
  Users,
  UserCircle,
  FileText,
  Download,
  Eye,
  Calendar,
  FileIcon,
  Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DepartmentDocumentsTreeViewProps {
  subCategoryId: string;
  categoryId: string;
  schoolYearId: string;
  onUploadClick?: () => void;
}

export function DepartmentDocumentsTreeView({
  subCategoryId,
  categoryId,
  schoolYearId,
  onUploadClick,
}: DepartmentDocumentsTreeViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [teachersByDept, setTeachersByDept] = useState<Map<string, User[]>>(new Map());
  const [documentsByTeacher, setDocumentsByTeacher] = useState<Map<string, Document[]>>(new Map());

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDepartments();
  }, [user]);

  const loadDepartments = async () => {
    if (!user) return;

    try {
      setLoading(true);

      console.log('🔍 Loading departments for user:', {
        uid: user.uid,
        role: user.role,
        displayName: user.displayName,
      });

      // Admin/VP: Load all departments
      // Department Head: Load only their department
      if (user.role === 'admin' || user.role === 'vice_principal') {
        const allDepts = await departmentService.getAllDepartments();
        console.log('👥 All departments loaded:', allDepts);
        setDepartments(allDepts);
      } else if (user.role === 'department_head') {
        const userDept = await departmentService.getDepartmentByUserId(user.uid);
        console.log('📋 Department for dept head:', userDept);

        if (userDept) {
          setDepartments([userDept]);
        } else {
          // Try finding by headTeacherId
          const allDepts = await departmentService.getAllDepartments();
          const deptAsHead = allDepts.find(d => d.headTeacherId === user.uid);
          console.log('📋 Department where user is head:', deptAsHead);

          if (deptAsHead) {
            setDepartments([deptAsHead]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách tổ',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadTeachersForDepartment = async (deptId: string) => {
    try {
      const dept = departments.find(d => d.id === deptId);
      if (!dept || teachersByDept.has(deptId)) return;

      const allUsers = await userService.getAllUsers();
      const deptTeachers = allUsers.filter(u => dept.memberIds.includes(u.uid));

      setTeachersByDept(prev => new Map(prev).set(deptId, deptTeachers));
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách giáo viên',
        variant: 'destructive',
      });
    }
  };

  const loadDocumentsForTeacher = async (teacherId: string) => {
    try {
      if (documentsByTeacher.has(teacherId)) return;

      console.log('🔍 Loading documents for teacher:', {
        teacherId,
        schoolYearId,
        categoryId,
        subCategoryId,
      });

      const docs = await documentService.getDocuments({
        schoolYearId,
        categoryId,
        subCategoryId,
        uploadedBy: teacherId,
      });

      console.log('📄 Documents fetched:', docs);

      // In tree view (for personal files), only show approved documents
      // Exception: if viewing own documents, show all statuses
      const filteredDocs = docs.filter(doc =>
        doc.status === 'approved' || doc.uploadedBy === user?.uid
      );

      console.log('✅ Filtered documents:', filteredDocs);

      setDocumentsByTeacher(prev => new Map(prev).set(teacherId, filteredDocs));
    } catch (error) {
      console.error('❌ Error loading documents:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải hồ sơ',
        variant: 'destructive',
      });
    }
  };

  const toggleDepartment = async (deptId: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(deptId)) {
      newExpanded.delete(deptId);
    } else {
      newExpanded.add(deptId);
      await loadTeachersForDepartment(deptId);
    }
    setExpandedDepts(newExpanded);
  };

  const toggleTeacher = async (teacherId: string) => {
    const newExpanded = new Set(expandedTeachers);
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId);
    } else {
      newExpanded.add(teacherId);
      await loadDocumentsForTeacher(teacherId);
    }
    setExpandedTeachers(newExpanded);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Đã duyệt</span>;
      case 'pending':
        return <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">Chờ duyệt</span>;
      case 'rejected':
        return <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">Từ chối</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-gray-500 mt-2">Đang tải...</p>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">Chưa có tổ nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {departments.map(dept => (
        <div key={dept.id} className="border rounded-lg">
          {/* Department Header */}
          <button
            onClick={() => toggleDepartment(dept.id)}
            className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
          >
            {expandedDepts.has(dept.id) ? (
              <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500 flex-shrink-0" />
            )}
            <Users className="w-6 h-6 text-indigo-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-base">{dept.name}</h3>
              {dept.headTeacherName && (
                <p className="text-sm text-gray-500">Tổ trưởng: {dept.headTeacherName}</p>
              )}
            </div>
            <div className="text-sm text-gray-500">
              {dept.memberIds.length} giáo viên
            </div>
          </button>

          {/* Teachers List */}
          {expandedDepts.has(dept.id) && teachersByDept.get(dept.id) && (
            <div className="border-t bg-gray-50">
              {teachersByDept.get(dept.id)!.map(teacher => (
                <div key={teacher.uid} className="border-b last:border-b-0">
                  {/* Teacher Header */}
                  <button
                    onClick={() => toggleTeacher(teacher.uid)}
                    className="w-full flex items-center gap-3 p-3 pl-12 hover:bg-gray-100 transition-colors text-left"
                  >
                    {expandedTeachers.has(teacher.uid) ? (
                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    )}
                    <UserCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{teacher.displayName}</p>
                      <p className="text-xs text-gray-500">{teacher.email}</p>
                    </div>
                    {expandedTeachers.has(teacher.uid) && documentsByTeacher.get(teacher.uid) && (
                      <div className="text-xs text-gray-500">
                        {documentsByTeacher.get(teacher.uid)!.length} hồ sơ
                      </div>
                    )}
                  </button>

                  {/* Documents List */}
                  {expandedTeachers.has(teacher.uid) && documentsByTeacher.get(teacher.uid) && (
                    <div className="bg-white p-3 pl-16 space-y-2">
                      {/* Upload button for user's own entry */}
                      {user && teacher.uid === user.uid && onUploadClick && (
                        <div className="mb-3">
                          <Button
                            size="sm"
                            onClick={onUploadClick}
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Tải lên hồ sơ của tôi
                          </Button>
                        </div>
                      )}

                      {documentsByTeacher.get(teacher.uid)!.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Chưa có hồ sơ nào</p>
                      ) : (
                        documentsByTeacher.get(teacher.uid)!.map(doc => (
                          <Card key={doc.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-0">
                              <div className="flex items-center gap-3 p-3">
                                {/* File Icon */}
                                <div className="flex-shrink-0">
                                  <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-blue-600" />
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  {/* Title & Status */}
                                  <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-semibold text-sm truncate flex-1" title={doc.title}>
                                      {doc.title}
                                    </h4>
                                    {getStatusBadge(doc.status)}
                                  </div>

                                  {/* Metadata */}
                                  <div className="bg-gray-50 rounded px-2 py-1 mb-2">
                                    <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                      <div className="flex items-center gap-1">
                                        <FileIcon className="w-3 h-3 text-gray-400" />
                                        <span className="truncate max-w-[200px]" title={doc.fileName}>
                                          {doc.fileName}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-gray-400" />
                                        <span>{doc.uploadedAt.toLocaleDateString('vi-VN')}</span>
                                      </div>
                                      <span className="text-gray-400">•</span>
                                      <span>{formatFileSize(doc.fileSize)}</span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex gap-1">
                                    {doc.driveFileUrl && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => window.open(doc.driveFileUrl, '_blank')}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        Xem
                                      </Button>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs px-2"
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Tải xuống
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
