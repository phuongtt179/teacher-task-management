import { collection, getDocs, query, where } from 'firebase/firestore';
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

export interface AnonymousRanking {
  anonymousId: string; // "Teacher #1", "Teacher #2", etc. hoặc tên thật
  actualUid: string; // Real UID (để so sánh với current user)
  displayName: string; // Tên thật của giáo viên
  totalScore: number;
  averageScore: number;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
  onTimeRate: number;
  rank: number;
  isCurrentUser?: boolean;
}

export type RankingPeriod = 'all_time' | 'this_month' | 'this_week';
export type RankingType = 'total_score' | 'average_score' | 'completion_rate';

export const rankingService = {
  // Get rankings with anonymization
  async getRankings(
    period: RankingPeriod = 'all_time',
    rankBy: RankingType = 'total_score',
    semesterFilter?: 'HK1' | 'HK2' | 'all',
    currentUserId?: string,
    currentUserRole?: string
  ): Promise<AnonymousRanking[]> {
    try {
      // Get all teachers
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher')
      );
      const teachersSnap = await getDocs(teachersQuery);
      const teachers = teachersSnap.docs.map(doc => ({
        uid: doc.id,
        displayName: doc.data().displayName || 'Unknown',
        ...doc.data()
      }));

      // Calculate date range for filtering
      const now = new Date();
      let startDate: Date | null = null;

      if (period === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'this_week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
      }

      // Calculate stats for each teacher
      const teacherStats = await Promise.all(
        teachers.map(async (teacher) => {
          // ✅ Get tasks with proper type casting
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('assignedTo', 'array-contains', teacher.uid)
          );
          const tasksSnap = await getDocs(tasksQuery);
          let tasks = tasksSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Task));

          // ✅ Filter by period if needed using helper function
          if (startDate) {
            tasks = tasks.filter(task => {
              if (!task.createdAt) return false;
              const createdAt = toDate(task.createdAt);
              return createdAt >= startDate;
            });
          }

          // Filter by semester (client-side)
          if (semesterFilter && semesterFilter !== 'all') {
            tasks = tasks.filter(t => t.semester === semesterFilter);
          }

          // ✅ Get submissions with proper type casting
          const submissionsQuery = query(
            collection(db, 'submissions'),
            where('teacherId', '==', teacher.uid)
          );
          const submissionsSnap = await getDocs(submissionsQuery);
          let submissions = submissionsSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Submission));

          // ✅ Filter submissions by period using helper function
          if (startDate) {
            submissions = submissions.filter(sub => {
              if (!sub.submittedAt) return false;
              const submittedAt = toDate(sub.submittedAt);
              return submittedAt >= startDate;
            });
          }

          // Filter submissions by semester (client-side)
          if (semesterFilter && semesterFilter !== 'all') {
            submissions = submissions.filter(s => s.semester === semesterFilter);
          }

          // Calculate scores
          const scoredSubmissions = submissions.filter(s => s.score !== undefined);
          const totalScore = scoredSubmissions.reduce((sum, s) => sum + (s.score || 0), 0);
          const averageScore = scoredSubmissions.length > 0
            ? Math.round((totalScore / scoredSubmissions.length) * 10) / 10
            : 0;

          // Calculate completion rate
          const completedTasks = tasks.filter(t => t.status === 'completed').length;
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
            actualUid: teacher.uid,
            displayName: teacher.displayName,
            totalScore,
            averageScore,
            completedTasks,
            totalTasks: tasks.length,
            completionRate,
            onTimeRate,
          };
        })
      );

      // Filter out teachers with no data
      const filteredStats = teacherStats.filter(stat => stat.totalTasks > 0);

      // Sort based on ranking type
      let sortedStats = [...filteredStats];
      switch (rankBy) {
        case 'total_score':
          sortedStats.sort((a, b) => b.totalScore - a.totalScore);
          break;
        case 'average_score':
          sortedStats.sort((a, b) => b.averageScore - a.averageScore);
          break;
        case 'completion_rate':
          sortedStats.sort((a, b) => b.completionRate - a.completionRate);
          break;
      }

      // Anonymize and add rank
      // Admin/VP see all real names, teachers see only their own name
      const showAllNames = currentUserRole === 'admin' || currentUserRole === 'vice_principal';

      const rankings: AnonymousRanking[] = sortedStats.map((stat, index) => {
        let displayId: string;

        if (showAllNames) {
          // Admin/VP: Show all real names
          displayId = stat.displayName;
        } else if (currentUserId === stat.actualUid) {
          // Teacher viewing their own entry: Show their real name
          displayId = stat.displayName;
        } else {
          // Teacher viewing others: Anonymize as "Giáo viên 1, 2, 3..."
          displayId = `Giáo viên ${index + 1}`;
        }

        return {
          anonymousId: displayId,
          actualUid: stat.actualUid,
          displayName: stat.displayName,
          totalScore: stat.totalScore,
          averageScore: stat.averageScore,
          completedTasks: stat.completedTasks,
          totalTasks: stat.totalTasks,
          completionRate: stat.completionRate,
          onTimeRate: stat.onTimeRate,
          rank: index + 1,
          isCurrentUser: currentUserId === stat.actualUid,
        };
      });

      return rankings;
    } catch (error) {
      console.error('Error getting rankings:', error);
      return [];
    }
  },

  // Get user's rank
  async getUserRank(userId: string, period: RankingPeriod = 'all_time', rankBy: RankingType = 'total_score', semesterFilter?: 'HK1' | 'HK2' | 'all', userRole?: string): Promise<number | null> {
    try {
      const rankings = await this.getRankings(period, rankBy, semesterFilter, userId, userRole);
      const userRanking = rankings.find(r => r.actualUid === userId);
      return userRanking ? userRanking.rank : null;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return null;
    }
  },

  // Get top performers
  async getTopPerformers(count: number = 10, period: RankingPeriod = 'all_time', semesterFilter?: 'HK1' | 'HK2' | 'all', currentUserId?: string, currentUserRole?: string): Promise<AnonymousRanking[]> {
    try {
      const rankings = await this.getRankings(period, 'total_score', semesterFilter, currentUserId, currentUserRole);
      return rankings.slice(0, count);
    } catch (error) {
      console.error('Error getting top performers:', error);
      return [];
    }
  },
};