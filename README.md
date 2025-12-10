# TEACHER TASK MANAGEMENT - PROJECT DOCUMENTATION

## 📖 GIỚI THIỆU DỰ ÁN

**Teacher Task Management** là hệ thống quản lý công việc toàn diện dành cho môi trường giáo dục, giúp tối ưu hóa quy trình giao việc, theo dõi tiến độ và đánh giá hiệu suất của giáo viên.

### Mục tiêu chính
- Số hóa quy trình giao việc và quản lý công việc trong trường học
- Tạo sự minh bạch trong đánh giá hiệu suất giáo viên
- Tăng cường tương tác giữa ban giám hiệu và giáo viên
- Xây dựng văn hóa cạnh tranh lành mạnh thông qua hệ thống xếp hạng

---

## 👥 HỆ THỐNG VAI TRÒ

### 1. ADMIN (Quản trị viên)
**Quyền hạn:**
- ✅ Quản lý whitelist email (kiểm soát ai được phép đăng ký)
- ✅ Xem tổng quan toàn hệ thống
- ✅ Quản lý người dùng (đang phát triển)
- ✅ Truy cập tất cả dữ liệu

**Dashboard hiển thị:**
- Tổng số người dùng
- Số lượng email trong whitelist
- Tổng công việc trong hệ thống
- Người dùng hoạt động gần đây (7 ngày)

### 2. VICE PRINCIPAL (Hiệu trưởng/Phó hiệu trưởng)
**Quyền hạn:**
- ✅ Tạo công việc mới
- ✅ Phân công công việc cho giáo viên
- ✅ Xem danh sách tất cả công việc đã tạo
- ✅ Chấm điểm bài nộp của giáo viên
- ✅ Viết feedback cho bài nộp
- ✅ Xem thống kê chi tiết theo giáo viên
- ✅ Xem thống kê tổng quan toàn trường

**Dashboard hiển thị:**
- Tổng công việc đã tạo
- Số công việc hoàn thành
- Số bài nộp chờ chấm điểm
- Tỷ lệ hoàn thành
- Tỷ lệ nộp bài
- Điểm trung bình các task đã chấm

### 3. TEACHER (Giáo viên)
**Quyền hạn:**
- ✅ Xem công việc được giao
- ✅ Cập nhật trạng thái công việc
- ✅ Nộp báo cáo kèm file đính kèm
- ✅ Xem điểm số của mình
- ✅ Xem feedback từ hiệu trưởng
- ✅ Xem vị trí xếp hạng của mình

**Dashboard hiển thị:**
- Công việc đang làm
- Công việc đã hoàn thành
- Công việc quá hạn
- Điểm trung bình cá nhân
- Vị trí xếp hạng

---

## 🔄 QUY TRÌNH LÀM VIỆC

### Workflow Chi Tiết

```
┌─────────────────────────────────────────────────┐
│  1. HIỆU TRƯỞNG TẠO TASK                       │
│     - Nhập tiêu đề, mô tả                      │
│     - Chọn độ ưu tiên (low/medium/high)        │
│     - Đặt deadline                              │
│     - Chọn giáo viên được giao                 │
│     - Thiết lập điểm tối đa (mặc định 10)      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  2. HỆ THỐNG GỬI THÔNG BÁO                     │
│     - Push notification                         │
│     - Email notification (nếu có)              │
│     - In-app notification                       │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  3. GIÁO VIÊN NHẬN & XEM TASK                  │
│     - Trạng thái: assigned                     │
│     - Xem chi tiết công việc                    │
│     - Xem deadline                              │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  4. GIÁO VIÊN BẮT ĐẦU LÀM                      │
│     - Cập nhật trạng thái: in_progress         │
│     - Hệ thống ghi nhận thời gian bắt đầu      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  5. GIÁO VIÊN NỘP BÁO CÁO                      │
│     - Viết nội dung báo cáo                    │
│     - Upload file đính kèm (nếu có)            │
│     - Trạng thái: submitted                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  6. HIỆU TRƯỞNG NHẬN THÔNG BÁO                 │
│     - Thông báo có bài nộp mới                 │
│     - Xem danh sách bài chờ chấm               │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  7. HIỆU TRƯỞNG CHẤM ĐIỂM                      │
│     - Xem nội dung báo cáo                     │
│     - Download file đính kèm                    │
│     - Nhập điểm (0 - maxScore)                 │
│     - Viết feedback                             │
│     - Trạng thái: completed                    │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  8. GIÁO VIÊN NHẬN KẾT QUẢ                     │
│     - Thông báo đã được chấm điểm              │
│     - Xem điểm và feedback                      │
│     - Điểm được cập nhật vào bảng xếp hạng     │
└─────────────────────────────────────────────────┘
```

