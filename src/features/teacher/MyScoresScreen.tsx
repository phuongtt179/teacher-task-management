import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { analyticsService, TeacherStats } from '../../services/analyticsService';
import { schoolYearService } from '../../services/schoolYearService';
import { SemesterFilter, SEMESTER_FILTER_LABELS, getActiveSemester } from '../../utils/semesterUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '../../components/dashboard/StatsCard';
import { Award, TrendingUp, Target, CheckCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { SchoolYear } from '../../types';

interface ScoreDetail {
  taskTitle: string;
  score: number;
  maxScore: number;
  feedback: string;
  scoredAt: Date;
  scoredByName: string;
}

export const MyScoresScreen = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [schoolAverage, setSchoolAverage] = useState(0);
  const [scores, setScores] = useState<ScoreDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>('');
  const [selectedSemester, setSelectedSemester] = useState<SemesterFilter>('all');

  // Load school years and initial data
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        setIsLoading(true);

        // Load school years and active year
        const [years, activeYear] = await Promise.all([
          schoolYearService.getAllSchoolYears(),
          schoolYearService.getActiveSchoolYear(),
        ]);

        setSchoolYears(years);

        // Set initial filters based on active year
        let initialSchoolYearId = 'all';
        let initialSemester: SemesterFilter = 'all';

        if (activeYear) {
          initialSchoolYearId = activeYear.id;
          if (activeYear.activeSemester) {
            initialSemester = activeYear.activeSemester as SemesterFilter;
          }
        }

        setSelectedSchoolYearId(initialSchoolYearId);
        setSelectedSemester(initialSemester);

        // Get teacher stats with initial filters
        const semesterParam = (initialSemester === 'all' || initialSemester === 'unassigned') ? 'all' : initialSemester;
        const [teacherStats, schoolStats] = await Promise.all([
          analyticsService.getTeacherStats(user.uid, semesterParam, initialSchoolYearId),
          analyticsService.getSchoolStats(semesterParam, initialSchoolYearId),
        ]);

        setStats(teacherStats);
        setSchoolAverage(schoolStats.averageScore);

        // Get detailed scores with initial filters
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('teacherId', '==', user.uid),
          where('score', '!=', null)
        );
        const submissionsSnap = await getDocs(submissionsQuery);

        const scoresData: ScoreDetail[] = [];
        for (const doc of submissionsSnap.docs) {
          const submission = doc.data();

          // Skip if no scoredAt timestamp
          if (!submission.scoredAt) continue;

          // Filter by semester (client-side)
          if (initialSemester !== 'all') {
            if (initialSemester === 'unassigned' && submission.semester) continue;
            if (initialSemester !== 'unassigned' && submission.semester !== initialSemester) continue;
          }

          // Get task info
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('__name__', '==', submission.taskId)
          );
          const tasksSnap = await getDocs(tasksQuery);

          if (!tasksSnap.empty) {
            const task = tasksSnap.docs[0].data();

            // Filter by school year (client-side)
            if (initialSchoolYearId !== 'all' && task.schoolYearId !== initialSchoolYearId) {
              continue;
            }

            scoresData.push({
              taskTitle: task.title,
              score: submission.score,
              maxScore: task.maxScore,
              feedback: submission.feedback || '',
              scoredAt: submission.scoredAt.toDate(),
              scoredByName: submission.scoredByName || 'N/A',
            });
          }
        }

        setScores(scoresData.sort((a, b) => b.scoredAt.getTime() - a.scoredAt.getTime()));
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Reload data when filters change (but not on initial load)
  useEffect(() => {
    // Skip if initial load hasn't completed (selectedSchoolYearId is still empty)
    if (!user || selectedSchoolYearId === '') return;

    const loadData = async () => {
      try {
        setIsLoading(true);

        // Get teacher stats with filters
        const semesterParam = selectedSemester === 'all' || selectedSemester === 'unassigned' ? 'all' : selectedSemester;
        const [teacherStats, schoolStats] = await Promise.all([
          analyticsService.getTeacherStats(user.uid, semesterParam, selectedSchoolYearId),
          analyticsService.getSchoolStats(semesterParam, selectedSchoolYearId),
        ]);

        setStats(teacherStats);
        setSchoolAverage(schoolStats.averageScore);

        // Get detailed scores with filters
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('teacherId', '==', user.uid),
          where('score', '!=', null)
        );
        const submissionsSnap = await getDocs(submissionsQuery);

        const scoresData: ScoreDetail[] = [];
        for (const doc of submissionsSnap.docs) {
          const submission = doc.data();

          // Skip if no scoredAt timestamp
          if (!submission.scoredAt) continue;

          // Filter by semester (client-side)
          if (selectedSemester !== 'all') {
            if (selectedSemester === 'unassigned' && submission.semester) continue;
            if (selectedSemester !== 'unassigned' && submission.semester !== selectedSemester) continue;
          }

          // Get task info
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('__name__', '==', submission.taskId)
          );
          const tasksSnap = await getDocs(tasksQuery);

          if (!tasksSnap.empty) {
            const task = tasksSnap.docs[0].data();

            // Filter by school year (client-side)
            if (selectedSchoolYearId !== 'all' && task.schoolYearId !== selectedSchoolYearId) {
              continue;
            }

            scoresData.push({
              taskTitle: task.title,
              score: submission.score,
              maxScore: task.maxScore,
              feedback: submission.feedback || '',
              scoredAt: submission.scoredAt.toDate(),
              scoredByName: submission.scoredByName || 'N/A',
            });
          }
        }

        setScores(scoresData.sort((a, b) => b.scoredAt.getTime() - a.scoredAt.getTime()));
      } catch (error) {
        console.error('Error loading scores:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSemester, selectedSchoolYearId]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Không thể tải dữ liệu</p>
      </div>
    );
  }

  const performanceLevel = 
    stats.averageScore >= schoolAverage + 1 ? 'excellent' :
    stats.averageScore >= schoolAverage ? 'good' :
    stats.averageScore >= schoolAverage - 1 ? 'average' : 'needs_improvement';

  const performanceConfig = {
    excellent: {
      label: 'Xuất sắc',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
    },
    good: {
      label: 'Tốt',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    average: {
      label: 'Trung bình',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
    },
    needs_improvement: {
      label: 'Cần cải thiện',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
    },
  };

  const config = performanceConfig[performanceLevel];

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">Điểm của tôi</h2>
          <p className="text-sm md:text-base text-gray-600">Xem chi tiết thành tích và đánh giá</p>
        </div>

        {/* Year and Semester Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedSchoolYearId} onValueChange={setSelectedSchoolYearId}>
            <SelectTrigger className="w-full sm:w-48">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Chọn năm học" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả năm học</SelectItem>
              {schoolYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.name} {year.isActive && '(Hiện tại)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSemester} onValueChange={(value) => setSelectedSemester(value as SemesterFilter)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Chọn học kỳ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{SEMESTER_FILTER_LABELS.all}</SelectItem>
              <SelectItem value="HK1">{SEMESTER_FILTER_LABELS.HK1}</SelectItem>
              <SelectItem value="HK2">{SEMESTER_FILTER_LABELS.HK2}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Điểm trung bình"
          value={stats.scoredTasksCount > 0 ? stats.averageScore : '--'}
          icon={Award}
          color="purple"
          description="Thang điểm 10"
        />
        <StatsCard
          title="Tổng công việc"
          value={stats.totalTasks}
          icon={Target}
          color="blue"
          description="Được giao"
        />
        <StatsCard
          title="Hoàn thành"
          value={stats.completedTasks}
          icon={CheckCircle}
          color="green"
          description={`${stats.completionRate}% tổng số`}
        />
        <StatsCard
          title="Nộp đúng hạn"
          value={`${stats.onTimeRate}%`}
          icon={Calendar}
          color="orange"
          description="Tỷ lệ"
        />
      </div>

      {/* Performance Card */}
      <Card className={`${config.bgColor} ${config.borderColor} border-2`}>
        <CardContent className="pt-4 md:pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-gray-600 mb-1">Xếp hạng hiệu suất</p>
              <p className={`text-2xl md:text-3xl font-bold ${config.color}`}>{config.label}</p>
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm text-gray-600 mb-1">So với TB trường</p>
              <div className="flex items-center gap-1.5 md:gap-2">
                <p className="text-xl md:text-2xl font-bold">{stats.averageScore}</p>
                <span className="text-gray-400">/</span>
                <p className="text-base md:text-lg text-gray-600">{schoolAverage}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
            <div className="flex items-start gap-2">
              <TrendingUp className={`w-4 h-4 md:w-5 md:h-5 ${config.color} flex-shrink-0 mt-0.5`} />
              <p className="text-xs md:text-sm text-gray-700 leading-relaxed">
                {performanceLevel === 'excellent' && `Bạn đang đạt thành tích xuất sắc, cao hơn ${(stats.averageScore - schoolAverage).toFixed(1)} điểm so với trung bình!`}
                {performanceLevel === 'good' && 'Bạn đang duy trì phong độ tốt, ngang bằng với mức trung bình!'}
                {performanceLevel === 'average' && 'Tiếp tục cố gắng để đạt kết quả tốt hơn!'}
                {performanceLevel === 'needs_improvement' && 'Hãy cố gắng hơn nữa để cải thiện kết quả!'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử điểm ({scores.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {scores.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có điểm nào</p>
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {scores.map((score, index) => (
                <div key={index} className="border rounded-lg p-3 md:p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm md:text-base text-gray-900 truncate">{score.taskTitle}</h4>
                      <p className="text-xs md:text-sm text-gray-500 mt-1 truncate">
                        Chấm bởi {score.scoredByName} • {format(score.scoredAt, 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl md:text-3xl font-bold text-indigo-600">
                        {score.score}
                      </p>
                      <p className="text-xs md:text-sm text-gray-500">/ {score.maxScore}</p>
                    </div>
                  </div>

                  {score.feedback && (
                    <div className="mt-2 md:mt-3 p-2 md:p-3 bg-gray-50 rounded">
                      <p className="text-xs md:text-sm font-medium text-gray-700 mb-1">Nhận xét:</p>
                      <p className="text-xs md:text-sm text-gray-600">{score.feedback}</p>
                    </div>
                  )}

                  {/* Score visualization */}
                  <div className="mt-2 md:mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          score.score / score.maxScore >= 0.8 ? 'bg-green-600' :
                          score.score / score.maxScore >= 0.6 ? 'bg-blue-600' :
                          score.score / score.maxScore >= 0.5 ? 'bg-yellow-600' :
                          'bg-red-600'
                        }`}
                        style={{ width: `${(score.score / score.maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};