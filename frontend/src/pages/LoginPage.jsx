import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image with Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1634401159080-0b0535ac131a?crop=entropy&cs=srgb&fm=jpg&q=85')"
        }}
      >
        <div className="absolute inset-0 bg-orange-900/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md">
          {/* Logo / Brand */}
          <div className="text-center mb-10">
            <h1 className="font-heading text-5xl md:text-6xl font-bold text-white uppercase tracking-tight mb-3">
              Turf Manager
            </h1>
            <p className="text-orange-100 text-lg">
              Simple booking & expense tracking for your turfs
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl">
            <h2 className="font-heading text-2xl font-semibold text-stone-800 text-center mb-6">
              Welcome Back
            </h2>

            <Button
              data-testid="google-login-btn"
              onClick={handleGoogleLogin}
              className="w-full h-14 bg-white hover:bg-stone-50 text-stone-800 font-semibold rounded-xl border-2 border-stone-200 shadow-sm flex items-center justify-center gap-3 transition-all duration-200"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </Button>

            <p className="text-stone-500 text-sm text-center mt-6">
              Shared access for all team members
            </p>
          </div>

          {/* Footer */}
          <p className="text-orange-100/60 text-sm text-center mt-8">
            Track bookings, manage expenses, grow your business
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
