import { useState, useEffect } from 'react';
import { referralAPI } from '../lib/api';
import { Button } from './ui/button';
import { Share2, Copy, Users, Gift, DollarSign, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ReferralSection() {
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const [codeRes, statsRes] = await Promise.all([
        referralAPI.getMyReferralCode(),
        referralAPI.getMyReferralStats()
      ]);
      setReferralCode(codeRes.data.referral_code);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load referral data:', error);
      toast.error('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const getReferralLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/register?ref=${referralCode}`;
  };

  const copyToClipboard = (text) => {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          toast.success('Copied to clipboard!');
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          // Fallback to legacy method
          fallbackCopy(text);
        });
    } else {
      // Use fallback method directly
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    try {
      // Create temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-999999px';
      textarea.style.top = '-999999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      
      // Execute copy command
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      
      if (successful) {
        setCopied(true);
        toast.success('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('Failed to copy. Please copy manually.');
      }
    } catch (error) {
      console.error('Fallback copy failed:', error);
      toast.error('Failed to copy. Please copy manually.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border" style={{ borderColor: '#D1D5DB' }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg" style={{ backgroundColor: '#E6EFFA' }}>
          <Gift className="h-6 w-6" style={{ color: '#0462CB' }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: '#011328' }}>Referral Program</h2>
          <p className="text-sm" style={{ color: '#8E8E8E' }}>Invite friends and earn rewards!</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-lg border" style={{ borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5" style={{ color: '#0462CB' }} />
            <span className="text-sm font-medium" style={{ color: '#8E8E8E' }}>Total Referrals</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: '#011328' }}>{stats?.total_referrals || 0}</p>
        </div>

        <div className="p-4 rounded-lg border" style={{ borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}>
          <div className="flex items-center gap-2 mb-2">
            <Gift className="h-5 w-5" style={{ color: '#0462CB' }} />
            <span className="text-sm font-medium" style={{ color: '#8E8E8E' }}>Points Earned</span>
          </div>
          <p className="text-3xl font-bold" style={{ color: '#011328' }}>{stats?.total_points || 0}</p>
        </div>

        <div className="p-4 rounded-lg border" style={{ borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-5 w-5" style={{ color: '#0462CB' }} />
            <span className="text-sm font-medium" style={{ color: '#8E8E8E' }}>Available Credits</span>
          </div>
          <p className="text-xl font-bold" style={{ color: '#011328' }}>
            ₹{stats?.credits_inr || 0} / ${stats?.credits_usd?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: '#011328' }}>
          Your Referral Link
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={getReferralLink()}
            readOnly
            className="flex-1 px-4 py-2 border rounded-lg font-mono text-sm"
            style={{ borderColor: '#D1D5DB', color: '#3B3B3B', backgroundColor: '#F9FAFB' }}
          />
          <Button
            onClick={() => copyToClipboard(getReferralLink())}
            style={{ backgroundColor: copied ? '#10B981' : '#0462CB', color: 'white' }}
          >
            {copied ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Referral Code */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2" style={{ color: '#011328' }}>
          Your Referral Code
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={referralCode}
            readOnly
            className="flex-1 px-4 py-2 border rounded-lg font-mono text-lg font-bold text-center"
            style={{ borderColor: '#D1D5DB', color: '#0462CB', backgroundColor: '#F9FAFB' }}
          />
          <Button
            onClick={() => copyToClipboard(referralCode)}
            variant="outline"
            style={{ borderColor: '#0462CB', color: '#0462CB' }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
        </div>
      </div>

      {/* How it Works */}
      <div className="p-4 rounded-lg" style={{ backgroundColor: '#F0F9FF', borderLeft: '4px solid #0462CB' }}>
        <h3 className="font-semibold mb-2" style={{ color: '#011328' }}>How it works:</h3>
        <ul className="space-y-1 text-sm" style={{ color: '#3B3B3B' }}>
          <li>• Share your referral link or code with friends</li>
          <li>• They sign up using your link/code</li>
          <li>• You earn <strong>50 points</strong> per successful referral</li>
          <li>• They get <strong>25 bonus points</strong> for joining!</li>
          <li>• Redeem points: 1 point = ₹1 or $0.05</li>
          <li>• Credits auto-apply at checkout</li>
        </ul>
      </div>

      {/* Referred Users List */}
      {stats?.referred_users && stats.referred_users.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3" style={{ color: '#011328' }}>
            Your Referrals ({stats.referred_users.length})
          </h3>
          <div className="space-y-2">
            {stats.referred_users.slice(0, 5).map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                style={{ borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' }}
              >
                <div>
                  <p className="font-medium" style={{ color: '#011328' }}>{user.name}</p>
                  <p className="text-xs" style={{ color: '#8E8E8E' }}>
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className="text-xs font-medium px-2 py-1 rounded"
                  style={{ backgroundColor: '#DCFCE7', color: '#166534' }}
                >
                  +50 pts
                </span>
              </div>
            ))}
          </div>
          {stats.referred_users.length > 5 && (
            <p className="text-sm text-center mt-3" style={{ color: '#8E8E8E' }}>
              And {stats.referred_users.length - 5} more...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
