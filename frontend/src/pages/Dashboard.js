import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI, subscriptionStatusAPI, onboardingAPI } from '../lib/api';
import Header from '../components/Header';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import Sidebar from '../components/Sidebar';
import {
  Sparkles,
  Calendar,
  Users,
  MessageCircle,
  Settings,
  LogOut,
  Bell,
  Crown,
  Loader2,
  Home,
  Trophy,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [spaceGroups, setSpaceGroups] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [onboardingProgress, setOnboardingProgress] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    loadSpaces();
    checkSubscriptionStatus();
    loadOnboardingProgress();
  }, []);

  const loadOnboardingProgress = async () => {
    try {
      const { data } = await onboardingAPI.getMyProgress();
      setOnboardingProgress(data);
      
      // Check if user just completed all steps
      if (data.is_complete && !localStorage.getItem('onboarding_completed_notified')) {
        toast.success('🎉 Congratulations! You\'ve completed all onboarding steps!', {
          duration: 5000,
        });
        localStorage.setItem('onboarding_completed_notified', 'true');
        // Auto-collapse after 3 seconds
        setTimeout(() => setShowOnboarding(false), 3000);
      }
    } catch (error) {
      console.error('Failed to load onboarding progress:', error);
    }
  };

  const loadSpaces = async () => {
    try {
      const [groupsRes, spacesRes] = await Promise.all([
        spacesAPI.getSpaceGroups(),
        spacesAPI.getSpaces(),
      ]);
      setSpaceGroups(groupsRes.data);
      setSpaces(spacesRes.data);
    } catch (error) {
      toast.error('Failed to load spaces');
    } finally {
      setLoading(false);
    }
  };


  const checkSubscriptionStatus = async () => {
    try {
      const { data } = await subscriptionStatusAPI.getMyStatus();
      setSubscriptionStatus(data);
      
      // If payment is required and user doesn't have subscription (and is not admin)
      if (data.requires_payment && !data.has_subscription && !data.is_admin) {
        toast.error('Subscription required to access the community');
        navigate('/pricing');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };


  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" data-testid="dashboard">
      <Header />

      {/* Main Layout with Sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar */}
        {!loading && (
          <Sidebar spaceGroups={spaceGroups} spaces={spaces} />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto" style={{ backgroundColor: '#F3F4F6' }}>
          {children ? (
            children
          ) : (
          <div className="max-w-4xl mx-auto px-8 py-8">
            {/* Welcome Banner */}
            <div className="bg-white rounded-2xl p-8 mb-6 shadow-sm border" style={{ borderColor: '#D1D5DB' }} data-testid="welcome-banner">
              <h1 className="text-3xl font-bold mb-2" style={{ color: '#011328' }}>
                Welcome back, {user?.name?.split(' ')[0]}! 👋
              </h1>
              <p className="text-lg" style={{ color: '#3B3B3B' }}>
                Continue your no-code journey with the ABCD community
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#0462CB' }} />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Onboarding Checklist */}
                {onboardingProgress && !onboardingProgress.is_complete && showOnboarding && (
                  <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-6 w-6" style={{ color: '#0462CB' }} />
                        <h2 className="text-2xl font-bold" style={{ color: '#011328' }}>Welcome & Next Steps</h2>
                      </div>
                      <button
                        onClick={() => setShowOnboarding(false)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Hide checklist"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <p className="mb-4" style={{ color: '#3B3B3B' }}>
                      Complete these steps to get started and earn points!
                    </p>
                    
                    {/* Progress Bar */}
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium" style={{ color: '#3B3B3B' }}>
                          {onboardingProgress.completed_count} of {onboardingProgress.total_steps} completed
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#0462CB' }}>
                          {onboardingProgress.progress_percentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="h-3 rounded-full transition-all duration-500"
                          style={{
                            width: `${onboardingProgress.progress_percentage}%`,
                            background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)'
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Checklist Items */}
                    <div className="space-y-3">
                      {onboardingProgress.steps.map((step, index) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 p-4 rounded-lg border transition-all"
                          style={{
                            backgroundColor: step.completed ? '#F0F9FF' : '#FFFFFF',
                            borderColor: step.completed ? '#0462CB' : '#E5E7EB',
                            opacity: step.completed ? 0.8 : 1
                          }}
                        >
                          {step.completed ? (
                            <CheckCircle2 className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: '#0462CB' }} />
                          ) : (
                            <Circle className="h-6 w-6 flex-shrink-0 mt-0.5" style={{ color: '#D1D5DB' }} />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h3
                                className="font-semibold"
                                style={{
                                  color: step.completed ? '#0462CB' : '#011328',
                                  textDecoration: step.completed ? 'line-through' : 'none'
                                }}
                              >
                                {step.title}
                              </h3>
                              <span
                                className="text-xs font-medium px-2 py-1 rounded"
                                style={{
                                  backgroundColor: step.completed ? '#DCFCE7' : '#FEF3C7',
                                  color: step.completed ? '#166534' : '#92400E'
                                }}
                              >
                                +{step.points} pts
                              </span>
                            </div>
                            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                              {step.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Start Section */}
                <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
                  <h2 className="text-2xl font-bold mb-4" style={{ color: '#011328' }}>Quick Start</h2>
                  <p className="mb-6" style={{ color: '#3B3B3B' }}>
                    Choose a learning path from the sidebar to get started, or explore community discussions.
                  </p>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">🚀</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Start Learning</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Begin with Bubble.io basics</p>
                    </div>
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">💬</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Join Discussions</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Connect with the community</p>
                    </div>
                    <div className="p-6 rounded-xl transition-all cursor-pointer border" style={{ backgroundColor: '#E6EFFA', borderColor: '#5796DC' }}>
                      <div className="text-3xl mb-3">📅</div>
                      <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>Attend Events</h3>
                      <p className="text-sm" style={{ color: '#3B3B3B' }}>Join live sessions & Q&As</p>
                    </div>
                  </div>
                </div>

                {/* Upgrade Banner for Free Users */}
                {user?.membership_tier === 'free' && (
                  <div className="rounded-2xl p-8 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }} data-testid="upgrade-banner">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div>
                        <h3 className="text-2xl font-bold mb-2">Unlock Premium Features</h3>
                        <p style={{ color: '#E6EFFA' }}>
                          Get access to all learning spaces, live sessions, and exclusive community perks.
                        </p>
                      </div>
                      <Link to="/pricing">
                        <Button className="font-medium" style={{ backgroundColor: '#FFB91A', color: '#011328' }} data-testid="upgrade-btn">
                          Upgrade Now
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
