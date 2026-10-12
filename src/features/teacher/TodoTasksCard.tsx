import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { taskService } from '../../services/taskService';
import { schoolYearService } from '../../services/schoolYearService';
import { Task } from '../../types';
import { Button } from '@/components/ui/button';
import { ClipboardList, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;
// Việc quá hạn quá số ngày này (chưa nộp) không hiện ở đây — xem ở "Công việc của tôi".
const OVERDUE_DAYS_SHOWN = 14;

// Hạn dùng để nhắc: hạn 1, hoặc hạn 2 nếu đã qua hạn 1 mà vẫn còn hạn 2.
function effectiveDeadline(task: Task, now: number): Date {
  if (task.deadline2 && now > task.deadline.getTime() && now <= task.deadline2.getTime()) return task.deadline2;
  return task.deadline;
}

/** "còn 3 ngày" / "hôm nay" / "quá hạn 2 ngày" — tính theo ngày lịch (giờ máy). */
function relativeDeadline(deadline: Date, now: number): { text: string; overdue: boolean; soon: boolean } {
  const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOfDay(deadline.getTime()) - startOfDay(now)) / DAY_MS);
  if (deadline.getTime() < now) return { text: days === 0 ? 'quá hạn hôm nay' : `quá hạn ${-days} ngày`, overdue: true, soon: false };
  if (days === 0) return { text: 'hết hạn hôm nay', overdue: false, soon: true };
  if (days === 1) return { text: 'còn 1 ngày', overdue: false, soon: true };
  return { text: `còn ${days} ngày`, overdue: false, soon: days <= 3 };
}

/**
 * "Việc cần làm": việc được giao CHƯA nộp, hạn gần nhất ở trên (quá hạn trong 14 ngày
 * gần nhất nằm đầu, tô đỏ). Đọc ít — xem taskService.getTodoTasksForTeacher.
 */
export const TodoTasksCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user?.schoolId) return;
    const schoolId = user.schoolId;
    let active = true;
    (async () => {
      try {
        const year = await schoolYearService.getActiveSchoolYear(schoolId);
        const list = year ? await taskService.getTodoTasksForTeacher(schoolId, user.uid, year.id, OVERDUE_DAYS_SHOWN) : [];
        const now = Date.now();
        list.sort((a, b) => effectiveDeadline(a, now).getTime() - effectiveDeadline(b, now).getTime());
        if (active) setTasks(list);
      } catch (e) {
        console.error('Error loading todo tasks:', e);
        if (active) setError(true);
      }
    })();
    return () => { active = false; };
  }, [user?.schoolId, user?.uid]);

  const now = Date.now();

  return (
    <div className="bg-white rounded-lg border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-indigo-600" /> Việc cần làm
          {tasks && tasks.length > 0 && (
            <span className="text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">{tasks.length}</span>
          )}
        </h3>
        <button type="button" onClick={() => navigate('/teacher/my-tasks')} className="text-sm text-indigo-600 hover:underline">
          Tất cả công việc
        </button>
      </div>

      {error ? (
        <p className="px-4 py-6 text-sm text-red-600 text-center">Không tải được danh sách. Vui lòng tải lại trang.</p>
      ) : tasks === null ? (
        <div className="py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : tasks.length === 0 ? (
        <p className="px-4 py-8 text-sm text-gray-500 text-center flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
          Không có việc nào cần làm.
        </p>
      ) : (
        <ul className="divide-y">
          {tasks.map(task => {
            const deadline = effectiveDeadline(task, now);
            const rel = relativeDeadline(deadline, now);
            return (
              <li key={task.id} className={`px-4 py-3 flex items-center gap-3 ${rel.overdue ? 'bg-red-50' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{task.title}</p>
                  <p className={`text-xs mt-0.5 flex items-center gap-1 ${rel.overdue ? 'text-red-600 font-medium' : rel.soon ? 'text-amber-600' : 'text-gray-500'}`}>
                    {rel.overdue ? <AlertTriangle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    Hạn {deadline.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} {deadline.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {rel.text}
                    {deadline === task.deadline2 && ' (hạn 2)'}
                  </p>
                </div>
                <Button size="sm" variant={rel.overdue ? 'destructive' : 'default'} onClick={() => navigate(`/teacher/tasks/${task.id}`)}>
                  Nộp
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