---

## 📊 TRẠNG THÁI CÔNG VIỆC

| Trạng thái | Mô tả | Màu hiển thị | Người thay đổi |
|-----------|-------|--------------|----------------|
| `assigned` | Đã được giao, chưa bắt đầu | Xám | Hệ thống (khi tạo) |
| `in_progress` | Đang thực hiện | Vàng/Cam | Giáo viên |
| `submitted` | Đã nộp, chờ chấm điểm | Tím | Giáo viên |
| `completed` | Hoàn thành, đã có điểm | Xanh | Hiệu trưởng |
| `overdue` | Quá hạn deadline | Đỏ | Hệ thống (tự động) |

---

## 🛠️ STACK CÔNG NGHỆ

### Frontend Framework & Core
```json
{
  "react": "^19.1.1",
  "typescript": "~5.9.3",
  "vite": "^7.1.7",
  "react-router-dom": "^7.9.4"
}
```

### State Management
- **Zustand** `^5.0.8` - Global state management (lightweight alternative to Redux)
- **React Hook Form** `^7.64.0` - Form state management
- **Zod** `^4.1.12` - Schema validation

### UI Components & Styling
- **TailwindCSS** `^3.4.18` - Utility-first CSS framework
- **Radix UI** - Headless, accessible components
  - Avatar, Checkbox, Dropdown Menu, Label, Select, Tabs, Toast
- **Lucide React** `^0.545.0` - Icon library
- **class-variance-authority** `^0.7.1` - Variant handling
- **tailwind-merge** - Smart Tailwind class merging

### Backend & Services (Firebase)
```json
{
  "firebase": "^12.4.0"
}
```

**Firebase Services được sử dụng:**
- 🔐 **Authentication** - Google Sign-In
- 🗄️ **Firestore** - NoSQL database
- 📁 **Storage** - File upload/download
- 🔔 **Cloud Messaging (FCM)** - Push notifications

### Development Tools
- **ESLint** - Code linting
- **TypeScript ESLint** - TS-specific linting
- **Autoprefixer** - CSS vendor prefixes
- **PostCSS** - CSS processing

### PWA Support
- **vite-plugin-pwa** `^1.0.3` - Progressive Web App support
- Service Worker for offline capabilities
- App manifest for installability

---

## 📁 CẤU TRÚC DỰ ÁN CHI TIẾT

```
teacher-task-management/
│
├── public/                      # Static assets
│   ├── icons/                   # PWA icons
│   └── manifest.json           # PWA manifest
│
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── dashboard/
│   │   │   ├── QuickAction.tsx      # Action buttons
│   │   │   └── StatsCard.tsx        # Statistic cards
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx        # Main layout wrapper
│   │   │   ├── Sidebar.tsx          # Desktop sidebar
│   │   │   ├── BottomNav.tsx        # Mobile navigation
│   │   │   └── Header.tsx           # Top header
│   │   │
│   │   ├── tasks/
│   │   │   ├── TaskCard.tsx         # Task display card
│   │   │   └── TaskStatusBadge.tsx  # Status indicator
│   │   │
│   │   ├── ui/                      # Radix UI components
│   │   │   ├── alert.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── select.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   └── use-toast.ts
│   │   │
│   │   ├── DevLogin.tsx             # Development login tool
│   │   └── ProtectedRoute.tsx       # Route protection HOC
│   │
│   ├── features/               # Feature modules
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   └── WhitelistScreen.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── WhitelistChecker.tsx
│   │   │
│   │   ├── common/
│   │   │   ├── NotificationsScreen.tsx
│   │   │   └── RankingsScreen.tsx
│   │   │
│   │   ├── teacher/
│   │   │   ├── MyScoreScreen.tsx
│   │   │   ├── MyTasksScreen.tsx
│   │   │   ├── SubmitReportScreen.tsx
│   │   │   └── TeacherDashboard.tsx
│   │   │
│   │   └── vice-principal/
│   │       ├── CreateTaskScreen.tsx
│   │       ├── StatisticsScreen.tsx
│   │       ├── TaskDetailScreen.tsx
│   │       ├── TaskListScreen.tsx
│   │       └── VPDashboard.tsx
│   │
│   ├── hooks/                  # Custom React hooks
│   │   ├── useAuth.ts              # Authentication hook
│   │   ├── useFCM.ts               # Firebase Cloud Messaging
│   │   └── use-toast.ts            # Toast notifications
│   │
│   ├── lib/                    # Utility libraries
│   │   ├── firebase.ts             # Firebase configuration
│   │   ├── navigation.ts           # Navigation config
│   │   └── utils.ts                # Helper functions
│   │
│   ├── services/               # Business logic layer
│   │   ├── analyticsService.ts     # Statistics & analytics
│   │   ├── notificationService.ts  # Notification handling
│   │   ├── rankingService.ts       # Ranking calculations
│   │   ├── suggestionService.ts    # AI suggestions (future)
│   │   └── taskService.ts          # Task CRUD operations
│   │
│   ├── stores/                 # State management
│   │   └── authStore.ts            # Auth state (Zustand)
│   │
│   ├── types/                  # TypeScript definitions
│   │   └── index.ts                # All type definitions
│   │
│   ├── App.tsx                 # Main App component
│   ├── main.tsx                # Application entry point
│   ├── app.css                 # Global styles
│   └── index.css               # Tailwind imports
│
├── index.html                  # HTML template
├── package.json                # Dependencies
├── tsconfig.json              # TypeScript config
├── tailwind.config.js         # Tailwind config
├── vite.config.ts             # Vite config
└── README.md                  # Project documentation
```

