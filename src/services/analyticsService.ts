import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task, Submission } from '../types';

// ✅ Helper function to safely convert Timestamp/Date to Date
const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
};

export interface TeacherStats {
  uid: string;
  displayName: string;
  email: string;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  averageScore: number;
  totalScore: number;
  scoredTasksCount: number;
  completionRate: number;
  onTimeRate: number;
}

export interface SchoolStats {
  totalTeachers: number;
  totalTasks: number;
  completedTasks: number;
  averageScore: number;
  highPerformers: number;
  lowPerformers: number;
  averagePerformers: number;
  completionRate: number;
}

export const analyticsService = {
  // Get stats for a specific teacher
  async getTeacherStats(teacherId: string): Promise<TeacherStats | null> {
    try {
      // Get user info
      const usersSnap = await getDocs(
        query(collection(db, 'users'), where('__name__', '==', teacherId))
      );
      
      if (usersSnap.empty) return null;
      
      const userData = usersSnap.docs[0].data();

      // Get tasks assigned to teacher
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('assignedTo', 'array-contains', teacherId)
      );
      const tasksSnap = await getDocs(tasksQuery);
      const tasks = tasksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));

      // Get submissions and scores
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('teacherId', '==', teacherId)
      );
      const submissionsSnap = await getDocs(submissionsQuery);
      const submissions = submissionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Submission));

      // Calculate stats
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const pendingTasks = tasks.filter(
        t => t.status === 'assigned' || t.status === 'in_progress' || t.status === 'submitted'
      ).length;

      const scoredSubmissions = submissions.filter(s => s.score !== undefined);
      const totalScore = scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
      const averageScore = scoredSubmissions.length > 0 
        ? Math.round((totalScore / scoredSubmissions.length) * 10) / 10 
        : 0;

      const completionRate = tasks.length > 0 
        ? Math.round((completedTasks / tasks.length) * 100) 
        : 0;

      // ✅ Calculate on-time rate using helper function
      let onTimeCount = 0;
      submissions.forEach(submission => {
        const task = tasks.find(t => t.id === submission.taskId);
        if (task && submission.submittedAt && task.deadline) {
          const submittedDate = toDate(submission.submittedAt);
          const deadlineDate = toDate(task.deadline);
          if (submittedDate <= deadlineDate) {
            onTimeCount++;
          }
        }
      });
      const onTimeRate = submissions.length > 0 
        ? Math.round((onTimeCount / submissions.length) * 100) 
        : 0;

      return {
        uid: teacherId,
        displayName: userData.displayName || '',
        email: userData.email || '',
        totalTasks: tasks.length,
        completedTasks,
        pendingTasks,
        averageScore,
        totalScore,
        scoredTasksCount: scoredSubmissions.length,
        completionRate,
        onTimeRate,
      };
    } catch (error) {
      console.error('Error getting teacher stats:', error);
      return null;
    }
  },

  // Get stats for all teachers and department heads
  async getAllTeachersStats(): Promise<TeacherStats[]> {
    try {
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['teacher', 'department_head'])
      );
      const teachersSnap = await getDocs(teachersQuery);

      const statsPromises = teachersSnap.docs.map(doc =>
        this.getTeacherStats(doc.id)
      );

      const stats = await Promise.all(statsPromises);
      return stats.filter(s => s !== null) as TeacherStats[];
    } catch (error) {
      console.error('Error getting all teachers stats:', error);
      return [];
    }
  },

  // Get school-wide statistics
  async getSchoolStats(): Promise<SchoolStats> {
    try {
      const teachersStats = await this.getAllTeachersStats();

      const totalTeachers = teachersStats.length;
      const totalTasks = teachersStats.reduce((sum, t) => sum + t.totalTasks, 0);
      const completedTasks = teachersStats.reduce((sum, t) => sum + t.completedTasks, 0);

      // Calculate average score across all teachers
      const teachersWithScores = teachersStats.filter(t => t.scoredTasksCount > 0);
      const totalWeightedScore = teachersWithScores.reduce(
        (sum, t) => sum + (t.averageScore * t.scoredTasksCount),
        0
      );
      const totalScoredTasks = teachersWithScores.reduce(
        (sum, t) => sum + t.scoredTasksCount,
        0
      );
      const averageScore = totalScoredTasks > 0
        ? Math.round((totalWeightedScore / totalScoredTasks) * 10) / 10
        : 0;

      // Count high and low performers
      const highPerformers = teachersWithScores.filter(
        t => t.averageScore > averageScore
      ).length;
      const lowPerformers = teachersWithScores.filter(
        t => t.averageScore < averageScore
      ).length;
      const averagePerformers = teachersWithScores.length - highPerformers - lowPerformers;

      return {
        totalTeachers,
        totalTasks,
        completedTasks,
        averageScore,
        highPerformers,
        lowPerformers,
        averagePerformers,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting school stats:', error);
      return {
        totalTeachers: 0,
        totalTasks: 0,
        completedTasks: 0,
        averageScore: 0,
        highPerformers: 0,
        lowPerformers: 0,
        averagePerformers: 0,
        completionRate: 0,
      };
    }
  },

  // Get VP statistics
  async getVPStats(vpUid: string) {
    try {
      // Get tasks created by VP
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('createdBy', '==', vpUid)
      );
      const tasksSnap = await getDocs(tasksQuery);
      const tasks = tasksSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Task));

      // Get all submissions for these tasks
      const taskIds = tasks.map(t => t.id);
      const allSubmissions: Submission[] = [];
      
      for (const taskId of taskIds) {
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('taskId', '==', taskId)
        );
        const submissionsSnap = await getDocs(submissionsQuery);
        const submissionsData = submissionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Submission));
        allSubmissions.push(...submissionsData);
      }

      // Calculate stats
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const submittedTasks = tasks.filter(t => t.status === 'submitted').length;
      const assignedTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'in_progress').length;

      const scoredSubmissions = allSubmissions.filter(s => s.score !== undefined);
      const averageScore = scoredSubmissions.length > 0
        ? Math.round(
            (scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubmissions.length) * 10
          ) / 10
        : 0;

      // Get unique teachers assigned
      const uniqueTeachers = new Set<string>();
      tasks.forEach(task => {
        if (task.assignedTo && Array.isArray(task.assignedTo)) {
          task.assignedTo.forEach((teacherId: string) => uniqueTeachers.add(teacherId));
        }
      });

      return {
        totalTasks,
        completedTasks,
        submittedTasks,
        assignedTasks,
        averageScore,
        totalTeachers: uniqueTeachers.size,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        submissionRate: totalTasks > 0 ? Math.round(((submittedTasks + completedTasks) / totalTasks) * 100) : 0,
      };
    } catch (error) {
      console.error('Error getting VP stats:', error);
      return null;
    }
  },
};