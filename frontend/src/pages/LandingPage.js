import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Users, Calendar, Trophy, MessageCircle, Zap, GraduationCap, Rocket } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-50" style={{ backgroundColor: '#011328', borderColor: '#022955' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img 
              src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
              alt="ABCD Logo" 
              className="h-10 w-10"
            />
            <span className="text-2xl font-bold text-white">ABCD</span>
          </div>
          <div className="flex gap-3">
            <Link to="/login">
              <Button variant="ghost" className="text-white hover:bg-white/10" data-testid="login-btn">Login</Button>
            </Link>
            <Link to="/register">
              <Button style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }} data-testid="register-btn">
                Join Now
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6" style={{ backgroundColor: '#E6EFFA', color: '#0462CB' }}>
          <Rocket className="h-4 w-4" />
          First 100 Members Get Founding Member Badge
        </div>
        
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight" style={{ color: '#011328' }}>
          Anybody Can
          <br />
          <span style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Design, Develop & Deploy</span>
        </h1>
        
        <p className="text-xl max-w-2xl mx-auto mb-8" style={{ color: '#3B3B3B' }}>
          Join the ultimate no-code community. Learn, build, showcase your work, and connect with mentors and peers.
        </p>
        
        <div className="flex gap-4 justify-center">
          <Link to="/register">
            <Button size="lg" className="text-lg px-8" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }} data-testid="hero-cta-btn">
              Start Your Journey
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="lg" variant="outline" className="text-lg px-8" style={{ borderColor: '#0462CB', color: '#0462CB' }} data-testid="view-pricing-btn">
              View Pricing
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12" style={{ color: '#011328' }}>Everything You Need to Succeed</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#E6EFFA' }}>
              <GraduationCap className="h-6 w-6" style={{ color: '#0462CB' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#011328' }}>Structured Learning</h3>
            <p style={{ color: '#3B3B3B' }}>Master Bubble.io, automation tools, and advanced workflows through our cohort-based programs.</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#E6EFFA' }}>
              <Users className="h-6 w-6" style={{ color: '#0462CB' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#011328' }}>Active Community</h3>
            <p style={{ color: '#3B3B3B' }}>Connect with like-minded builders, get help, and share your journey.</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF3C7' }}>
              <Trophy className="h-6 w-6" style={{ color: '#FFB91A' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#011328' }}>Showcase Work</h3>
            <p style={{ color: '#3B3B3B' }}>Build your portfolio and get discovered by potential clients and employers.</p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: '#E6EFFA' }}>
              <Calendar className="h-6 w-6" style={{ color: '#0462CB' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#011328' }}>Live Sessions</h3>
            <p style={{ color: '#3B3B3B' }}>Join daily office hours, Q&As, and workshops with experienced mentors.</p>
          </div>
        </div>
      </section>

      {/* Learning Tracks */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-4xl font-bold text-center mb-12" style={{ color: '#011328' }}>Learning Tracks</h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="p-8 rounded-3xl text-white" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
            <div className="text-5xl mb-4">🚀</div>
            <h3 className="text-2xl font-bold mb-3">BEGIN</h3>
            <p className="mb-6" style={{ color: '#E6EFFA' }}>Start your no-code journey with comprehensive Bubble.io training.</p>
            <ul className="space-y-2" style={{ color: '#E6EFFA' }}>
              <li>✓ Fundamentals</li>
              <li>✓ Database Design</li>
              <li>✓ Workflows</li>
              <li>✓ Real Projects</li>
            </ul>
          </div>

          <div className="p-8 rounded-3xl text-white" style={{ background: 'linear-gradient(135deg, #034B9B 0%, #011328 100%)' }}>
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-2xl font-bold mb-3">BLAZE</h3>
            <p className="mb-6" style={{ color: '#E6EFFA' }}>Master automation tools and connect your apps seamlessly.</p>
            <ul className="space-y-2" style={{ color: '#E6EFFA' }}>
              <li>✓ Zapier Integration</li>
              <li>✓ Make.com Workflows</li>
              <li>✓ Pabbly Connect</li>
              <li>✓ API Connections</li>
            </ul>
          </div>

          <div className="p-8 rounded-3xl" style={{ background: '#011328', color: 'white' }}>
            <div className="text-5xl mb-4">🧪</div>
            <h3 className="text-2xl font-bold mb-3">GEN</h3>
            <p className="mb-6" style={{ color: '#E6EFFA' }}>Explore experimental builds, AI integration, and advanced patterns.</p>
            <ul className="space-y-2" style={{ color: '#E6EFFA' }}>
              <li>✓ AI & ML Integration</li>
              <li>✓ Advanced Workflows</li>
              <li>✓ Custom Plugins</li>
              <li>✓ Experimental Tech</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl p-12 text-center text-white" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
          <h2 className="text-4xl font-bold mb-4">Ready to Start Building?</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto" style={{ color: '#E6EFFA' }}>
            Join hundreds of builders who are turning their ideas into reality with no-code.
          </p>
          <div className="flex gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="text-lg px-8 bg-white hover:bg-gray-100" style={{ color: '#0462CB' }} data-testid="cta-join-btn">
                Join the Community
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="text-lg px-8 border-white text-white hover:bg-white" style={{ borderColor: 'white' }} data-testid="cta-pricing-btn">
                See Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ backgroundColor: '#011328', borderColor: '#022955' }}>
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-white">
            <div className="flex items-center gap-2">
              <img 
                src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
                alt="ABCD Logo" 
                className="h-8 w-8"
              />
              <span className="font-bold gradient-text">ABCD Community</span>
            </div>
            <p className="text-gray-600 text-sm">© 2025 ABCD. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
