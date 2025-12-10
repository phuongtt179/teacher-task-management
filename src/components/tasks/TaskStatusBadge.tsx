import { TaskStatus } from '../../types';
import { Badge } from '@/components/ui/badge';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

export const TaskStatusBadge = ({ status }: TaskStatusBadgeProps) => {
  const statusConfig = {
    assigned: {
      label: 'Đã giao',
      variant: 'secondary' as const,
      className: 'bg-blue-100 text-blue-700',
    },
    in_progress: {
      label: 'Đang làm',
      variant: 'secondary' as const,
      className: 'bg-yellow-100 text-yellow-700',
    },
    submitted: {
      label: 'Đã nộp',
      variant: 'secondary' as const,
      className: 'bg-purple-100 text-purple-700',
    },
    completed: {
      label: 'Hoàn thành',
      variant: 'secondary' as const,
      className: 'bg-green-100 text-green-700',
    },
    overdue: {
      label: 'Quá hạn',
      variant: 'destructive' as const,
      className: 'bg-red-100 text-red-700',
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
};