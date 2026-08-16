import { query, where, getDocs, Timestamp } from 'firebase/firestore';
import { tenantCollection } from '@/lib/tenantQuery';
import { notificationService } from './notificationService';
import { taskService } from './taskService';

class DeadlineCheckerService {
  private intervalId: number | null = null;
  private schoolId: string | null = null;

  /**
   * Start checking for upcoming deadlines
   * Check every 30 minutes
   */
  startChecking(schoolId: string): void {
    if (this.intervalId && this.schoolId === schoolId) return; // Already running for this school

    // Restart if school changed
    this.stopChecking();
    this.schoolId = schoolId;

    // Check immediately
    this.checkDeadlines();

    // Then check every 30 minutes
    this.intervalId = setInterval(() => {
      this.checkDeadlines();
    }, 30 * 60 * 1000);
  }

  stopChecking(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.schoolId = null;
  }

  private async checkDeadlines(): Promise<void> {
    const schoolId = this.schoolId;
    if (!schoolId) return;

    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Query tasks with deadline in next 24 hours
      const q = query(
        tenantCollection('tasks', schoolId),
        where('deadline', '>', Timestamp.fromDate(now)),
        where('deadline', '<', Timestamp.fromDate(in24Hours)),
        where('status', 'in', ['assigned', 'in_progress'])
      );

      const snapshot = await getDocs(q);

      for (const taskDoc of snapshot.docs) {
        const task = {
          id: taskDoc.id,
          ...taskDoc.data(),
          deadline: taskDoc.data().deadline?.toDate(),
          assignedTo: taskDoc.data().assignedTo || [],
          title: taskDoc.data().title || '',
        };

        // Get submissions for this task
        const submissions = await taskService.getSubmissionsForTask(schoolId, task.id);
        const submittedTeacherIds = submissions.map(s => s.teacherId);

        // Find teachers who haven't submitted
        const teachersNotSubmitted = task.assignedTo.filter(
          (tid: string) => !submittedTeacherIds.includes(tid)
        );

        // Calculate hours left
        const hoursLeft = Math.floor((task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60));

        // Send reminder to each teacher who hasn't submitted
        for (const teacherId of teachersNotSubmitted) {
          await notificationService.notifyDeadline(
            schoolId,
            teacherId,
            task.id,
            task.title,
            hoursLeft
          );
        }
      }
    } catch (error) {
      console.error('Error checking deadlines:', error);
    }
  }
}

export const deadlineCheckerService = new DeadlineCheckerService();
