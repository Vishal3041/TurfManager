import { useState, useEffect, useCallback } from "react";
import { useAuth, API } from "@/App";
import axios from "axios";
import { format, subDays, subWeeks, subMonths, subYears } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Receipt, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";

import Layout from "@/components/Layout";

const PERIODS = [
  { value: "daily", label: "Today" },
  { value: "weekly", label: "This Week" },
  { value: "monthly", label: "This Month" },
  { value: "yearly", label: "This Year" },
];

const Analytics = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState("monthly");
  const [stats, setStats] = useState(null);
  const [turfs, setTurfs] = useState([]);
  const [selectedTurf, setSelectedTurf] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchTurfs = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/turfs`, { withCredentials: true });
      setTurfs(response.data);
    } catch (error) {
      console.error("Error fetching turfs:", error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period, date: format(new Date(), "yyyy-MM-dd") };
      if (selectedTurf) {
        params.turf_id = selectedTurf.turf_id;
      }
      
      const response = await axios.get(`${API}/dashboard/stats`, {
        params,
        withCredentials: true
      });
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period, selectedTurf]);

  useEffect(() => {
    fetchTurfs();
  }, [fetchTurfs]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Prepare chart data
  const chartData = stats?.chart_data || [];
  
  // Format dates for display
  const formattedChartData = chartData.map(item => ({
    ...item,
    displayDate: format(new Date(item.date), period === "yearly" ? "MMM" : "MMM d")
  }));

  // Pie chart data
  const pieData = stats ? [
    { name: "Income", value: stats.total_income, color: "#1A1A1A" },
    { name: "Expenses", value: stats.total_expenses, color: "#EF4444" },
  ].filter(item => item.value > 0) : [];

  const profitMargin = stats && stats.total_income > 0 
    ? ((stats.profit / stats.total_income) * 100).toFixed(1)
    : 0;

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 uppercase tracking-tight">
            Analytics
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Track your performance
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 h-11 bg-white border-stone-200" data-testid="period-filter">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {turfs.length > 1 && (
            <Select 
              value={selectedTurf?.turf_id || "all"} 
              onValueChange={(val) => setSelectedTurf(val === "all" ? null : turfs.find(t => t.turf_id === val))}
            >
              <SelectTrigger className="w-40 h-11 bg-white border-stone-200" data-testid="turf-filter">
                <SelectValue placeholder="All turfs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Turfs</SelectItem>
                {turfs.map(turf => (
                  <SelectItem key={turf.turf_id} value={turf.turf_id}>{turf.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="card-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-stone-600" />
                  </div>
                  <span className="text-xs text-stone-500 uppercase">Income</span>
                </div>
                <p className="font-heading text-2xl font-bold text-stone-900" data-testid="analytics-income">
                  ₹{stats?.total_income?.toLocaleString('en-IN') || 0}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {stats?.booking_count || 0} bookings
                </p>
              </div>

              <div className="card-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                    <Receipt className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-xs text-stone-500 uppercase">Expenses</span>
                </div>
                <p className="font-heading text-2xl font-bold text-red-500" data-testid="analytics-expenses">
                  ₹{stats?.total_expenses?.toLocaleString('en-IN') || 0}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {stats?.expense_count || 0} entries
                </p>
              </div>

              <div className="card-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats?.profit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    {stats?.profit >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <span className="text-xs text-stone-500 uppercase">Profit</span>
                </div>
                <p className={`font-heading text-2xl font-bold ${stats?.profit >= 0 ? 'text-green-600' : 'text-red-500'}`} data-testid="analytics-profit">
                  ₹{stats?.profit?.toLocaleString('en-IN') || 0}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {profitMargin}% margin
                </p>
              </div>

              <div className="card-surface p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-orange-500" />
                  </div>
                  <span className="text-xs text-stone-500 uppercase">Period</span>
                </div>
                <p className="font-heading text-lg font-bold text-stone-900">
                  {PERIODS.find(p => p.value === period)?.label}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  {stats?.start_date} - {stats?.end_date}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Bar Chart */}
              <div className="card-surface p-4 md:col-span-2">
                <h3 className="font-heading text-lg font-semibold text-stone-900 mb-4">
                  Income vs Expenses
                </h3>
                {formattedChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={formattedChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                      <XAxis 
                        dataKey="displayDate" 
                        tick={{ fill: '#57534e', fontSize: 12 }}
                        axisLine={{ stroke: '#e5e5e5' }}
                      />
                      <YAxis 
                        tick={{ fill: '#57534e', fontSize: 12 }}
                        axisLine={{ stroke: '#e5e5e5' }}
                        tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e5e5',
                          borderRadius: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, '']}
                      />
                      <Bar dataKey="income" fill="#1A1A1A" radius={[4, 4, 0, 0]} name="Income" />
                      <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="Expenses" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-stone-400">
                    No data for this period
                  </div>
                )}
              </div>

              {/* Pie Chart */}
              <div className="card-surface p-4">
                <h3 className="font-heading text-lg font-semibold text-stone-900 mb-4">
                  Distribution
                </h3>
                {pieData.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, '']}
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e5e5',
                            borderRadius: '12px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex gap-6 mt-4">
                      {pieData.map(item => (
                        <div key={item.name} className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm text-stone-600">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-stone-400">
                    No data
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Analytics;
