import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionProps {
  label: string;
  icon: LucideIcon;
  path: string;
  variant?: 'default' | 'outline' | 'secondary';
}

export const QuickAction = ({ 
  label, 
  icon: Icon, 
  path,
  variant = 'outline' 
}: QuickActionProps) => {
  const navigate = useNavigate();

  return (
    <Button
      variant={variant}
      className="w-full justify-start gap-2 h-auto py-4"
      onClick={() => navigate(path)}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </Button>
  );
};