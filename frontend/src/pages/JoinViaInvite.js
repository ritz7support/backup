import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { spacesAPI } from '../lib/api';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function JoinViaInvite() {
  const { inviteCode } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) {
      // Redirect to login with invite code in state
      navigate('/login', { state: { inviteCode, returnTo: `/join/${inviteCode}` } });
      return;
    }

    joinViaInvite();
  }, [user, inviteCode]);

  const joinViaInvite = async () => {
    try {
      setLoading(true);
      const { data } = await spacesAPI.joinViaInvite(inviteCode);
      toast.success(`Successfully joined ${data.space.name}!`);
      navigate(`/space/${data.space.id}`);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to join space';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-lg font-medium text-gray-700">Joining space...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we process your invite</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
