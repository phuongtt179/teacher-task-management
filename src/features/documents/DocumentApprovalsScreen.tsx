import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { documentService } from '@/services/documentService';
import { fileRequestService } from '@/services/fileRequestService';
import { departmentService } from '@/services/departmentService';
import { Document, FileRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, FileText, Eye, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DocumentApprovalsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingItems();
  }, [user]);

  const loadPendingItems = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user's department (for department heads)
      let departmentId: string | undefined;
      if (user.role === 'teacher' || user.role === 'department_head') {
        const dept = await departmentService.getDepartmentByUserId(user.uid);
        departmentId = dept?.id;
      }

      // Load pending documents
      if (departmentId) {
        const docs = await documentService.getPendingDocumentsByDepartment(departmentId);
        setPendingDocuments(docs);
      } else {
        // Admin/VP can see all pending
        const docs = await documentService.getDocuments({ status: 'pending' });
        setPendingDocuments(docs);
      }

      // Load pending requests
      if (departmentId) {
        const reqs = await fileRequestService.getPendingRequestsByDepartment(departmentId);
        setPendingRequests(reqs);
      } else {
        // Admin/VP can see all pending
        const reqs = await fileRequestService.getRequests({ status: 'pending' });
        setPendingRequests(reqs);
      }
    } catch (error) {
      console.error('Error loading pending items:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách chờ phê duyệt',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDocument = async (doc: Document) => {
    // Confirmation dialog
    if (!confirm(`Xác nhận phê duyệt hồ sơ "${doc.title}" của ${doc.uploadedByName}?`)) {
      return;
    }

    try {
      await documentService.approveDocument(doc.id, user!.uid, user!.displayName);
      toast({ title: 'Thành công', description: 'Đã phê duyệt hồ sơ' });
      loadPendingItems();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể phê duyệt hồ sơ',
        variant: 'destructive',
      });
    }
  };

  const handleRejectDocument = async (doc: Document) => {
    // Confirmation dialog
    if (!confirm(`Xác nhận từ chối hồ sơ "${doc.title}" của ${doc.uploadedByName}?`)) {
      return;
    }

    const reason = prompt('Lý do từ chối:');
    if (!reason) return;

    try {
      await documentService.rejectDocument(doc.id, user!.uid, user!.displayName, reason);
      toast({ title: 'Thành công', description: 'Đã từ chối hồ sơ' });
      loadPendingItems();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể từ chối hồ sơ',
        variant: 'destructive',
      });
    }
  };

  const handleApproveRequest = async (req: FileRequest) => {
    const note = prompt('Ghi chú (tùy chọn):') || '';

    try {
      await fileRequestService.approveRequest(req.id, user!.uid, user!.displayName, note);
      toast({ title: 'Thành công', description: 'Đã phê duyệt yêu cầu' });
      loadPendingItems();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể phê duyệt yêu cầu',
        variant: 'destructive',
      });
    }
  };

  const handleRejectRequest = async (req: FileRequest) => {
    const note = prompt('Lý do từ chối:');
    if (!note) return;

    try {
      await fileRequestService.rejectRequest(req.id, user!.uid, user!.displayName, note);
      toast({ title: 'Thành công', description: 'Đã từ chối yêu cầu' });
      loadPendingItems();
    } catch (error) {
      toast({
        title: 'Lỗi',
        description: 'Không thể từ chối yêu cầu',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Phê duyệt Hồ sơ</h1>
        <p className="text-gray-600 mt-2">Phê duyệt hồ sơ và yêu cầu từ giáo viên</p>
      </div>

      <Tabs defaultValue="documents">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents">
            Hồ sơ chờ duyệt ({pendingDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="requests">
            Yêu cầu chờ duyệt ({pendingRequests.length})
          </TabsTrigger>
        </TabsList>

        {/* PENDING DOCUMENTS */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Hồ sơ chờ phê duyệt</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : pendingDocuments.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Không có hồ sơ chờ phê duyệt</p>
              ) : (
                <div className="space-y-3">
                  {pendingDocuments.map(doc => (
                    <div key={doc.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <FileText className="h-8 w-8 text-blue-600 mt-1" />
                          <div className="flex-1">
                            <h3 className="font-semibold">{doc.title}</h3>
                            <p className="text-sm text-gray-500">{doc.files?.length || 0} file(s)</p>
                            <p className="text-sm text-gray-600 mt-1">
                              Tải lên bởi: {doc.uploadedByName}
                            </p>
                            <p className="text-sm text-gray-600">
                              Ngày: {doc.uploadedAt.toLocaleDateString('vi-VN')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveDocument(doc)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectDocument(doc)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      </div>

                      {/* Files List */}
                      {doc.files && doc.files.length > 0 && (
                        <div className="ml-11 space-y-1">
                          {doc.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-3 py-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-gray-400 flex-shrink-0">
                                  ({formatFileSize(file.size)})
                                </span>
                              </div>
                              <div className="flex gap-2 ml-3">
                                <button
                                  onClick={() => window.open(file.driveFileUrl, '_blank')}
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                  title="Xem file"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Xem</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = file.driveFileUrl;
                                    link.download = file.name;
                                    link.click();
                                  }}
                                  className="text-green-600 hover:text-green-800 flex items-center gap-1"
                                  title="Tải xuống"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>Tải</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PENDING REQUESTS */}
        <TabsContent value="requests">
          <Card>
            <CardHeader>
              <CardTitle>Yêu cầu chờ phê duyệt</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : pendingRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Không có yêu cầu chờ phê duyệt</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              req.requestType === 'delete'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {req.requestType === 'delete' ? 'XÓA' : 'SỬA'}
                            </span>
                            <h3 className="font-semibold">{req.documentName}</h3>
                          </div>
                          <p className="text-sm text-gray-600">
                            Người yêu cầu: {req.requestedByName}
                          </p>
                          <p className="text-sm text-gray-600">
                            Lý do: {req.reason}
                          </p>
                          <p className="text-sm text-gray-600">
                            Ngày: {req.requestedAt.toLocaleDateString('vi-VN')}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveRequest(req)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectRequest(req)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Từ chối
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
