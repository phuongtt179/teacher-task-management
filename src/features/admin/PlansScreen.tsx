import { useState, useEffect } from 'react';
import { planService } from '../../services/planService';
import { Plan } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tag, Plus, Pencil, Trash2, Power } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const GB = 1024 * 1024 * 1024;

const emptyForm = {
  name: '',
  priceVnd: '',
  promoPriceVnd: '',
  promoMonths: '',
  aiMessageLimit: '',
  storageLimitGb: '',
};

// Super-admin-only: the actual source of truth for pricing/limits. Nothing in
// the app hardcodes these numbers — a price change here takes effect
// immediately, no deploy needed.
export const PlansScreen = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  const loadPlans = async () => {
    setIsFetching(true);
    try {
      setPlans(await planService.getAllPlans());
    } catch (error) {
      console.error('Error loading plans:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải danh sách gói' });
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => { loadPlans(); }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      priceVnd: String(plan.priceVnd),
      promoPriceVnd: plan.promoPriceVnd ? String(plan.promoPriceVnd) : '',
      promoMonths: plan.promoMonths ? String(plan.promoMonths) : '',
      aiMessageLimit: plan.aiMessageLimit === -1 ? '' : String(plan.aiMessageLimit),
      storageLimitGb: plan.storageLimitBytes === -1 ? '' : String(plan.storageLimitBytes / GB),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.priceVnd) {
      toast({ variant: 'destructive', title: 'Thiếu thông tin', description: 'Cần tên gói và giá' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        priceVnd: Number(form.priceVnd),
        promoPriceVnd: form.promoPriceVnd ? Number(form.promoPriceVnd) : undefined,
        promoMonths: form.promoMonths ? Number(form.promoMonths) : undefined,
        // Bỏ trống = không giới hạn (-1)
        aiMessageLimit: form.aiMessageLimit ? Number(form.aiMessageLimit) : -1,
        storageLimitBytes: form.storageLimitGb ? Math.round(Number(form.storageLimitGb) * GB) : -1,
        isActive: true,
      };

      if (editingId) {
        await planService.updatePlan(editingId, payload);
        toast({ title: 'Đã cập nhật', description: `Gói "${payload.name}" đã lưu` });
      } else {
        await planService.createPlan(payload);
        toast({ title: 'Đã tạo', description: `Gói "${payload.name}" đã được thêm` });
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể lưu gói' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    try {
      await planService.updatePlan(plan.id, { isActive: !plan.isActive });
      loadPlans();
    } catch (error) {
      console.error('Error toggling plan:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể cập nhật gói' });
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!confirm(`Xóa gói "${plan.name}"? Các trường đang dùng gói này sẽ mất hạn mức tham chiếu.`)) return;
    try {
      await planService.deletePlan(plan.id);
      toast({ title: 'Đã xóa', description: `Gói "${plan.name}" đã bị xóa` });
      loadPlans();
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể xóa gói' });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Quản lý gói dịch vụ</CardTitle>
          <CardDescription>
            Đây là nơi đổi giá / hạn mức thật sự — thay đổi ở đây có hiệu lực ngay, không cần deploy code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showForm && (
            <Button onClick={startCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm gói mới
            </Button>
          )}

          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Tên gói</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Cơ bản" />
                </div>
                <div>
                  <Label>Giá / tháng (đồng)</Label>
                  <Input type="number" value={form.priceVnd} onChange={e => setForm({ ...form, priceVnd: e.target.value })} placeholder="800000" />
                </div>
                <div>
                  <Label>Giá khuyến mãi (đồng, để trống nếu không có)</Label>
                  <Input type="number" value={form.promoPriceVnd} onChange={e => setForm({ ...form, promoPriceVnd: e.target.value })} placeholder="400000" />
                </div>
                <div>
                  <Label>Số tháng áp dụng khuyến mãi</Label>
                  <Input type="number" value={form.promoMonths} onChange={e => setForm({ ...form, promoMonths: e.target.value })} placeholder="3" />
                </div>
                <div>
                  <Label>Tin nhắn AI / tháng (để trống = không giới hạn)</Label>
                  <Input type="number" value={form.aiMessageLimit} onChange={e => setForm({ ...form, aiMessageLimit: e.target.value })} placeholder="500" />
                </div>
                <div>
                  <Label>Dung lượng hồ sơ, GB (để trống = không giới hạn)</Label>
                  <Input type="number" value={form.storageLimitGb} onChange={e => setForm({ ...form, storageLimitGb: e.target.value })} placeholder="5" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={isSaving}>{editingId ? 'Lưu thay đổi' : 'Tạo gói'}</Button>
                <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Hủy</Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-gray-600">Danh sách gói ({plans.length})</h3>

            {isFetching ? (
              <div className="text-center py-8 text-gray-400">Đang tải...</div>
            ) : plans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có gói nào</p>
              </div>
            ) : (
              <div className="space-y-2">
                {plans.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div>
                      <p className="font-medium flex items-center gap-2 flex-wrap">
                        {plan.name}
                        <span className="font-mono text-sm text-indigo-700">{plan.priceVnd.toLocaleString('vi-VN')}đ/tháng</span>
                        {plan.promoPriceVnd && (
                          <Badge variant="secondary">KM {plan.promoMonths} tháng đầu: {plan.promoPriceVnd.toLocaleString('vi-VN')}đ</Badge>
                        )}
                        <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                          {plan.isActive ? 'Đang mở' : 'Đã ẩn'}
                        </Badge>
                      </p>
                      <p className="text-xs text-gray-500">
                        AI: {plan.aiMessageLimit === -1 ? 'không giới hạn' : `${plan.aiMessageLimit} tin/tháng`}
                        {' · '}
                        Hồ sơ: {plan.storageLimitBytes === -1 ? 'không giới hạn' : `${(plan.storageLimitBytes / GB).toFixed(1)}GB`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => startEdit(plan)} title="Sửa gói">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleToggleActive(plan)} title={plan.isActive ? 'Ẩn khỏi lựa chọn khi tạo trường mới' : 'Mở lại'}>
                        <Power className={`w-4 h-4 ${plan.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(plan)} title="Xóa gói">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
