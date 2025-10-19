import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { paymentsAPI, subscriptionTiersAPI } from '../lib/api';
import { toast } from 'sonner';
import { Sparkles, Check, Zap, Crown, Loader2 } from 'lucide-react';

export default function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [fetchingTiers, setFetchingTiers] = useState(true);
  const [currency, setCurrency] = useState(null); // Will be auto-detected

  // Auto-detect user location and fetch tiers
  useEffect(() => {
    const detectLocationAndFetchTiers = async () => {
      try {
        // Fetch tiers
        const { data } = await subscriptionTiersAPI.getTiers();
        setTiers(data.filter(tier => tier.is_active));

        // Auto-detect currency based on location (simple detection)
        // In production, use a proper geolocation API
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const isIndian = timezone.includes('Asia/Kolkata') || timezone.includes('Asia/Calcutta');
        setCurrency(isIndian ? 'INR' : 'USD');
      } catch (error) {
        console.error('Error fetching tiers:', error);
        toast.error('Failed to load pricing plans');
        setCurrency('USD'); // Default to USD
      } finally {
        setFetchingTiers(false);
      }
    };

    detectLocationAndFetchTiers();
  }, []);

  // Group tiers by currency
  const tiersByCurrency = {
    INR: tiers.filter(tier => tier.price_inr != null),
    USD: tiers.filter(tier => tier.price_usd != null),
  };

  const handleSubscribe = async (tierId) => {
    if (!user) {
      navigate('/register');
      return;
    }

    setLoading(tierId);
    try {
      const originUrl = window.location.origin;
      const { data } = await paymentsAPI.createOrder(tierId, currency, originUrl);

      if (data.url) {
        // Stripe checkout
        window.location.href = data.url;
      } else if (data.order_id) {
        // Razorpay checkout
        const options = {
          key: data.key_id,
          amount: data.amount * 100,
          currency: data.currency,
          name: 'ABCD Community',
          description: 'Membership Subscription',
          order_id: data.order_id,
          handler: async function (response) {
            try {
              // Verify payment on backend
              await paymentsAPI.verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });
              toast.success('Payment successful! Welcome to the community! 🎉');
              navigate('/dashboard');
            } catch (error) {
              toast.error('Payment verification failed. Please contact support.');
            }
          },
          prefill: {
            name: user.name,
            email: user.email,
          },
          theme: {
            color: '#7c3aed',
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      }
    } catch (error) {
      toast.error('Payment initialization failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img 
              src="https://customer-assets.emergentagent.com/job_abcd-community/artifacts/2ftx37lf_white-blackbackground.png" 
              alt="ABCD Logo" 
              className="h-10 w-10"
            />
            <span className="text-2xl font-bold gradient-text">ABCD</span>
          </Link>
          <div className="flex gap-3">
            {!user ? (
              <>
                <Link to="/login">
                  <Button variant="ghost" data-testid="login-btn">Login</Button>
                </Link>
                <Link to="/register">
                  <Button className="bg-gradient-to-r from-purple-600 to-indigo-600" data-testid="register-btn">
                    Join Now
                  </Button>
                </Link>
              </>
            ) : (
              <Link to="/dashboard">
                <Button variant="outline" data-testid="dashboard-btn">Dashboard</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Crown className="h-4 w-4" />
            First 100 Members Get Founding Member Badge
          </div>
          <h1 className="text-5xl font-bold mb-4">Simple, Transparent Pricing</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your journey. Cancel anytime.
          </p>

          {/* Currency Toggle */}
          {currency && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant={currency === 'INR' ? 'default' : 'outline'}
                onClick={() => setCurrency('INR')}
                className={currency === 'INR' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : ''}
                data-testid="currency-inr-btn"
              >
                🇮🇳 Indian Users (₹)
              </Button>
              <Button
                variant={currency === 'USD' ? 'default' : 'outline'}
                onClick={() => setCurrency('USD')}
                className={currency === 'USD' ? 'bg-gradient-to-r from-purple-600 to-indigo-600' : ''}
                data-testid="currency-usd-btn"
              >
                🌍 International ($)
              </Button>
            </div>
          )}
        </div>

        {fetchingTiers ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {tiersByCurrency[currency]?.map((tier, index) => {
              const price = currency === 'INR' ? tier.price_inr : tier.price_usd;
              const currencySymbol = currency === 'INR' ? '₹' : '$';
              const isYearly = tier.duration_days >= 365;
              const recommended = isYearly; // Recommend yearly plans
              
              return (
                <div
                  key={tier.id}
                  className={`bg-white rounded-3xl p-8 shadow-lg hover-lift ${
                    recommended ? 'ring-2 ring-purple-600 relative' : ''
                  }`}
                  data-testid={`tier-card-${tier.id}`}
                >
                  {recommended && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Recommended
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">{tier.name}</h3>
                    {tier.description && (
                      <p className="text-sm text-gray-600 mb-2">{tier.description}</p>
                    )}
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold gradient-text">{currencySymbol}{price}</span>
                      <span className="text-gray-600">
                        /{tier.payment_type === 'one-time' ? 'once' : isYearly ? 'year' : 'month'}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${
                      recommended
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={loading === tier.id}
                    data-testid={`subscribe-btn-${tier.id}`}
                  >
                    {loading === tier.id ? 'Processing...' : 'Get Started'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Free Features */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold mb-6">Free Features</h3>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="text-3xl mb-2">👀</div>
              <h4 className="font-semibold mb-1">Browse Community</h4>
              <p className="text-sm text-gray-600">View public showcases and discussions</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="text-3xl mb-2">📚</div>
              <h4 className="font-semibold mb-1">Access Resources</h4>
              <p className="text-sm text-gray-600">Free learning materials and guides</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="text-3xl mb-2">📅</div>
              <h4 className="font-semibold mb-1">Event Calendar</h4>
              <p className="text-sm text-gray-600">See upcoming sessions and workshops</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
            <p className="text-gray-600">Yes, you can cancel your subscription at any time. You'll continue to have access until the end of your billing period.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-semibold mb-2">What's the Founding Member badge?</h3>
            <p className="text-gray-600">The first 100 members get a special badge that shows they were early supporters of the community. This badge is permanent!</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm">
            <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
            <p className="text-gray-600">Yes, we offer a 7-day money-back guarantee. If you're not satisfied, contact us for a full refund.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
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
