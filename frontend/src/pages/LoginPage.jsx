import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";

const LoginPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate("/", { replace: true });
    }
  }, [user, loading, navigate]);

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

            <GoogleLogin
              onSuccess={async (credentialResponse) => {
                try {
                  const token = credentialResponse.credential;

                  // Step 1: verify + check authorization
                  const res = await axios.post(
                    "https://turf-backend-tx2i.onrender.com/api/auth/google",
                    { token }
                  );

                  if (!res.data.is_authorized) {
                    alert("Access denied");
                    return;
                  }

                  // Step 2: CREATE SESSION (🔥 missing piece)
                  await axios.post(
                    "https://turf-backend-tx2i.onrender.com/api/auth/session",
                    { token },
                    { withCredentials: true }
                  );

                  const me = await axios.get(
                    "https://turf-backend-tx2i.onrender.com/api/auth/me",
                    { withCredentials: true }
                  );

                  // update context
                  login(me.data);

                  navigate("/");

                } catch (err) {
                  console.error(err);
                  alert("Access denied");
                }
              }}
            />

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
