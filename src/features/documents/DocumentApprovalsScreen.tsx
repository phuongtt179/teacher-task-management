import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { documentService } from '@/services/documentService';
import { fileRequestService } from '@/services/fileRequestService';
import { departmentService } from '@/services/departmentService';
import { Document, FileRequest } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, FileText, Eye, Download, CheckCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DocumentApprovalsScreen() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [pendingDocuments, setPendingDocuments] = useState<Document[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadPendingItems();
  }, [user]);

  const loadPendingItems = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setSelectedDocIds(new Set());
      setSelectedReqIds(new Set());

      let departmentId: string | undefined;
      if (user.role === 'teacher' || user.role === 'department_head') {
        const dept = await departmentService.getDepartmentByUserId(user.uid);
        departmentId = dept?.id;
      }

      if (departmentId) {
        const [docs, reqs] = await Promise.all([
          documentService.getPendingDocumentsByDepartment(departmentId),
          fileRequestService.getPendingRequestsByDepartment(departmentId),
        ]);
        setPendingDocuments(docs);
        setPendingRequests(reqs);
      } else {
        const [docs, reqs] = await Promise.all([
          documentService.getDocuments({ status: 'pending' }),
          fileRequestService.getRequests({ status: 'pending' }),
        ]);
        setPendingDocuments(docs);
        setPendingRequests(reqs);
      }
    } catch (error) {
      toast({ title: 'Lỗi', description: 'Không thể tải danh sách chờ phê duyệt', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Single actions ──────────────────────────────────────────
  const handleApproveDocument = async (doc: Document) => {
    setProcessingId(doc.id);
    try {
      await documentService.approveDocument(doc.id, user!.uid, user!.displayName);
      toast({ title: `Đã duyệt: ${doc.title}` });
      loadPendingItems();
    } catch {
      toast({ title: 'Lỗi phê duyệt', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectDocument = async (doc: Document) => {
    const reason = prompt('Lý do từ chối:');
    if (!reason) return;
    setProcessingId(doc.id);
    try {
      await documentService.rejectDocument(doc.id, user!.uid, user!.displayName, reason);
      toast({ title: `Đã từ chối: ${doc.title}` });
      loadPendingItems();
    } catch {
      toast({ title: 'Lỗi từ chối', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveRequest = async (req: FileRequest) => {
    setProcessingId(req.id);
    try {
      await fileRequestService.approveRequest(req.id, user!.uid, user!.displayName, '');
      toast({ title: `Đã duyệt yêu cầu: ${req.documentName}` });
      loadPendingItems();
    } catch {
      toast({ title: 'Lỗi phê duyệt', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (req: FileRequest) => {
    const note = prompt('Lý do từ chối:');
    if (!note) return;
    setProcessingId(req.id);
    try {
      await fileRequestService.rejectRequest(req.id, user!.uid, user!.displayName, note);
      toast({ title: `Đã từ chối yêu cầu: ${req.documentName}` });
      loadPendingItems();
    } catch {
      toast({ title: 'Lỗi từ chối', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  // ── Bulk actions ────────────────────────────────────────────
  const handleBulkApproveDocuments = async () => {
    if (selectedDocIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedDocIds);
    const results = await Promise.allSettled(
      ids.map(id => documentService.approveDocument(id, user!.uid, user!.displayName))
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    toast({ title: `Duyệt hàng loạt: ${ok} thành công${fail > 0 ? `, ${fail} lỗi` : ''}` });
    setBulkProcessing(false);
    loadPendingItems();
  };

  const handleBulkApproveRequests = async () => {
    if (selectedReqIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedReqIds);
    const results = await Promise.allSettled(
      ids.map(id => fileRequestService.approveRequest(id, user!.uid, user!.displayName, ''))
    );
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    toast({ title: `Duyệt hàng loạt: ${ok} thành công${fail > 0 ? `, ${fail} lỗi` : ''}` });
    setBulkProcessing(false);
    loadPendingItems();
  };

  // ── Selection helpers ───────────────────────────────────────
  const toggleDocSelect = (id: string) => {
    setSelectedDocIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleReqSelect = (id: string) => {
    setSelectedReqIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllDocs = () => setSelectedDocIds(new Set(pendingDocuments.map(d => d.id)));
  const clearDocSelection = () => setSelectedDocIds(new Set());
  const selectAllReqs = () => setSelectedReqIds(new Set(pendingRequests.map(r => r.id)));
  const clearReqSelection = () => setSelectedReqIds(new Set());

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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Hồ sơ chờ phê duyệt</CardTitle>
                {pendingDocuments.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500">
                      Đã chọn: {selectedDocIds.size}/{pendingDocuments.length}
                    </span>
                    <Button variant="outline" size="sm" onClick={selectedDocIds.size === pendingDocuments.length ? clearDocSelection : selectAllDocs}>
                      {selectedDocIds.size === pendingDocuments.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </Button>
                    {selectedDocIds.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkApproveDocuments}
                        disabled={bulkProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {bulkProcessing
                          ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang duyệt...</>
                          : <><CheckCheck className="h-4 w-4 mr-1" /> Duyệt {selectedDocIds.size} hồ sơ</>
                        }
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : pendingDocuments.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Không có hồ sơ chờ phê duyệt</p>
              ) : (
                <div className="space-y-3">
                  {pendingDocuments.map(doc => (
                    <div
                      key={doc.id}
                      className={`border rounded-lg p-4 transition-colors ${selectedDocIds.has(doc.id) ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedDocIds.has(doc.id)}
                            onChange={() => toggleDocSelect(doc.id)}
                            className="mt-1.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          <FileText className="h-8 w-8 text-blue-600 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <h3 className="font-semibold">{doc.title}</h3>
                            <p className="text-sm text-gray-500">{doc.files?.length || 0} file</p>
                            <p className="text-sm text-gray-600 mt-1">Tải lên bởi: {doc.uploadedByName}</p>
                            <p className="text-sm text-gray-600">Ngày: {doc.uploadedAt.toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveDocument(doc)}
                            disabled={processingId === doc.id || bulkProcessing}
                          >
                            {processingId === doc.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <><Check className="h-4 w-4 mr-1" /> Duyệt</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectDocument(doc)}
                            disabled={processingId === doc.id || bulkProcessing}
                          >
                            <X className="h-4 w-4 mr-1" /> Từ chối
                          </Button>
                        </div>
                      </div>

                      {doc.files && doc.files.length > 0 && (
                        <div className="ml-11 space-y-1">
                          {doc.files.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 border rounded px-3 py-2">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate" title={file.name}>{file.name}</span>
                                <span className="text-gray-400 flex-shrink-0">({formatFileSize(file.size)})</span>
                              </div>
                              <div className="flex gap-2 ml-3">
                                <button
                                  onClick={() => window.open(file.driveFileUrl, '_blank')}
                                  className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                >
                                  <Eye className="h-3 w-3" /> Xem
                                </button>
                                <button
                                  onClick={() => { const a = document.createElement('a'); a.href = file.driveFileUrl; a.download = file.name; a.click(); }}
                                  className="text-green-600 hover:text-green-800 flex items-center gap-1"
                                >
                                  <Download className="h-3 w-3" /> Tải
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
              <div className="flex items-center justify-between flex-wrap gap-3">
                <CardTitle>Yêu cầu chờ phê duyệt</CardTitle>
                {pendingRequests.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-500">
                      Đã chọn: {selectedReqIds.size}/{pendingRequests.length}
                    </span>
                    <Button variant="outline" size="sm" onClick={selectedReqIds.size === pendingRequests.length ? clearReqSelection : selectAllReqs}>
                      {selectedReqIds.size === pendingRequests.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                    </Button>
                    {selectedReqIds.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleBulkApproveRequests}
                        disabled={bulkProcessing}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {bulkProcessing
                          ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Đang duyệt...</>
                          : <><CheckCheck className="h-4 w-4 mr-1" /> Duyệt {selectedReqIds.size} yêu cầu</>
                        }
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-center py-8 text-gray-500">Đang tải...</p>
              ) : pendingRequests.length === 0 ? (
                <p className="text-center py-8 text-gray-500">Không có yêu cầu chờ phê duyệt</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map(req => (
                    <div
                      key={req.id}
                      className={`border rounded-lg p-4 transition-colors ${selectedReqIds.has(req.id) ? 'border-indigo-300 bg-indigo-50/40' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={selectedReqIds.has(req.id)}
                            onChange={() => toggleReqSelect(req.id)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${req.requestType === 'delete' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {req.requestType === 'delete' ? 'XÓA' : 'SỬA'}
                              </span>
                              <h3 className="font-semibold">{req.documentName}</h3>
                            </div>
                            <p className="text-sm text-gray-600">Người yêu cầu: {req.requestedByName}</p>
                            <p className="text-sm text-gray-600">Lý do: {req.reason}</p>
                            <p className="text-sm text-gray-600">Ngày: {req.requestedAt.toLocaleDateString('vi-VN')}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveRequest(req)}
                            disabled={processingId === req.id || bulkProcessing}
                          >
                            {processingId === req.id
                              ? <Loader2 className="h-4 w-4 animate-spin" />
                              : <><Check className="h-4 w-4 mr-1" /> Duyệt</>
                            }
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectRequest(req)}
                            disabled={processingId === req.id || bulkProcessing}
                          >
                            <X className="h-4 w-4 mr-1" /> Từ chối
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
