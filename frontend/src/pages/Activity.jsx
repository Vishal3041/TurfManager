import { useState, useEffect, useCallback } from "react";
import { useAuth, API } from "@/App";
import axios from "axios";
import { format, formatDistanceToNow } from "date-fns";
import { History, Filter, ChevronDown, ChevronUp, Calendar, Clock, User, Phone, MapPin, ArrowRight, Plus, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import Layout from "@/components/Layout";

const ACTION_COLORS = {
  create: "bg-green-100 text-green-700 border-green-200",
  update: "bg-blue-100 text-blue-700 border-blue-200",
  delete: "bg-red-100 text-red-700 border-red-200"
};

const ACTION_ICONS = {
  create: Plus,
  update: Edit2,
  delete: Trash2
};

const ENTITY_COLORS = {
  booking: "bg-orange-100 text-orange-700",
  expense: "bg-purple-100 text-purple-700"
};

const Activity = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalLogs, setTotalLogs] = useState(0);
  const [offset, setOffset] = useState(0);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [expandedLogs, setExpandedLogs] = useState({});
  const limit = 20;

  const fetchLogs = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      
      const params = { limit, offset: newOffset };
      if (entityFilter !== "all") params.entity_type = entityFilter;
      if (actionFilter !== "all") params.action = actionFilter;

      const response = await axios.get(`${API}/activity-logs`, {
        params,
        withCredentials: true
      });

      if (reset) {
        setLogs(response.data.logs);
        setOffset(0);
      } else {
        setLogs(prev => [...prev, ...response.data.logs]);
      }
      setTotalLogs(response.data.total);
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    } finally {
      setLoading(false);
    }
  }, [offset, entityFilter, actionFilter]);

  useEffect(() => {
    fetchLogs(true);
  }, [entityFilter, actionFilter]);

  const loadMore = () => {
    setOffset(prev => prev + limit);
    fetchLogs(false);
  };

  const toggleExpand = (logId) => {
    setExpandedLogs(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "number") return `₹${value.toLocaleString('en-IN')}`;
    return String(value);
  };

  const renderChanges = (log) => {
    if (log.action !== "update" || !log.old_values || !log.new_values) {
      return null;
    }

    const changes = Object.keys(log.new_values).filter(key => 
      key !== "updated_at" && key !== "created_at"
    );

    if (changes.length === 0) return null;

    return (
      <div className="mt-3 pt-3 border-t border-stone-200">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Changes</p>
        <div className="space-y-2">
          {changes.map(key => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="text-stone-500 capitalize min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
              <span className="text-red-600 line-through">{formatValue(log.old_values[key])}</span>
              <ArrowRight className="w-3 h-3 text-stone-400" />
              <span className="text-green-600 font-medium">{formatValue(log.new_values[key])}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBookingData = (data) => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.turf_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.date}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.start_time} - {data.end_time} ({data.duration_hours}h)</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.customer_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Phone className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.phone_number}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-stone-400">₹</span>
          <span className="text-stone-600">{data.price_per_hour?.toLocaleString('en-IN')}/hr → ₹{data.total_price?.toLocaleString('en-IN')}</span>
        </div>
      </div>
    );
  };

  const renderExpenseData = (data) => {
    if (!data) return null;
    return (
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.turf_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-stone-400" />
          <span className="text-stone-600">{data.date}</span>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <span className="text-stone-400">₹</span>
          <span className="text-red-600 font-medium">-₹{data.amount?.toLocaleString('en-IN')}</span>
        </div>
        <div className="col-span-2">
          <span className="text-stone-600">{data.description}</span>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 pb-24 md:pb-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 uppercase tracking-tight flex items-center gap-3">
            <History className="w-8 h-8 text-orange-500" />
            Activity
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Complete audit trail of all changes
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-36 h-11 bg-white border-stone-200" data-testid="entity-filter">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="booking">Bookings</SelectItem>
              <SelectItem value="expense">Expenses</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-36 h-11 bg-white border-stone-200" data-testid="action-filter">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Created</SelectItem>
              <SelectItem value="update">Updated</SelectItem>
              <SelectItem value="delete">Deleted</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto text-sm text-stone-500">
            {totalLogs} total entries
          </div>
        </div>

        {/* Activity List */}
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <History className="w-16 h-16 text-stone-300 mx-auto mb-4" />
            <p className="text-stone-500">No activity logs yet</p>
            <p className="text-stone-400 text-sm mt-1">Activities will appear here as you add bookings and expenses</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => {
              const ActionIcon = ACTION_ICONS[log.action] || History;
              const isExpanded = expandedLogs[log.log_id];
              
              return (
                <Collapsible key={log.log_id} open={isExpanded} onOpenChange={() => toggleExpand(log.log_id)}>
                  <div 
                    className="card-surface p-4 transition-all duration-200 hover:shadow-md"
                    data-testid={`activity-log-${log.log_id}`}
                  >
                    {/* Header */}
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-left">
                        <div className="flex items-start gap-3">
                          {/* Action Icon */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ACTION_COLORS[log.action]}`}>
                            <ActionIcon className="w-5 h-5" />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${ENTITY_COLORS[log.entity_type]}`}>
                                {log.entity_type}
                              </Badge>
                              <span className="text-stone-900 font-medium capitalize">
                                {log.action === "create" && "Created"}
                                {log.action === "update" && "Updated"}
                                {log.action === "delete" && "Deleted"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-sm text-stone-500">
                              <span>by {log.user_name}</span>
                              <span>•</span>
                              <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                            </div>
                          </div>

                          {/* Expand/Collapse */}
                          <div className="flex-shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-stone-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-stone-400" />
                            )}
                          </div>
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    {/* Expanded Content */}
                    <CollapsibleContent>
                      <div className="mt-4 pt-4 border-t border-stone-100">
                        {/* Timestamp */}
                        <p className="text-xs text-stone-400 mb-3">
                          {format(new Date(log.timestamp), "PPpp")} • ID: {log.entity_id}
                        </p>

                        {/* Entity Data */}
                        {log.entity_type === "booking" && log.booking_data && (
                          <div className="bg-stone-50 rounded-xl p-3">
                            {renderBookingData(log.booking_data)}
                          </div>
                        )}

                        {log.entity_type === "expense" && log.expense_data && (
                          <div className="bg-stone-50 rounded-xl p-3">
                            {renderExpenseData(log.expense_data)}
                          </div>
                        )}

                        {/* Changes for updates */}
                        {renderChanges(log)}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}

            {/* Load More */}
            {logs.length < totalLogs && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                  data-testid="load-more-btn"
                >
                  {loading ? <div className="spinner mr-2" /> : null}
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Activity;
