import { taskService } from './taskService';

/**
 * Submission Service
 * Wrapper around taskService submission-related functions
 */
export const submissionService = {
  /**
   * Get all submissions for a task
   */
  async getSubmissionsByTask(taskId: string) {
    return taskService.getSubmissionsForTask(taskId);
  },

  /**
   * Get a submission for a specific teacher and task
   */
  async getSubmission(taskId: string, teacherId: string) {
    return taskService.getSubmission(taskId, teacherId);
  },

  /**
   * Score a submission
   */
  async scoreSubmission(
    submissionId: string,
    score: number,
    feedback: string,
    scoredBy: string,
    scoredByName: string,
    taskId: string
  ) {
    return taskService.scoreSubmission(submissionId, score, feedback, scoredBy, scoredByName, taskId);
  },

  /**
   * Submit a report
   */
  async submitReport(
    taskId: string,
    teacherId: string,
    teacherName: string,
    content: string,
    files: File[]
  ) {
    return taskService.submitReport(taskId, teacherId, teacherName, content, files);
  },
};
