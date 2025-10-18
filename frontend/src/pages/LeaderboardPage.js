import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { leaderboardAPI } from '../lib/api';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Trophy, TrendingUp, Award, Loader2, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import Dashboard from './Dashboard';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUserStats, setCurrentUserStats] = useState(null);
  const [currentUserRank, setCurrentUserRank] = useState(null);
  const [timeFilter, setTimeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [levels, setLevels] = useState([]);

  // This will be rendered with Dashboard wrapper
  const renderContent = () => {

  useEffect(() => {
    loadLeaderboard();
    loadLevels();
  }, [timeFilter]);

  const loadLevels = async () => {
    try {
      const { data } = await leaderboardAPI.getLevels();
      setLevels(data || []);
    } catch (error) {
      console.error('Failed to load levels:', error);
    }
  };

  const loadLeaderboard = async () => {
    try {
      setLoading(true);
      const { data } = await leaderboardAPI.getLeaderboard(timeFilter);
      setLeaderboard(data.leaderboard || []);
      setCurrentUserStats(data.current_user);
      setCurrentUserRank(data.current_user_rank);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      toast.error('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level) => {
    if (level >= 10) return '#9333EA'; // Champion - Purple
    if (level >= 9) return '#DC2626'; // Legend - Red
    if (level >= 8) return '#EA580C'; // Master - Orange
    if (level >= 7) return '#D97706'; // Expert - Amber
    if (level >= 6) return '#0891B2'; // Regular - Cyan
    if (level >= 5) return '#059669'; // Contributor - Green
    if (level >= 4) return '#0284C7'; // Explorer - Blue
    if (level >= 3) return '#4F46E5'; // Learner - Indigo
    if (level >= 2) return '#7C3AED'; // Beginner - Violet
    return '#6B7280'; // Newbie - Gray
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#F3F4F6' }}>
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Dashboard>
    );
  }

  return (
    <Dashboard>
      <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
        <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Trophy className="h-8 w-8" style={{ color: '#0462CB' }} />
              <h1 className="text-3xl font-bold" style={{ color: '#011328' }}>Leaderboard</h1>
            </div>
            <Button
              onClick={() => setShowHowItWorks(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              How It Works
            </Button>
          </div>
          <p className="text-lg" style={{ color: '#8E8E8E' }}>Compete with the community and climb the ranks!</p>
        </div>

        {/* Time Filter Buttons */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={() => setTimeFilter('week')}
            variant={timeFilter === 'week' ? 'default' : 'outline'}
            style={timeFilter === 'week' ? { background: 'linear-gradient(135deg, #0462CB 0%, #0284C7 100%)', color: 'white' } : {}}
          >
            Last 7 Days
          </Button>
          <Button
            onClick={() => setTimeFilter('month')}
            variant={timeFilter === 'month' ? 'default' : 'outline'}
            style={timeFilter === 'month' ? { background: 'linear-gradient(135deg, #0462CB 0%, #0284C7 100%)', color: 'white' } : {}}
          >
            Last 30 Days
          </Button>
          <Button
            onClick={() => setTimeFilter('all')}
            variant={timeFilter === 'all' ? 'default' : 'outline'}
            style={timeFilter === 'all' ? { background: 'linear-gradient(135deg, #0462CB 0%, #0284C7 100%)', color: 'white' } : {}}
          >
            All Time
          </Button>
        </div>

        {/* Current User Stats Card */}
        {currentUserStats && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border mb-6" style={{ borderColor: '#D1D5DB', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                  {user.picture ? (
                    <AvatarImage src={user.picture} />
                  ) : (
                    <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white', fontSize: '1.5rem' }}>
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: '#8E8E8E' }}>Your Rank</p>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-bold" style={{ color: '#011328' }}>
                      {currentUserRank ? getRankEmoji(currentUserRank) : '-'}
                    </span>
                    <div className="px-3 py-1 rounded-full text-sm font-bold" style={{ backgroundColor: getLevelColor(currentUserStats.current_level), color: 'white' }}>
                      Level {currentUserStats.current_level} - {currentUserStats.current_level_name}
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium mb-1" style={{ color: '#8E8E8E' }}>Total Points</p>
                <p className="text-3xl font-bold" style={{ color: '#0462CB' }}>{currentUserStats.total_points}</p>
                {currentUserStats.points_to_next_level && (
                  <p className="text-sm mt-1" style={{ color: '#8E8E8E' }}>
                    {currentUserStats.points_to_next_level} points to Level {currentUserStats.next_level}
                  </p>
                )}
              </div>
            </div>
            {/* Progress Bar */}
            {currentUserStats.next_level_points && (
              <div className="mt-4">
                <div className="w-full bg-white rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(currentUserStats.total_points / currentUserStats.next_level_points) * 100}%`,
                      background: 'linear-gradient(90deg, #0462CB 0%, #0284C7 100%)'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard List */}
        <div className="bg-white rounded-2xl shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
          <div className="p-6 border-b" style={{ borderColor: '#E5E7EB' }}>
            <h2 className="text-xl font-bold" style={{ color: '#011328' }}>
              Top {leaderboard.length} Users
              {timeFilter === 'week' && ' - Last 7 Days'}
              {timeFilter === 'month' && ' - Last 30 Days'}
              {timeFilter === 'all' && ' - All Time'}
            </h2>
          </div>

          {leaderboard.length === 0 ? (
            <div className="p-12 text-center">
              <Award className="h-16 w-16 mx-auto mb-4" style={{ color: '#D1D5DB' }} />
              <p className="text-lg font-medium mb-2" style={{ color: '#8E8E8E' }}>No data yet</p>
              <p style={{ color: '#8E8E8E' }}>Start engaging to appear on the leaderboard!</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#E5E7EB' }}>
              {leaderboard.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`p-4 hover:bg-gray-50 transition-colors ${entry.user_id === user?.id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Rank */}
                      <div className="text-center w-16">
                        <span className="text-2xl font-bold" style={{ color: entry.rank <= 3 ? '#0462CB' : '#8E8E8E' }}>
                          {getRankEmoji(entry.rank)}
                        </span>
                      </div>

                      {/* Avatar & Name */}
                      <Avatar className="h-12 w-12 border-2" style={{ borderColor: entry.user_id === user?.id ? '#0462CB' : '#E5E7EB' }}>
                        {entry.picture ? (
                          <AvatarImage src={entry.picture} />
                        ) : (
                          <AvatarFallback style={{ backgroundColor: '#0462CB', color: 'white' }}>
                            {entry.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" style={{ color: '#011328' }}>{entry.name}</p>
                          {entry.user_id === user?.id && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div
                            className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ backgroundColor: getLevelColor(entry.level), color: 'white' }}
                          >
                            Level {entry.level}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" style={{ color: '#0462CB' }} />
                        <span className="text-2xl font-bold" style={{ color: '#0462CB' }}>
                          {entry.points}
                        </span>
                      </div>
                      <p className="text-sm" style={{ color: '#8E8E8E' }}>points</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* How It Works Dialog */}
      <Dialog open={showHowItWorks} onOpenChange={setShowHowItWorks}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Trophy className="h-6 w-6" style={{ color: '#0462CB' }} />
              How the Leaderboard Works
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Points Earning Section */}
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: '#011328' }}>📈 Earn Points by Engaging</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="text-2xl">❤️</div>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: '#011328' }}>Like a Post</p>
                    <p className="text-sm" style={{ color: '#8E8E8E' }}>You get <strong>+1 point</strong> for liking, and the post author gets <strong>+1 point</strong></p>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#0462CB' }}>+1</div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="text-2xl">💬</div>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: '#011328' }}>Comment on a Post</p>
                    <p className="text-sm" style={{ color: '#8E8E8E' }}>You get <strong>+2 points</strong> for commenting, and the post author gets <strong>+2 points</strong></p>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#0462CB' }}>+2</div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="text-2xl">✍️</div>
                  <div className="flex-1">
                    <p className="font-semibold" style={{ color: '#011328' }}>Create a Post</p>
                    <p className="text-sm" style={{ color: '#8E8E8E' }}>You get <strong>+3 points</strong> for creating a post</p>
                  </div>
                  <div className="text-2xl font-bold" style={{ color: '#0462CB' }}>+3</div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                <p className="text-sm" style={{ color: '#1E40AF' }}>
                  💡 <strong>Pro Tip:</strong> Both you and the person you engage with earn points! The more you interact, the more everyone benefits.
                </p>
              </div>
            </div>

            {/* Levels Section */}
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: '#011328' }}>🏆 Levels & Requirements</h3>
              <div className="space-y-2">
                {levels.length > 0 ? (
                  levels.sort((a, b) => a.level_number - b.level_number).map((level) => (
                    <div key={level.id} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                          style={{
                            background: level.level_number >= 10 ? '#9333EA' :
                                       level.level_number >= 9 ? '#DC2626' :
                                       level.level_number >= 8 ? '#EA580C' :
                                       level.level_number >= 7 ? '#D97706' :
                                       level.level_number >= 6 ? '#0891B2' :
                                       level.level_number >= 5 ? '#059669' :
                                       level.level_number >= 4 ? '#0284C7' :
                                       level.level_number >= 3 ? '#4F46E5' :
                                       level.level_number >= 2 ? '#7C3AED' : '#6B7280'
                          }}
                        >
                          {level.level_number}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: '#011328' }}>{level.level_name || `Level ${level.level_number}`}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color: '#0462CB' }}>{level.points_required} points</p>
                        <p className="text-xs" style={{ color: '#8E8E8E' }}>required</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p style={{ color: '#8E8E8E' }}>Loading levels...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Time Filters Explanation */}
            <div>
              <h3 className="text-xl font-bold mb-4" style={{ color: '#011328' }}>📅 Leaderboard Filters</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="font-bold" style={{ color: '#0462CB' }}>Last 7 Days</div>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>See who's been most active in the past week</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="font-bold" style={{ color: '#0462CB' }}>Last 30 Days</div>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>Monthly leaderboard for recent activity</p>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  <div className="font-bold" style={{ color: '#0462CB' }}>All Time</div>
                  <p className="text-sm" style={{ color: '#8E8E8E' }}>Overall leaderboard showing total points earned</p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="text-center p-6 rounded-lg" style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' }}>
              <p className="text-lg font-bold mb-2" style={{ color: '#011328' }}>Start Climbing the Leaderboard! 🚀</p>
              <p style={{ color: '#8E8E8E' }}>Engage with posts, share your thoughts, and help others in the community.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t" style={{ borderColor: '#E5E7EB' }}>
            <Button onClick={() => setShowHowItWorks(false)} style={{ background: 'linear-gradient(135deg, #0462CB 0%, #0284C7 100%)' }} className="text-white">
              Got It!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </Dashboard>
  );
}
