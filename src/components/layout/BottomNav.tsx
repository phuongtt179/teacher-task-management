import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationForRole } from '../../lib/navigation';
import { cn } from '@/lib/utils';

export const BottomNav = () => {
  const { user } = useAuth();
  const navItems = user ? getNavigationForRole(user.role).slice(0, 4) : []; // Show max 4 items

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-3 px-4 flex-1 transition-colors',
                  isActive ? 'text-indigo-600' : 'text-gray-600'
                )
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium whitespace-nowrap">{item.shortLabel || item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};