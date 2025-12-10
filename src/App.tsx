import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginScreen } from './features/auth/LoginScreen';
import { WhitelistChecker } from './features/auth/WhitelistChecker';
import { WhitelistScreen } from './features/admin/WhitelistScreen';
import { AdminDashboard } from './features/admin/AdminDashboard';
import UserManagementScreen from './features/admin/UserManagementScreen';
import { VPDashboard } from './features/vice-principal/VPDashboard';
import { CreateTaskScreen } from './features/vice-principal/CreateTaskScreen';
import { TaskListScreen } from './features/vice-principal/TaskListScreen';
import { TaskDetailScreen } from './features/vice-principal/TaskDetailScreen';
import { StatisticsScreen } from './features/vice-principal/StatisticsScreen';
import { TaskDetailStatisticsScreen } from './features/vice-principal/TaskDetailStatisticsScreen';
import { TeacherDetailStatisticsScreen } from './features/vice-principal/TeacherDetailStatisticsScreen';
import { TeacherDashboard } from './features/teacher/TeacherDashboard';
import { MyTasksScreen } from './features/teacher/MyTasksScreen';
import { SubmitReportScreen } from './features/teacher/SubmitReportScreen';
import { MyScoresScreen } from './features/teacher/MyScoresScreen';
import { RankingsScreen } from './features/common/RankingsScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { Toaster } from '@/components/ui/toaster';
import { NotificationsScreen } from './features/common/NotificationsScreen';
import { useFCM } from './hooks/useFCM';
import { DocumentConfigScreen } from './features/documents/DocumentConfigScreen';
import { DocumentBrowseScreen } from './features/documents/DocumentBrowseScreen';
import { DocumentUploadScreen } from './features/documents/DocumentUploadScreen';
import { DocumentApprovalsScreen } from './features/documents/DocumentApprovalsScreen';
import { MyRequestsScreen } from './features/documents/MyRequestsScreen';
import { TeacherProfileScreen } from './features/teacher/TeacherProfileScreen';
// Dashboard router based on role
const DashboardRouter = () => {
  const { user } = useAuth();

  if (!user) return null;

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'vice_principal':
      return <VPDashboard />;
    case 'teacher':
    case 'department_head':
      return <TeacherDashboard />;
    default:
      return <div>Invalid role</div>;
  }
};

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
              <AppLayout>
                <DashboardRouter />
              </AppLayout>
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

        {/* Vice Principal Routes */}
        <Route
          path="/vp/create-task"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
              <AppLayout>
                <CreateTaskScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/tasks"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
              <AppLayout>
                <TaskListScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/tasks/:taskId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
              <AppLayout>
                <TaskDetailScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vp/statistics"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
              <AppLayout>
                <StatisticsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vice-principal/statistics/task/:taskId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
              <AppLayout>
                <TaskDetailStatisticsScreen />
              </AppLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vice-principal/statistics/teacher/:teacherId"
          element={
            <ProtectedRoute allowedRoles={['vice_principal']}>
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
            <ProtectedRoute allowedRoles={['admin', 'vice_principal', 'department_head']}>
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
            <ProtectedRoute allowedRoles={['admin', 'vice_principal']}>
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