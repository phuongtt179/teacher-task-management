import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { fileRequestService } from '@/services/fileRequestService';
import { FileRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

export function MyRequestsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyRequests();
  }, [user]);

  const loadMyRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const reqs = await fileRequestService.getRequests({
        requestedBy: user.uid,
      });
      setRequests(reqs);
    } catch (error) {
      console.error('Error loading my requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Chờ phê duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Từ chối
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Yêu cầu của tôi</h1>
        <p className="text-gray-600 mt-2">Theo dõi yêu cầu xóa/sửa hồ sơ</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách yêu cầu ({requests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-gray-500">Đang tải...</p>
          ) : requests.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Bạn chưa có yêu cầu nào</p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
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
                    </div>
                    {getStatusBadge(req.status)}
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">
                      <strong>Lý do:</strong> {req.reason}
                    </p>
                    <p className="text-gray-600">
                      <strong>Ngày yêu cầu:</strong> {req.requestedAt.toLocaleDateString('vi-VN')}
                    </p>

                    {req.status !== 'pending' && req.reviewedBy && (
                      <>
                        <p className="text-gray-600">
                          <strong>Người phê duyệt:</strong> {req.reviewedByName}
                        </p>
                        {req.reviewedAt && (
                          <p className="text-gray-600">
                            <strong>Ngày phê duyệt:</strong>{' '}
                            {req.reviewedAt.toLocaleDateString('vi-VN')}
                          </p>
                        )}
                        {req.reviewNote && (
                          <p className="text-gray-600">
                            <strong>Ghi chú:</strong> {req.reviewNote}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
