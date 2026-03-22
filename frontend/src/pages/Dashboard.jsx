import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, parseISO } from "date-fns";
import { Calendar, Plus, BarChart3, LogOut, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Components
import Layout from "@/components/Layout";
import DayView from "@/components/DayView";
import AddEntrySheet from "@/components/AddEntrySheet";
import TurfManager from "@/components/TurfManager";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarData, setCalendarData] = useState({ bookings_by_date: {}, expenses_by_date: {} });
  const [turfs, setTurfs] = useState([]);
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [showDayView, setShowDayView] = useState(false);
  const [showTurfManager, setShowTurfManager] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [quickStats, setQuickStats] = useState({ income: 0, expenses: 0, profit: 0 });

  const fetchTurfs = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/turfs`, { withCredentials: true });
      setTurfs(response.data);
      if (response.data.length > 0 && !selectedTurf) {
        setSelectedTurf(response.data[0]);
      }
    } catch (error) {
      console.error("Error fetching turfs:", error);
      toast.error("Failed to load turfs");
    }
  }, [selectedTurf]);

  const fetchCalendarData = useCallback(async () => {
    try {
      const monthStr = format(currentMonth, "yyyy-MM");
      const params = { month: monthStr };
      if (selectedTurf) {
        params.turf_id = selectedTurf.turf_id;
      }
      
      const response = await axios.get(`${API}/dashboard/calendar`, {
        params,
        withCredentials: true
      });
      setCalendarData(response.data);
    } catch (error) {
      console.error("Error fetching calendar:", error);
    }
  }, [currentMonth, selectedTurf]);

  const fetchQuickStats = useCallback(async () => {
    try {
      const params = { period: "monthly", date: format(currentMonth, "yyyy-MM-dd") };
      if (selectedTurf) {
        params.turf_id = selectedTurf.turf_id;
      }
      
      const response = await axios.get(`${API}/dashboard/stats`, {
        params,
        withCredentials: true
      });
      setQuickStats({
        income: response.data.total_income,
        expenses: response.data.total_expenses,
        profit: response.data.profit
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [currentMonth, selectedTurf]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchTurfs();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (turfs.length > 0) {
      fetchCalendarData();
      fetchQuickStats();
    }
  }, [currentMonth, selectedTurf, turfs.length, fetchCalendarData, fetchQuickStats]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCalendarData();
      fetchQuickStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchCalendarData, fetchQuickStats]);

  const refreshData = () => {
    fetchCalendarData();
    fetchQuickStats();
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    setShowDayView(true);
  };

  const handleAddEntry = (date = null) => {
    setEditingEntry(null);
    if (date) {
      setSelectedDate(date);
    }
    setShowAddEntry(true);
  };

  const handleEditEntry = (entry, type) => {
    setEditingEntry({ ...entry, type });
    setShowAddEntry(true);
  };

  const prevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad start of month
  const startPadding = monthStart.getDay();
  const paddedDays = [...Array(startPadding).fill(null), ...days];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 uppercase tracking-tight">
              Dashboard
            </h1>
            <p className="text-stone-500 text-sm mt-1">
              Welcome back, {user?.name?.split(' ')[0]}
            </p>
          </div>
          <Button
            data-testid="manage-turfs-btn"
            variant="ghost"
            size="icon"
            onClick={() => setShowTurfManager(true)}
            className="text-stone-600 hover:text-orange-600"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-surface p-4 text-center">
            <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Income</p>
            <p className="font-heading text-xl md:text-2xl font-bold text-stone-900" data-testid="stat-income">
              ₹{quickStats.income.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="card-surface p-4 text-center">
            <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Expenses</p>
            <p className="font-heading text-xl md:text-2xl font-bold text-red-500" data-testid="stat-expenses">
              ₹{quickStats.expenses.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="card-surface p-4 text-center">
            <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">Profit</p>
            <p className={`font-heading text-xl md:text-2xl font-bold ${quickStats.profit >= 0 ? 'text-green-600' : 'text-red-500'}`} data-testid="stat-profit">
              ₹{quickStats.profit.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {/* Turf Selector */}
        {turfs.length > 1 && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            <Button
              data-testid="turf-filter-all"
              variant={!selectedTurf ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTurf(null)}
              className={!selectedTurf ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              All Turfs
            </Button>
            {turfs.map(turf => (
              <Button
                key={turf.turf_id}
                data-testid={`turf-filter-${turf.turf_id}`}
                variant={selectedTurf?.turf_id === turf.turf_id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTurf(turf)}
                className={selectedTurf?.turf_id === turf.turf_id ? "bg-orange-500 hover:bg-orange-600" : ""}
              >
                {turf.name}
              </Button>
            ))}
          </div>
        )}

        {/* Calendar */}
        <div className="card-surface p-4 md:p-6">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              data-testid="prev-month-btn"
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              className="text-stone-600 hover:text-orange-600"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="font-heading text-xl md:text-2xl font-semibold text-stone-900">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <Button
              data-testid="next-month-btn"
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              className="text-stone-600 hover:text-orange-600"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-stone-500 uppercase py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {paddedDays.map((day, index) => {
              if (!day) {
                return <div key={`empty-${index}`} className="aspect-square" />;
              }

              const dateStr = format(day, "yyyy-MM-dd");
              const dayBookings = calendarData.bookings_by_date[dateStr] || [];
              const dayExpenses = calendarData.expenses_by_date[dateStr] || [];
              const hasBookings = dayBookings.length > 0;
              const hasExpenses = dayExpenses.length > 0;
              const isCurrentDay = isToday(day);

              return (
                <button
                  key={dateStr}
                  data-testid={`calendar-day-${dateStr}`}
                  onClick={() => handleDateClick(day)}
                  className={`
                    aspect-square p-1 rounded-xl flex flex-col items-center justify-center relative
                    transition-all duration-200 hover:bg-orange-50
                    ${isCurrentDay ? 'bg-orange-50 ring-2 ring-orange-500' : 'bg-stone-50'}
                  `}
                >
                  <span className={`text-sm font-medium ${isCurrentDay ? 'text-orange-600' : 'text-stone-700'}`}>
                    {format(day, "d")}
                  </span>
                  
                  {/* Indicators */}
                  <div className="flex gap-1 mt-1">
                    {hasBookings && (
                      <div className="w-2 h-2 rounded-full bg-orange-500" title={`${dayBookings.length} booking(s)`} />
                    )}
                    {hasExpenses && (
                      <div className="w-2 h-2 rounded-full bg-red-400" title={`${dayExpenses.length} expense(s)`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
              <span className="text-xs text-stone-500">Bookings</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-xs text-stone-500">Expenses</span>
            </div>
          </div>
        </div>

        {/* FAB for mobile */}
        <button
          data-testid="fab-add-entry"
          onClick={() => handleAddEntry()}
          className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 flex items-center justify-center z-50 md:hidden active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>

        {/* Desktop Add Button */}
        <div className="hidden md:block fixed bottom-20 right-6 z-50">
          <Button
            data-testid="desktop-add-entry"
            onClick={() => handleAddEntry()}
            className="btn-primary h-14 px-6 rounded-full shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Day View Sheet */}
      <DayView
        open={showDayView}
        onClose={() => setShowDayView(false)}
        date={selectedDate}
        turfs={turfs}
        selectedTurf={selectedTurf}
        onAddEntry={handleAddEntry}
        onEditEntry={handleEditEntry}
        onRefresh={refreshData}
      />

      {/* Add/Edit Entry Sheet */}
      <AddEntrySheet
        open={showAddEntry}
        onClose={() => {
          setShowAddEntry(false);
          setEditingEntry(null);
        }}
        date={selectedDate || new Date()}
        turfs={turfs}
        editingEntry={editingEntry}
        onSuccess={refreshData}
      />

      {/* Turf Manager */}
      <TurfManager
        open={showTurfManager}
        onClose={() => setShowTurfManager(false)}
        turfs={turfs}
        onRefresh={fetchTurfs}
      />
    </Layout>
  );
};

export default Dashboard;
