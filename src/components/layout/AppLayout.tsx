import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

interface AppLayoutProps {
  children: ReactNode;
  // Khi true: bỏ Sidebar/BottomNav của app, cho children (vd: ChatScreen) tự quản lý
  // toàn bộ vùng bên trái và chiếm hết chiều cao còn lại dưới Header.
  hideSidebar?: boolean;
}

export const AppLayout = ({ children, hideSidebar }: AppLayoutProps) => {
  if (hideSidebar) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <Header hideSidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar for desktop */}
      <Sidebar />

      {/* Main content */}
      <div className="lg:pl-64">
        <Header />

        <main className="p-4 pb-20 lg:pb-4">
          {children}
        </main>
      </div>

      {/* Bottom navigation for mobile */}
      <BottomNav />
    </div>
  );
};