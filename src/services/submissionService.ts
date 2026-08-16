import { taskService } from './taskService';

/**
 * Submission Service
 * Wrapper around taskService submission-related functions
 */
export const submissionService = {
  /**
   * Get all submissions for a task
   */
  async getSubmissionsByTask(schoolId: string, taskId: string) {
    return taskService.getSubmissionsForTask(schoolId, taskId);
  },

  /**
   * Get a submission for a specific teacher and task
   */
  async getSubmission(schoolId: string, taskId: string, teacherId: string) {
    return taskService.getSubmission(schoolId, taskId, teacherId);
  },

  /**
   * Score a submission
   */
  async scoreSubmission(
    schoolId: string,
    submissionId: string,
    score: number,
    feedback: string,
    scoredBy: string,
    scoredByName: string,
    taskId: string
  ) {
    return taskService.scoreSubmission(schoolId, submissionId, score, feedback, scoredBy, scoredByName, taskId);
  },

  /**
   * Submit a report
   */
  async submitReport(
    schoolId: string,
    taskId: string,
    teacherId: string,
    teacherName: string,
    content: string,
    files: File[]
  ) {
    return taskService.submitReport(schoolId, taskId, teacherId, teacherName, content, files);
  },
};
