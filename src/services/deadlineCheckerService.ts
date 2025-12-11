import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { notificationService } from './notificationService';
import { taskService } from './taskService';

class DeadlineCheckerService {
  private intervalId: number | null = null;

  /**
   * Start checking for upcoming deadlines
   * Check every 30 minutes
   */
  startChecking(): void {
    if (this.intervalId) return; // Already running

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
  }

  private async checkDeadlines(): Promise<void> {
    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Query tasks with deadline in next 24 hours
      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef,
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
        const submissions = await taskService.getSubmissionsForTask(task.id);
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
