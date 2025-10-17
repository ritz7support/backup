import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../hooks/useAuth';
import { invitesAPI } from '../lib/api';
import { toast } from 'sonner';
import { Sparkles, User, Mail, Lock, Loader2, Link2 } from 'lucide-react';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'learner'
  });
  const [loading, setLoading] = useState(false);
  const [inviteValid, setInviteValid] = useState(false);
  const [inviteRole, setInviteRole] = useState('');
  const [validatingInvite, setValidatingInvite] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (inviteToken) {
      validateInvite();
    }
  }, [inviteToken]);

  const validateInvite = async () => {
    setValidatingInvite(true);
    try {
      const { data } = await invitesAPI.validateInvite(inviteToken);
      setInviteValid(true);
      setInviteRole(data.role);
      setFormData(prev => ({ ...prev, role: data.role }));
      toast.success(`You've been invited as ${data.role.replace('_', ' ')}!`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid or expired invite link');
      setInviteValid(false);
    } finally {
      setValidatingInvite(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...formData, invite_token: inviteToken });
      toast.success('Welcome to ABCD! 🎉');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      toast.error('Google signup failed');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#F3F4F6' }}>
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 p-12 text-white flex-col justify-between" style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)' }}>
        <div className="flex items-center gap-3">
          <img 
            src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/white-blackbackground.png" 
            alt="ABCD Logo" 
            className="h-12 w-12 bg-white rounded-lg p-1"
          />
          <span className="text-2xl font-bold">ABCD</span>
        </div>
        <div>
          <h1 className="text-5xl font-bold mb-4">Start Your Journey</h1>
          <p className="text-xl" style={{ color: '#E6EFFA' }}>Join the fastest growing no-code community and turn your ideas into reality.</p>
        </div>
        <div className="text-sm text-white/80">© 2025 ABCD Community</div>
      </div>

      {/* Right Side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img 
              src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
              alt="ABCD Logo" 
              className="h-10 w-10"
            />
            <span className="text-2xl font-bold gradient-text">ABCD</span>
          </div>

          <h2 className="text-3xl font-bold mb-2">Create Account</h2>
          <p className="text-gray-600 mb-8">
            {inviteToken ? (
              validatingInvite ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating invite...
                </span>
              ) : inviteValid ? (
                <span className="flex items-center gap-2 text-green-600">
                  <Link2 className="h-4 w-4" />
                  You've been invited as {inviteRole.replace('_', ' ')}
                </span>
              ) : (
                <span className="text-red-600">Invalid or expired invite link</span>
              )
            ) : (
              "Start building with no-code today"
            )}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="pl-10"
                  data-testid="name-input"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="pl-10"
                  data-testid="email-input"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={8}
                  className="pl-10"
                  data-testid="password-input"
                />
              </div>
            </div>

            {!inviteToken && (
              <div>
                <Label htmlFor="role">I am a...</Label>
                <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                  <SelectTrigger data-testid="role-select">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={5}>
                    <SelectItem value="learner">Learner</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="business_owner">Business Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              style={{ background: 'linear-gradient(135deg, #0462CB 0%, #034B9B 100%)', color: 'white' }}
              disabled={loading || (inviteToken && !inviteValid)}
              data-testid="submit-btn"
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...</> : 'Create Account'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignup}
            variant="outline"
            className="w-full"
            data-testid="google-signup-btn"
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign up with Google
          </Button>

          <p className="text-center text-sm text-gray-600 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-600 hover:underline font-medium" data-testid="login-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
