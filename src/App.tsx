import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './features/auth/LoginScreen';
import { WhitelistChecker } from './features/auth/WhitelistChecker';
import { WhitelistScreen } from './features/admin/WhitelistScreen';
import { AdminDashboard } from './features/admin/AdminDashboard';
import UserManagementScreen from './features/admin/UserManagementScreen';
import { DocumentTypesScreen } from './features/admin/DocumentTypesScreen';
import { VPDashboard } from './features/vice-principal/VPDashboard';
import { CreateTaskScreen } from './features/vice-principal/CreateTaskScreen';
import { ImportTasksScreen } from './features/vice-principal/ImportTasksScreen';
import { TaskListScreen } from './features/vice-principal/TaskListScreen';
import { TaskDetailScreen } from './features/vice-principal/TaskDetailScreen';
import { StatisticsScreen } from './features/vice-principal/StatisticsScreen';
import { TaskDetailStatisticsScreen } from './features/vice-principal/TaskDetailStatisticsScreen';
import { TeacherDetailStatisticsScreen } from './features/vice-principal/TeacherDetailStatisticsScreen';
import { TeacherDashboard } from './features/teacher/TeacherDashboard';
import { ChatScreen } from './features/teacher/ChatScreen';
import { MyTasksScreen } from './features/teacher/MyTasksScreen';
import { SubmitReportScreen } from './features/teacher/SubmitReportScreen';
import { MyScoresScreen } from './features/teacher/MyScoresScreen';
import { RankingsScreen } from './features/common/RankingsScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import { NotificationsScreen } from './features/common/NotificationsScreen';
import { useFCM } from './hooks/useFCM';
import { useServiceWorker } from './hooks/useServiceWorker';
import { DocumentConfigScreen } from './features/documents/DocumentConfigScreen';
import { DocumentBrowseScreen } from './features/documents/DocumentBrowseScreen';
import { DocumentUploadScreen } from './features/documents/DocumentUploadScreen';
import { DocumentApprovalsScreen } from './features/documents/DocumentApprovalsScreen';
import { MyRequestsScreen } from './features/documents/MyRequestsScreen';
import { TeacherProfileScreen } from './features/teacher/TeacherProfileScreen';
import { deadlineCheckerService } from './services/deadlineCheckerService';
// Dashboard router based on role — trang chủ luôn là dashboard; Trợ lý AI truy cập
// qua icon robot trên Header (route /chat riêng), mở cho mọi vai trò.
const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'principal':
    case 'vice_principal':
      return <VPDashboard />;
    case 'teacher':
    case 'department_head':
    case 'staff':
      return <TeacherDashboard />;
    case 'van_thu':
      return <PlaceholderScreen title="Bấm biểu tượng 🤖 Trợ lý AI ở góc trên bên phải để bắt đầu — nghiệp vụ văn thư thực hiện qua Trợ lý AI." />;
    default:
      return <div>Invalid role</div>;
  }
};

const HomeScreen = () => {
  return (
    <AppLayout>
      <DashboardRouter />
    </AppLayout>
  );
};

// Trang Trợ lý AI (chat) — mở từ icon robot trên Header, dùng chung cho mọi vai trò.
// hideSidebar để ChatScreen tự quản lý bố cục danh sách kênh + khung chat.
const ChatPage = () => (
  <AppLayout hideSidebar>
    <ChatScreen />
  </AppLayout>
);

// Placeholder components
const PlaceholderScreen = ({ title }: { title: string }) => (
  <div className="max-w-4xl mx-auto">
    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600">Tính năng này sẽ được triển khai trong giai đoạn tiếp theo</p>
    </div>
  </div>
);

function App() {
  const { firebaseUser, isLoading, isWhitelisted } = useAuth();

  // Initialize FCM
  useFCM();

  // Initialize Service Worker auto-update
  useServiceWorker();

  // Start/stop deadline checker based on authentication
  useEffect(() => {
    if (firebaseUser && isWhitelisted) {
      deadlineCheckerService.startChecking();
    } else {
      deadlineCheckerService.stopChecking();
    }

    return () => {
      deadlineCheckerService.stopChecking();
    };
  }, [firebaseUser, isWhitelisted]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!firebaseUser) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  // Logged in but not whitelisted
  if (isWhitelisted === false) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<WhitelistChecker />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  // Logged in and whitelisted
  return (
    <BrowserRouter>
      <Routes>
        {/* Dashboard */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomeScreen />
            </ProtectedRoute>
          }
        />

        {/* Trợ lý AI (chat) — mọi vai trò, mở từ icon robot trên Header */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/whitelist"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <WhitelistScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <UserManagementScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/document-types"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AppLayout>
                <DocumentTypesScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Vice Principal Routes */}
        <Route
          path="/vp/create-task"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <CreateTaskScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/import-tasks"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <ImportTasksScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/tasks"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <TaskListScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/tasks/:taskId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <TaskDetailScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/statistics"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <StatisticsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vice-principal/statistics/task/:taskId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <TaskDetailStatisticsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vice-principal/statistics/teacher/:teacherId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal', 'principal']}>
              <AppLayout>
                <TeacherDetailStatisticsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/teacher/my-tasks"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'department_head']}>
              <AppLayout>
                <MyTasksScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/tasks/:taskId"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'department_head']}>
              <AppLayout>
                <SubmitReportScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/my-scores"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'department_head']}>
              <AppLayout>
                <MyScoresScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />

         {/* Common Routes */}
        <Route
          path="/rankings"
          element={
            <ProtectedRoute>
              <AppLayout>
                <RankingsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <AppLayout>
                <NotificationsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <AppLayout>
                <TeacherProfileScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        {/* Document Management Routes */}
        <Route
          path="/documents"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DocumentBrowseScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/upload"
          element={
            <ProtectedRoute>
              <AppLayout>
                <DocumentUploadScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/approvals"
          element={
            <ProtectedRoute allowedRoles={['admin', 'vice_principal', 'principal', 'department_head']}>
              <AppLayout>
                <DocumentApprovalsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/my-requests"
          element={
            <ProtectedRoute allowedRoles={['teacher', 'department_head']}>
              <AppLayout>
                <MyRequestsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/documents/config"
          element={
            <ProtectedRoute allowedRoles={['admin', 'vice_principal', 'principal']}>
              <AppLayout>
                <DocumentConfigScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;