---

## 🎨 TÍNH NĂNG CHI TIẾT

### 1. AUTHENTICATION & AUTHORIZATION

#### Whitelist System
- Admin quản lý danh sách email được phép đăng ký
- Khi user đăng nhập bằng Google, hệ thống kiểm tra email
- Nếu không trong whitelist → từ chối truy cập
- Hiển thị thông báo yêu cầu liên hệ admin

#### Role-Based Access Control (RBAC)
```typescript
type UserRole = 'admin' | 'vice_principal' | 'teacher';

interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. QUẢN LÝ CÔNG VIỆC

#### Tạo Task (Vice Principal)
```typescript
interface Task {
  id: string;
  title: string;              // Tiêu đề công việc
  description: string;        // Mô tả chi tiết
  priority: 'low' | 'medium' | 'high';
  status: TaskStatus;
  maxScore: number;           // Điểm tối đa (mặc định 10)
  deadline: Date;
  createdBy: string;          // VP uid
  createdByName: string;
  assignedTo: string[];       // Array of teacher UIDs
  assignedToNames: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

**Tính năng:**
- Chọn nhiều giáo viên cùng lúc
- Đặt độ ưu tiên màu sắc
- Tùy chỉnh điểm tối đa
- Tự động gửi thông báo cho giáo viên

#### Submit Report (Teacher)
```typescript
interface Submission {
  id: string;
  taskId: string;
  teacherId: string;
  teacherName: string;
  content: string;            // Nội dung báo cáo
  fileUrls: string[];         // URLs of uploaded files
  submittedAt: Date;
  score?: number;             // Điểm (0-maxScore)
  scoredBy?: string;          // VP uid
  scoredByName?: string;
  scoredAt?: Date;
  feedback?: string;          // Nhận xét từ VP
}
```

**Tính năng:**
- Editor văn bản rich text (textarea)
- Upload nhiều file (Firebase Storage)
- Xem trước file đã upload
- Không thể chỉnh sửa sau khi nộp

#### Chấm điểm (Vice Principal)
- Xem nội dung báo cáo
- Download file đính kèm
- Nhập điểm (validation: 0 ≤ score ≤ maxScore)
- Viết feedback chi tiết
- Cập nhật trạng thái thành "completed"

### 3. HỆ THỐNG THÔNG BÁO

#### Notification Types
```typescript
type NotificationType = 
  | 'task_assigned'     // Được giao việc mới
  | 'task_deadline'     // Sắp đến deadline
  | 'task_scored'       // Được chấm điểm
  | 'task_submitted';   // Có bài nộp mới (cho VP)

interface Notification {
  id: string;
  userId: string;           // Người nhận
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    taskId?: string;
    taskTitle?: string;
    score?: number;
    submissionId?: string;
  };
  read: boolean;
  createdAt: Date;
}
```

#### Push Notification (FCM)
- Thông báo real-time qua Firebase Cloud Messaging
- Hoạt động cả khi app đóng
- Badge counter trên icon app
- Sound & vibration

#### In-App Notification
- Bell icon với số lượng unread
- Danh sách thông báo có phân trang
- Đánh dấu đã đọc
- Click để navigate đến task liên quan

### 4. THỐNG KÊ & PHÂN TÍCH

#### School Statistics (Toàn trường)
```typescript
interface SchoolStats {
  totalTeachers: number;          // Tổng giáo viên
  totalTasks: number;             // Tổng công việc
  completedTasks: number;         // Đã hoàn thành
  averageScore: number;           // Điểm TB toàn trường
  completionRate: number;         // Tỷ lệ hoàn thành (%)
  highPerformers: number;         // Số người đạt điểm cao
  averagePerformers: number;      // Số người đạt điểm TB
  lowPerformers: number;          // Số người đạt điểm thấp
}
```

#### Teacher Statistics (Từng giáo viên)
```typescript
interface TeacherStats {
  teacherId: string;
  teacherName: string;
  totalTasks: number;             // Tổng công việc
  completedTasks: number;         // Đã hoàn thành
  pendingTasks: number;           // Đang làm
  overdueTasks: number;           // Quá hạn
  averageScore: number;           // Điểm trung bình
  completionRate: number;         // Tỷ lệ hoàn thành (%)
  totalScore: number;             // Tổng điểm
  scoredTasks: number;            // Số bài đã được chấm
}
```

#### VP Statistics (Công việc của VP)
```typescript
interface VPStats {
  totalTasks: number;             // Tổng task đã tạo
  completedTasks: number;         // Đã hoàn thành
  submittedTasks: number;         // Chờ chấm điểm
  assignedTasks: number;          // Đang thực hiện
  completionRate: number;         // Tỷ lệ hoàn thành
  submissionRate: number;         // Tỷ lệ nộp bài
  averageScore: number;           // Điểm TB các task đã chấm
}
```

#### Biểu đồ & Visualizations
- **Bar Chart**: Phân bố hiệu suất (xuất sắc/khá/TB)
- **Progress Bars**: Tỷ lệ hoàn thành theo trạng thái
- **Ranking Table**: Top giáo viên theo điểm
- **Trend Lines**: Xu hướng theo thời gian (future)

### 5. BẢNG XẾP HẠNG

#### Ranking Algorithm
```typescript
// Sắp xếp theo:
1. averageScore (DESC)        // Điểm TB cao hơn
2. completionRate (DESC)      // Tỷ lệ hoàn thành cao hơn
3. completedTasks (DESC)      // Số lượng task hoàn thành nhiều hơn
```

#### Display Features
- 🥇 Top 1: Gold highlight
- 🥈 Top 2: Silver highlight
- 🥉 Top 3: Bronze highlight
- Hiển thị: Avatar, tên, điểm TB, số task, tỷ lệ hoàn thành
- Vị trí của mình được highlight riêng
- Real-time update khi có điểm mới

---

## 🔐 BẢO MẬT & QUYỀN HẠN

### Firestore Security Rules (Ví dụ)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId 
                   || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Tasks collection
    match /tasks/{taskId} {
      allow read: if request.auth != null;
      allow create: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'vice_principal';
      allow update, delete: if resource.data.createdBy == request.auth.uid;
    }
    
