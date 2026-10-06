// Logic tính thống kê nằm ở src/shared/statsCompute.js để server dùng chung đúng 1
// bản (server tính sẵn thống kê cho BGH). File này chỉ re-export cho phía giao diện.
export {
  toDate,
  computeTeacherStats,
  computeSchoolStats,
  computeVPStats,
} from '../shared/statsCompute';
export type {
  SemesterParam,
  StatsUser,
  TeacherStats,
  SchoolStats,
  VPStats,
} from '../shared/statsCompute';
