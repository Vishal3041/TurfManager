import { useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { ShieldX, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const AccessDenied = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>

        {/* Title */}
        <h1 className="font-heading text-3xl font-bold text-stone-900 mb-3">
          Access Denied
        </h1>

        {/* Message */}
        <p className="text-stone-600 mb-6">
          Your email address is not authorized to access this application.
          Please contact the administrator to request access.
        </p>

        {/* User Info */}
        {user && (
          <div className="bg-stone-100 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-stone-600">
              <Mail className="w-4 h-4" />
              <span className="text-sm">{user.email}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleLogout}
            className="w-full h-12 bg-stone-800 hover:bg-stone-900 text-white rounded-xl"
            data-testid="logout-access-denied"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out & Try Different Account
          </Button>

          <p className="text-sm text-stone-400">
            Contact: vishaltripathi1497@gmail.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