    // Submissions collection
    match /submissions/{submissionId} {
      allow read: if request.auth != null;
      allow create: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
      allow update: if resource.data.teacherId == request.auth.uid 
                    || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'vice_principal';
    }
  }
}
```

### Protected Routes
```typescript
<ProtectedRoute allowedRoles={['vice_principal']}>
  <CreateTaskScreen />
</ProtectedRoute>
```

---

## 📱 RESPONSIVE & PWA

### Breakpoints
- **Mobile**: < 768px → Bottom Navigation
- **Tablet**: 768px - 1024px → Collapsible Sidebar
- **Desktop**: > 1024px → Full Sidebar

### PWA Features
- **Installable**: Có thể cài đặt như native app
- **Offline-first**: Cache assets với Service Worker
- **App-like**: Fullscreen, splash screen
- **Icons**: Multiple sizes (72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512)

---

## 🚀 DEPLOYMENT & DEVELOPMENT

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (http://localhost:5173)
npm run lint         # Run ESLint
```

### Build & Preview
```bash
npm run build        # Build for production
npm run preview      # Preview production build
```

### Environment Variables
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

---

## 🎯 ROADMAP & FUTURE FEATURES

### Đang phát triển
- [ ] Quản lý Users (Admin)
- [ ] AI Suggestions cho task creation
- [ ] Rich Text Editor cho báo cáo
- [ ] Export reports (PDF, Excel)

### Kế hoạch tương lai
- [ ] Email notifications
- [ ] Calendar integration
- [ ] Mobile app (React Native)
- [ ] Multi-language support
- [ ] Dark mode
- [ ] Advanced analytics dashboard
- [ ] Team/Department management
- [ ] Task templates
- [ ] Recurring tasks
- [ ] Task dependencies
- [ ] Comments & discussions
- [ ] Activity logs
- [ ] Backup & restore

---

## 📞 HỖ TRỢ & LIÊN HỆ

### Báo lỗi & Góp ý
- GitHub Issues (nếu có repository)
- Email: [your-email@example.com]
- Slack/Discord (nếu có)

### Tài liệu tham khảo
- [Firebase Documentation](https://firebase.google.com/docs)
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs)

---

## 📄 LICENSE

[Thêm thông tin license của dự án]

---

**Last Updated**: October 14, 2025  
**Version**: 0.0.0  
**Author**: [Your Name/Team]