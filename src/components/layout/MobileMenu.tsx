import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getNavigationForRole } from '../../lib/navigation';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';

export const MobileMenu = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navItems = user ? getNavigationForRole(user.role) : [];

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden p-2 text-gray-700 hover:text-indigo-600 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsOpen(false)}>
          {/* Menu Drawer */}
          <div
            className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">Menu</h2>
                <p className="text-xs text-gray-500">{user?.displayName}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="p-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      )
                    }
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
};
