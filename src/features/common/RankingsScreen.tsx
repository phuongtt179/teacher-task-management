import { useState, useEffect } from 'react';
import { rankingService, AnonymousRanking, RankingPeriod, RankingType } from '../../services/rankingService';
import { useAuth } from '../../hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award, TrendingUp, Target, Clock, Crown } from 'lucide-react';

export const RankingsScreen = () => {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<AnonymousRanking[]>([]);
  const [period, setPeriod] = useState<RankingPeriod>('all_time');
  const [rankBy, setRankBy] = useState<RankingType>('total_score');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRankings = async () => {
      try {
        setIsLoading(true);
        const data = await rankingService.getRankings(period, rankBy, user?.uid, user?.role);
        setRankings(data);
      } catch (error) {
        console.error('Error loading rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRankings();
  }, [period, rankBy, user]);

  const getMedalIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-700" />;
      default:
        return null;
    }
  };

  const getMedalColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'from-yellow-400 to-yellow-600';
      case 2:
        return 'from-gray-300 to-gray-500';
      case 3:
        return 'from-amber-600 to-amber-800';
      default:
        return 'from-gray-200 to-gray-300';
    }
  };

  const getPeriodLabel = (p: RankingPeriod) => {
    switch (p) {
      case 'all_time':
        return 'Tất cả thời gian';
      case 'this_month':
        return 'Tháng này';
      case 'this_week':
        return 'Tuần này';
    }
  };

  const getRankingTypeLabel = (type: RankingType) => {
    switch (type) {
      case 'total_score':
        return 'Tổng điểm';
      case 'average_score':
        return 'Điểm trung bình';
      case 'completion_rate':
        return 'Tỷ lệ hoàn thành';
    }
  };

  const getRankingValue = (ranking: AnonymousRanking, type: RankingType) => {
    switch (type) {
      case 'total_score':
        return ranking.totalScore;
      case 'average_score':
        return ranking.averageScore;
      case 'completion_rate':
        return `${ranking.completionRate}%`;
    }
  };

  const currentUserRanking = rankings.find(r => r.isCurrentUser);
  const top3 = rankings.slice(0, 3);
  const restRankings = rankings.slice(3);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="text-gray-600 mt-4">Đang tải bảng xếp hạng...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-8 h-8 text-yellow-500" />
          Bảng xếp hạng
        </h2>
        <p className="text-gray-600">
          {user?.role === 'admin' || user?.role === 'vice_principal'
            ? 'Xếp hạng ẩn danh theo thành tích'
            : 'Xếp hạng theo thành tích (chỉ hiển thị tên bạn)'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <Card className="flex-1">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Thời gian
                </label>
                <Select value={period} onValueChange={(value) => setPeriod(value as RankingPeriod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_time">Tất cả thời gian</SelectItem>
                    <SelectItem value="this_month">Tháng này</SelectItem>
                    <SelectItem value="this_week">Tuần này</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Xếp hạng theo
                </label>
                <Select value={rankBy} onValueChange={(value) => setRankBy(value as RankingType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total_score">Tổng điểm</SelectItem>
                    <SelectItem value="average_score">Điểm trung bình</SelectItem>
                    <SelectItem value="completion_rate">Tỷ lệ hoàn thành</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current User Position */}
        {currentUserRanking && (
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <CardContent className="pt-4 md:pt-6">
              <div className="text-center">
                <p className="text-xs md:text-sm text-indigo-100 mb-1">Vị trí của bạn</p>
                <div className="flex items-center justify-center gap-2 md:gap-3">
                  <div className="text-3xl md:text-4xl font-bold">#{currentUserRanking.rank}</div>
                  {currentUserRanking.rank <= 3 && getMedalIcon(currentUserRanking.rank)}
                </div>
                <p className="text-xs md:text-sm text-indigo-100 mt-1 md:mt-2">
                  {getRankingTypeLabel(rankBy)}: {getRankingValue(currentUserRanking, rankBy)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* No data */}
      {rankings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600">Chưa có dữ liệu xếp hạng cho khoảng thời gian này</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podium - Top 3 */}
          {top3.length >= 3 && (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-b from-yellow-50 to-transparent rounded-xl -z-10" />
              <Card className="border-2 border-yellow-200">
                <CardHeader>
                  <CardTitle className="text-center flex items-center justify-center gap-2">
                    <Crown className="w-6 h-6 text-yellow-500" />
                    Top 3
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 md:gap-4 items-end pb-2 md:pb-4">
                    {/* 2nd Place */}
                    {top3[1] && (
                      <div className="text-center space-y-1 md:space-y-2">
                        <div className={`mx-auto w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${getMedalColor(2)} flex items-center justify-center shadow-lg`}>
                          <Medal className="w-6 h-6 md:w-10 md:h-10 text-white" />
                        </div>
                        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg p-2 md:p-4 h-24 md:h-32 flex flex-col justify-between">
                          <div>
                            <p className="text-lg md:text-2xl font-bold text-gray-700">#2</p>
                            <p className={`text-xs md:text-sm font-medium ${top3[1].isCurrentUser ? 'text-indigo-600' : 'text-gray-600'} truncate`}>
                              {top3[1].anonymousId}
                            </p>
                          </div>
                          <div>
                            <p className="text-base md:text-xl font-bold text-gray-900">
                              {getRankingValue(top3[1], rankBy)}
                            </p>
                            <p className="text-[10px] md:text-xs text-gray-600">
                              {top3[1].completedTasks} tasks
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 1st Place */}
                    {top3[0] && (
                      <div className="text-center space-y-1 md:space-y-2">
                        <div className={`mx-auto w-14 h-14 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${getMedalColor(1)} flex items-center justify-center shadow-2xl animate-pulse`}>
                          <Crown className="w-7 h-7 md:w-12 md:h-12 text-white" />
                        </div>
                        <div className="bg-gradient-to-br from-yellow-100 to-yellow-300 rounded-lg p-2 md:p-4 h-28 md:h-40 flex flex-col justify-between border-2 border-yellow-400">
                          <div>
                            <p className="text-xl md:text-3xl font-bold text-yellow-800">#1</p>
                            <p className={`text-xs md:text-sm font-medium ${top3[0].isCurrentUser ? 'text-indigo-600' : 'text-yellow-800'} truncate`}>
                              {top3[0].anonymousId}
                            </p>
                          </div>
                          <div>
                            <p className="text-lg md:text-2xl font-bold text-yellow-900">
                              {getRankingValue(top3[0], rankBy)}
                            </p>
                            <p className="text-[10px] md:text-xs text-yellow-700">
                              {top3[0].completedTasks} tasks
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {top3[2] && (
                      <div className="text-center space-y-1 md:space-y-2">
                        <div className={`mx-auto w-12 h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br ${getMedalColor(3)} flex items-center justify-center shadow-lg`}>
                          <Medal className="w-6 h-6 md:w-10 md:h-10 text-white" />
                        </div>
                        <div className="bg-gradient-to-br from-amber-100 to-amber-200 rounded-lg p-2 md:p-4 h-24 md:h-32 flex flex-col justify-between">
                          <div>
                            <p className="text-lg md:text-2xl font-bold text-amber-800">#3</p>
                            <p className={`text-xs md:text-sm font-medium ${top3[2].isCurrentUser ? 'text-indigo-600' : 'text-amber-700'} truncate`}>
                              {top3[2].anonymousId}
                            </p>
                          </div>
                          <div>
                            <p className="text-base md:text-xl font-bold text-amber-900">
                              {getRankingValue(top3[2], rankBy)}
                            </p>
                            <p className="text-[10px] md:text-xs text-amber-700">
                              {top3[2].completedTasks} tasks
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Rankings Table */}
          <Card>
            <CardHeader>
              <CardTitle>Toàn bộ xếp hạng ({rankings.length} giáo viên)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 md:space-y-2">
                {rankings.map((ranking) => (
                  <div
                    key={ranking.anonymousId}
                    className={`flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-lg transition-all ${
                      ranking.isCurrentUser
                        ? 'bg-indigo-50 border-2 border-indigo-300 shadow-md'
                        : ranking.rank <= 3
                        ? 'bg-yellow-50 border border-yellow-200'
                        : 'bg-white border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-10 h-10 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 font-bold text-base md:text-xl flex-shrink-0">
                      {ranking.rank <= 3 ? (
                        getMedalIcon(ranking.rank)
                      ) : (
                        <span className="text-gray-600">#{ranking.rank}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                        <p className={`font-semibold text-sm md:text-lg truncate ${ranking.isCurrentUser ? 'text-indigo-600' : 'text-gray-900'}`}>
                          {ranking.anonymousId}
                        </p>
                        {ranking.isCurrentUser && (
                          <Badge className="bg-indigo-600 text-xs flex-shrink-0">Bạn</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-2 md:gap-x-4 gap-y-0.5 md:gap-y-1 text-xs md:text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {ranking.completedTasks}/{ranking.totalTasks} tasks
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {ranking.completionRate}% hoàn thành
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ranking.onTimeRate}% đúng hạn
                        </span>
                      </div>
                    </div>

                    {/* Main Stat */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] md:text-sm text-gray-600 mb-0.5 md:mb-1">
                        {getRankingTypeLabel(rankBy)}
                      </p>
                      <p className={`text-xl md:text-3xl font-bold ${
                        ranking.rank === 1 ? 'text-yellow-600' :
                        ranking.rank === 2 ? 'text-gray-600' :
                        ranking.rank === 3 ? 'text-amber-700' :
                        ranking.isCurrentUser ? 'text-indigo-600' : 'text-gray-900'
                      }`}>
                        {getRankingValue(ranking, rankBy)}
                      </p>
                    </div>

                    {/* Detailed Stats */}
                    <div className="hidden lg:grid grid-cols-3 gap-3 text-center">
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-600">Tổng điểm</p>
                        <p className="font-semibold">{ranking.totalScore}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-600">Điểm TB</p>
                        <p className="font-semibold">{ranking.averageScore}</p>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-600">Hoàn thành</p>
                        <p className="font-semibold">{ranking.completedTasks}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Award className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-2">📊 Thông tin về bảng xếp hạng</p>
                  <ul className="space-y-1 text-xs">
                    {user?.role === 'admin' || user?.role === 'vice_principal' ? (
                      <>
                        <li>• Bạn có thể xem tên thật của tất cả giáo viên</li>
                        <li>• Xếp hạng được cập nhật theo thời gian thực</li>
                        <li>• Có thể lọc theo thời gian và tiêu chí xếp hạng khác nhau</li>
                      </>
                    ) : (
                      <>
                        <li>• Danh tính các giáo viên khác được ẩn danh để đảm bảo công bằng</li>
                        <li>• Bạn chỉ có thể nhìn thấy tên và vị trí của chính mình (được highlight màu xanh)</li>
                        <li>• Xếp hạng được cập nhật theo thời gian thực</li>
                        <li>• Có thể lọc theo thời gian và tiêu chí xếp hạng khác nhau</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};