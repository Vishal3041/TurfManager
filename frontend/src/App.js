import { useEffect, useState, useCallback, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import Analytics from "@/pages/Analytics";
import Activity from "@/pages/Activity";

// ================= API =================
// Auto-detect environment: localhost or Codespaces
const BACKEND_URL = 
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000"
    : "https://fuzzy-palm-tree-4qr4vxvqpgw3q54w-8000.app.github.dev";

export const API = `${BACKEND_URL}/api`;

// ================= AXIOS INTERCEPTOR =================
// Automatically attach token to all requests
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ================= AUTH CONTEXT =================
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// ================= AUTH PROVIDER =================
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("token");

    // 🔥 If no token, skip API call
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error("Auth check failed:", error);
      localStorage.removeItem("token"); // cleanup invalid token
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
    } catch (error) {
      console.error("Logout error:", error);
    }

    // 🔥 Clear token always
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};

// ================= PROTECTED ROUTE =================
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  // 🔥 Only allow valid authorized users
  if (!user || user.is_authorized === false) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// ================= ROUTER =================
const AppRouter = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/activity"
        element={
          <ProtectedRoute>
            <Activity />
          </ProtectedRoute>
        }
      />

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

// ================= APP =================
function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;