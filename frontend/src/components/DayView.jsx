import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import axios from "axios";
import { API } from "@/App";
import { X, Plus, Clock, User, Phone, Edit2, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// Generate time slots from 6 AM to midnight
const TIME_SLOTS = [];
for (let hour = 6; hour < 24; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

const DayView = ({ open, onClose, date, turfs, selectedTurf: initialTurf, onAddEntry, onEditEntry, onRefresh }) => {
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewTurf, setViewTurf] = useState(null);

  useEffect(() => {
    if (turfs.length > 0) {
      setViewTurf(initialTurf || turfs[0]);
    }
  }, [turfs, initialTurf]);

  const fetchDayData = useCallback(async () => {
    if (!date || !viewTurf) return;
    
    setLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      
      const [availableRes, expensesRes] = await Promise.all([
        axios.get(`${API}/available-slots`, {
          params: { turf_id: viewTurf.turf_id, date: dateStr },
          withCredentials: true
        }),
        axios.get(`${API}/expenses`, {
          params: { date: dateStr, turf_id: viewTurf.turf_id },
          withCredentials: true
        })
      ]);
      
      setBookings(availableRes.data.bookings || []);
      setExpenses(expensesRes.data || []);
    } catch (error) {
      console.error("Error fetching day data:", error);
      toast.error("Failed to load day data");
    } finally {
      setLoading(false);
    }
  }, [date, viewTurf]);

  useEffect(() => {
    if (open && date && viewTurf) {
      fetchDayData();
    }
  }, [open, date, viewTurf, fetchDayData]);

  const handleDeleteBooking = async (bookingId) => {
    try {
      await axios.delete(`${API}/bookings/${bookingId}`, { withCredentials: true });
      toast.success("Booking deleted");
      fetchDayData();
      onRefresh();
    } catch (error) {
      toast.error("Failed to delete booking");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      await axios.delete(`${API}/expenses/${expenseId}`, { withCredentials: true });
      toast.success("Expense deleted");
      fetchDayData();
      onRefresh();
    } catch (error) {
      toast.error("Failed to delete expense");
    }
  };

  // Check if a time slot is booked
  const getBookingAtSlot = (slotTime) => {
    return bookings.find(booking => {
      const slotMinutes = parseInt(slotTime.split(':')[0]) * 60 + parseInt(slotTime.split(':')[1]);
      const startMinutes = parseInt(booking.start_time.split(':')[0]) * 60 + parseInt(booking.start_time.split(':')[1]);
      const endMinutes = parseInt(booking.end_time.split(':')[0]) * 60 + parseInt(booking.end_time.split(':')[1]);
      return slotMinutes >= startMinutes && slotMinutes < endMinutes;
    });
  };

  // Check if slot is start of a booking
  const isBookingStart = (slotTime, booking) => {
    return booking && booking.start_time === slotTime;
  };

  // Calculate booking span in slots
  const getBookingSpan = (booking) => {
    const startMinutes = parseInt(booking.start_time.split(':')[0]) * 60 + parseInt(booking.start_time.split(':')[1]);
    const endMinutes = parseInt(booking.end_time.split(':')[0]) * 60 + parseInt(booking.end_time.split(':')[1]);
    return (endMinutes - startMinutes) / 30;
  };

  if (!date) return null;

  const dateStr = format(date, "yyyy-MM-dd");

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-stone-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="font-heading text-xl font-semibold text-stone-900">
                {format(date, "EEEE, MMMM d")}
              </SheetTitle>
              <Button
                data-testid="add-entry-from-day-view"
                onClick={() => onAddEntry(date)}
                className="btn-primary h-10 px-4"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
            
            {/* Turf selector */}
            {turfs.length > 1 && (
              <div className="mt-3">
                <Select 
                  value={viewTurf?.turf_id} 
                  onValueChange={(val) => setViewTurf(turfs.find(t => t.turf_id === val))}
                >
                  <SelectTrigger className="w-full h-10 bg-stone-50" data-testid="day-view-turf-select">
                    <SelectValue placeholder="Select turf" />
                  </SelectTrigger>
                  <SelectContent>
                    {turfs.map(turf => (
                      <SelectItem key={turf.turf_id} value={turf.turf_id}>{turf.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 pb-32">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="spinner" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Time Slots Grid */}
                <div>
                  <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">
                    Time Slots
                  </h3>
                  <div className="space-y-1">
                    {TIME_SLOTS.map((slot, index) => {
                      const booking = getBookingAtSlot(slot);
                      const isStart = booking && isBookingStart(slot, booking);
                      
                      // Skip rendering if this slot is part of a booking but not the start
                      if (booking && !isStart) {
                        return null;
                      }
                      
                      if (booking && isStart) {
                        const span = getBookingSpan(booking);
                        return (
                          <div 
                            key={slot}
                            data-testid={`booked-slot-${slot}`}
                            className="bg-orange-100 border border-orange-300 rounded-xl p-3 relative"
                            style={{ minHeight: `${span * 40}px` }}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 text-orange-800 font-semibold text-sm">
                                  <Clock className="w-4 h-4" />
                                  {booking.start_time} - {booking.end_time}
                                </div>
                                <div className="flex items-center gap-2 text-stone-700 mt-1">
                                  <User className="w-4 h-4 text-stone-400" />
                                  {booking.customer_name}
                                </div>
                                <div className="flex items-center gap-2 text-stone-500 text-sm mt-1">
                                  <Phone className="w-4 h-4 text-stone-400" />
                                  {booking.phone_number}
                                </div>
                                <div className="flex items-center gap-2 text-green-600 font-semibold mt-1">
                                  <span className="text-sm">₹</span>
                                  {booking.total_price.toLocaleString('en-IN')}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  data-testid={`edit-booking-${booking.booking_id}`}
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-stone-500 hover:text-orange-600"
                                  onClick={() => onEditEntry(booking, 'booking')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      data-testid={`delete-booking-${booking.booking_id}`}
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-stone-500 hover:text-red-600"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Booking</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete this booking? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteBooking(booking.booking_id)}
                                        className="bg-red-500 hover:bg-red-600"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Available slot
                      return (
                        <button
                          key={slot}
                          data-testid={`available-slot-${slot}`}
                          onClick={() => onAddEntry(date)}
                          className="w-full h-10 bg-stone-50 border border-stone-200 rounded-lg flex items-center px-3 text-sm text-stone-600 hover:border-orange-300 hover:bg-orange-50 transition-all"
                        >
                          <Clock className="w-4 h-4 mr-2 text-stone-400" />
                          {slot}
                          <span className="ml-auto text-xs text-stone-400">Available</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Expenses Section */}
                {expenses.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-stone-700 text-sm uppercase tracking-wide mb-3">
                      Expenses
                    </h3>
                    <div className="space-y-2">
                      {expenses.map(expense => (
                        <div 
                          key={expense.expense_id}
                          data-testid={`expense-${expense.expense_id}`}
                          className="bg-red-50 border border-red-200 rounded-xl p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-stone-800 font-medium">{expense.description}</p>
                              <p className="text-red-600 font-semibold mt-1">
                                -₹{expense.amount.toLocaleString('en-IN')}
                              </p>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                data-testid={`edit-expense-${expense.expense_id}`}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-stone-500 hover:text-orange-600"
                                onClick={() => onEditEntry(expense, 'expense')}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    data-testid={`delete-expense-${expense.expense_id}`}
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-stone-500 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this expense? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteExpense(expense.expense_id)}
                                      className="bg-red-500 hover:bg-red-600"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {bookings.length === 0 && expenses.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-stone-400">No bookings or expenses for this day</p>
                    <Button
                      onClick={() => onAddEntry(date)}
                      variant="ghost"
                      className="mt-4 text-orange-600"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add your first entry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DayView;
