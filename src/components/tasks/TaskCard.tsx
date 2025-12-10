import { Task } from '../../types';
import { Card, CardContent } from '@/components/ui/card';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Calendar, Users, AlertCircle } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface TaskCardProps {
  task: Task;
  showAssignees?: boolean;
  onClick?: () => void;
}

export const TaskCard = ({ task, showAssignees = true, onClick }: TaskCardProps) => {
  const navigate = useNavigate();
  const isOverdue = isPast(task.deadline) && task.status !== 'completed';

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-orange-600 bg-orange-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Cao';
      case 'medium':
        return 'Trung bình';
      case 'low':
        return 'Thấp';
      default:
        return priority;
    }
  };

  return (
    <Card 
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-gray-900 line-clamp-2 flex-1">
              {task.title}
            </h3>
            <TaskStatusBadge status={isOverdue ? 'overdue' : task.status} />
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {task.description}
          </p>

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {/* Priority */}
            <span className={`px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
              {getPriorityLabel(task.priority)}
            </span>

            {/* Deadline */}
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                {format(task.deadline, 'dd/MM/yyyy', { locale: vi })}
              </span>
            </div>

            {/* Assignees count */}
            {showAssignees && (
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                <span>{task.assignedTo.length} người</span>
              </div>
            )}

            {/* Score */}
            <div className="flex items-center gap-1">
              <span>Điểm tối đa: {task.maxScore}</span>
            </div>
          </div>

          {/* Overdue warning */}
          {isOverdue && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
              <AlertCircle className="w-4 h-4" />
              <span className="font-medium">Đã quá hạn</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};