import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/App";
import { Calendar, BarChart3, LogOut, User, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/", icon: Calendar, label: "Calendar" },
    { path: "/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/activity", icon: History, label: "Activity" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7]">
      {/* Desktop Top Bar */}
      <header className="hidden md:flex h-16 bg-white/80 backdrop-blur border-b border-stone-200 items-center px-8 justify-between sticky top-0 z-40">
        <div className="flex items-center gap-8">
          <h1 
            className="font-heading text-xl font-bold text-stone-900 uppercase cursor-pointer"
            onClick={() => navigate("/")}
          >
            Turf Manager
          </h1>
          <nav className="flex gap-1">
            {navItems.map(item => (
              <Button
                key={item.path}
                data-testid={`nav-${item.label.toLowerCase()}`}
                variant="ghost"
                onClick={() => navigate(item.path)}
                className={`
                  flex items-center gap-2 px-4 h-10 rounded-lg font-medium
                  ${location.pathname === item.path 
                    ? 'bg-orange-50 text-orange-600' 
                    : 'text-stone-600 hover:bg-stone-100'}
                `}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-3 h-10 px-3 rounded-lg"
              data-testid="user-menu-trigger"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-orange-100 text-orange-600 font-semibold text-sm">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-stone-700">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-stone-600">
              <User className="w-4 h-4 mr-2" />
              {user?.email}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-600 cursor-pointer"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden h-14 bg-white/80 backdrop-blur border-b border-stone-200 flex items-center px-4 justify-between sticky top-0 z-40">
        <h1 className="font-heading text-lg font-bold text-stone-900 uppercase">
          Turf Manager
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="mobile-user-menu">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.picture} alt={user?.name} />
                <AvatarFallback className="bg-orange-100 text-orange-600 font-semibold text-xs">
                  {getInitials(user?.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem className="text-stone-600">
              <User className="w-4 h-4 mr-2" />
              {user?.name}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-600 cursor-pointer"
              data-testid="mobile-logout-btn"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-4rem)]">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-stone-200 flex justify-around items-center z-40 pb-safe">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center justify-center gap-1 w-16 h-full
                ${isActive ? 'text-orange-500' : 'text-stone-400'}
              `}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Layout;
