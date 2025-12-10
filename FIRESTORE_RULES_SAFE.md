# Firestore Security Rules - An toàn

Đây là bộ rules **an toàn** để sử dụng trong production sau khi test xong.

## 📋 Khi nào sử dụng:

- ✅ Sau khi test Google Drive upload thành công
- ✅ Khi deploy lên production
- ✅ Khi cần bảo mật dữ liệu

## 🔐 Rules an toàn:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isVicePrincipal() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'vice_principal';
    }

    function isDepartmentHead() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'department_head';
    }

    function isTeacher() {
      return isSignedIn() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }

    match /whitelist/{email} {
      allow read: if isSignedIn();
      allow write: if isAdmin();
    }

    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && (request.auth.uid == userId || isAdmin());
      allow create: if isSignedIn();
    }

    match /tasks/{taskId} {
      allow read: if isSignedIn();
      allow create: if isVicePrincipal() || isAdmin();
      allow update, delete: if isVicePrincipal() || isAdmin();
    }

    match /submissions/{submissionId} {
      allow read: if isSignedIn();
      allow create: if isTeacher() || isVicePrincipal() || isAdmin();
      allow update: if isSignedIn() &&
                    (request.auth.uid == resource.data.teacherId ||
                     isVicePrincipal() ||
                     isAdmin());
      allow delete: if isVicePrincipal() || isAdmin();
    }

    match /notifications/{notificationId} {
      allow read: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow create: if isSignedIn();
      allow update: if isSignedIn() && request.auth.uid == resource.data.userId;
      allow delete: if isSignedIn() &&
                    (request.auth.uid == resource.data.userId || isAdmin());
    }

    match /schoolYears/{yearId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isVicePrincipal();
    }

    match /documentCategories/{categoryId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isVicePrincipal();
    }

    match /documentSubCategories/{subCategoryId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isVicePrincipal();
    }

    match /departments/{departmentId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isVicePrincipal();
    }

    match /documents/{documentId} {
      // Tất cả users đã đăng nhập có thể đọc documents
      allow read: if isSignedIn();

      // Tất cả users đã đăng nhập có thể tạo documents
      allow create: if isSignedIn();

      // Chỉ admin hoặc người upload có thể sửa
      allow update: if isSignedIn() &&
                    (isAdmin() || request.auth.uid == resource.data.uploadedBy);

      // Chỉ admin hoặc người upload có thể xóa
      allow delete: if isSignedIn() &&
                    (isAdmin() || request.auth.uid == resource.data.uploadedBy);
    }

    match /fileRequests/{requestId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update: if isAdmin() || isVicePrincipal() || isDepartmentHead();
      allow delete: if isAdmin();
    }

    match /documentPermissions/{permissionId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isAdmin() || isVicePrincipal();
    }
  }
}
```

## 📝 Cách deploy:

### Cách 1: Firebase Console
1. Vào https://console.firebase.google.com/
2. Chọn project: **task-manager-npv**
3. Firestore Database → Tab Rules
4. Copy toàn bộ rules ở trên
5. Paste vào editor
6. Click "Publish"

### Cách 2: Command line
```bash
firebase deploy --only firestore:rules
```

## 🔒 Phân quyền trong rules này:

### Documents (Hồ sơ điện tử):
- **READ**: Tất cả users đã đăng nhập
- **CREATE**: Tất cả users đã đăng nhập
- **UPDATE**: Chỉ admin hoặc người upload
- **DELETE**: Chỉ admin hoặc người upload

### Tasks (Nhiệm vụ):
- **READ**: Tất cả users
- **CREATE**: Admin, Vice Principal
- **UPDATE/DELETE**: Admin, Vice Principal

### Users:
- **READ**: Tất cả users
- **WRITE**: Chỉ chính user đó hoặc admin

### School Years, Categories, Departments:
- **READ**: Tất cả users
- **WRITE**: Admin, Vice Principal

## ⚠️ Lưu ý:

- Rules này cân bằng giữa bảo mật và dễ sử dụng
- Tất cả users phải **đăng nhập** mới truy cập được
- Admin có quyền cao nhất
- Người upload có quyền quản lý documents của mình

## 🚨 Nếu cần rules chặt chẽ hơn:

Liên hệ để customize rules theo yêu cầu cụ thể của trường.
