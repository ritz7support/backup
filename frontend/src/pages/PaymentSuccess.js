import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { paymentsAPI } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState(null);
  const { checkAuth } = useAuth();

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!sessionId) {
        setChecking(false);
        return;
      }

      // Poll for payment status
      let attempts = 0;
      const maxAttempts = 5;
      const pollInterval = 2000;

      const poll = async () => {
        try {
          const { data } = await paymentsAPI.checkStatus(sessionId);
          setStatus(data);

          if (data.payment_status === 'paid') {
            setChecking(false);
            await checkAuth(); // Refresh user data
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, pollInterval);
          } else {
            setChecking(false);
          }
        } catch (error) {
          setChecking(false);
        }
      };

      poll();
    };

    checkPaymentStatus();
  }, [sessionId, checkAuth]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-lg">Processing your payment...</p>
        </div>
      </div>
    );
  }

  if (status?.payment_status === 'paid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50">
        <div className="text-center max-w-md mx-auto p-8">
          <CheckCircle className="h-20 w-20 text-green-600 mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4">Payment Successful! 🎉</h1>
          <p className="text-lg text-gray-600 mb-8">
            Welcome to the ABCD community! Your membership is now active.
          </p>
          <Link to="/dashboard">
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600" data-testid="go-to-dashboard-btn">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="text-center max-w-md mx-auto p-8">
        <h1 className="text-4xl font-bold mb-4">Payment Status</h1>
        <p className="text-lg text-gray-600 mb-8">
          We're still processing your payment. Please check back in a moment.
        </p>
        <Link to="/dashboard">
          <Button variant="outline">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
