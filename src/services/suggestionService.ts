import { analyticsService, TeacherStats } from './analyticsService';

export interface TeacherSuggestion extends TeacherStats {
  score: number; // Suggestion score (0-100)
  reason: string;
  workloadStatus: 'light' | 'moderate' | 'heavy';
  performanceStatus: 'excellent' | 'good' | 'average' | 'needs_improvement';
}

export const suggestionService = {
  // Get smart assignment suggestions
  async getAssignmentSuggestions(): Promise<TeacherSuggestion[]> {
    try {
      // Get all teachers stats
      const teachersStats = await analyticsService.getAllTeachersStats();
      const schoolStats = await analyticsService.getSchoolStats();

      // Calculate suggestion score for each teacher
      const suggestions = teachersStats.map(teacher => {
        let score = 100;
        let reasons: string[] = [];
        
        // Factor 1: Workload (40% weight)
        // Lighter workload = higher score
        const workloadScore = Math.max(0, 100 - (teacher.pendingTasks * 10));
        score = score * 0.4 + workloadScore * 0.4;
        
        let workloadStatus: 'light' | 'moderate' | 'heavy';
        if (teacher.pendingTasks <= 2) {
          workloadStatus = 'light';
          reasons.push('Khối lượng công việc nhẹ');
        } else if (teacher.pendingTasks <= 5) {
          workloadStatus = 'moderate';
          reasons.push('Khối lượng công việc vừa phải');
        } else {
          workloadStatus = 'heavy';
          reasons.push('Khối lượng công việc nặng');
          score = score * 0.7; // Penalty for heavy workload
        }

        // Factor 2: Performance (40% weight)
        // Higher average score = higher suggestion score
        let performanceStatus: 'excellent' | 'good' | 'average' | 'needs_improvement';
        if (teacher.scoredTasksCount === 0) {
          performanceStatus = 'average';
          reasons.push('Chưa có điểm đánh giá');
        } else if (teacher.averageScore >= schoolStats.averageScore + 1) {
          performanceStatus = 'excellent';
          reasons.push(`Điểm cao hơn trung bình trường (${schoolStats.averageScore})`);
          score = score * 1.2; // Bonus for high performers
        } else if (teacher.averageScore >= schoolStats.averageScore) {
          performanceStatus = 'good';
          reasons.push(`Điểm ngang trung bình trường (${schoolStats.averageScore})`);
        } else if (teacher.averageScore >= schoolStats.averageScore - 1) {
          performanceStatus = 'average';
          reasons.push('Điểm trung bình');
        } else {
          performanceStatus = 'needs_improvement';
          reasons.push('Điểm thấp hơn trung bình');
          score = score * 0.8; // Penalty for low performers
        }

        // Factor 3: Completion rate (20% weight)
        const completionBonus = teacher.completionRate * 0.2;
        score = score + completionBonus;

        if (teacher.completionRate >= 90) {
          reasons.push('Tỷ lệ hoàn thành cao');
        } else if (teacher.completionRate < 50) {
          reasons.push('Tỷ lệ hoàn thành thấp');
        }

        // Cap score between 0-100
        score = Math.min(100, Math.max(0, Math.round(score)));

        return {
          ...teacher,
          score,
          reason: reasons.join(' • '),
          workloadStatus,
          performanceStatus,
        };
      });

      // Sort by suggestion score (highest first)
      return suggestions.sort((a, b) => b.score - a.score);
    } catch (error) {
      console.error('Error getting suggestions:', error);
      return [];
    }
  },

  // Get recommended teachers for a task
  async getRecommendedTeachers(count: number = 5): Promise<TeacherSuggestion[]> {
    const suggestions = await this.getAssignmentSuggestions();
    return suggestions.slice(0, count);
  },
};