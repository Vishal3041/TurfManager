import { useState, useEffect } from "react";
import { format } from "date-fns";
import axios from "axios";
import { API } from "@/App";
import { Calendar, Clock, User, Phone, FileText, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

// Generate time slots from 6 AM to midnight
const TIME_SLOTS = [];
for (let hour = 6; hour < 24; hour++) {
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:00`);
  TIME_SLOTS.push(`${hour.toString().padStart(2, '0')}:30`);
}

const AddEntrySheet = ({ open, onClose, date, turfs, editingEntry, onSuccess }) => {
  const [entryType, setEntryType] = useState("booking");
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date || new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Booking fields
  const [turfId, setTurfId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pricePerHour, setPricePerHour] = useState("");
  
  // Expense fields
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (editingEntry) {
        setEntryType(editingEntry.type);
        setSelectedDate(new Date(editingEntry.date));
        setTurfId(editingEntry.turf_id);
        
        if (editingEntry.type === "booking") {
          setStartTime(editingEntry.start_time);
          setEndTime(editingEntry.end_time);
          setCustomerName(editingEntry.customer_name);
          setPhoneNumber(editingEntry.phone_number);
          setPricePerHour(editingEntry.price_per_hour.toString());
        } else {
          setExpenseAmount(editingEntry.amount.toString());
          setExpenseDescription(editingEntry.description);
        }
      } else {
        // Reset to defaults
        setSelectedDate(date || new Date());
        setTurfId(turfs[0]?.turf_id || "");
        setStartTime("");
        setEndTime("");
        setCustomerName("");
        setPhoneNumber("");
        setPricePerHour("");
        setExpenseAmount("");
        setExpenseDescription("");
      }
    }
  }, [open, editingEntry, date, turfs]);

  // Auto-select end time based on start time
  useEffect(() => {
    if (startTime && !editingEntry) {
      const startIndex = TIME_SLOTS.indexOf(startTime);
      if (startIndex !== -1 && startIndex + 2 < TIME_SLOTS.length) {
        setEndTime(TIME_SLOTS[startIndex + 2]); // Default to 1 hour
      }
    }
  }, [startTime, editingEntry]);

  // Filter end times to be after start time
  const availableEndTimes = TIME_SLOTS.filter(slot => {
    if (!startTime) return true;
    return slot > startTime;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      if (entryType === "booking") {
        if (!turfId || !startTime || !endTime || !customerName || !phoneNumber || !pricePerHour) {
          toast.error("Please fill in all fields");
          setLoading(false);
          return;
        }

        const bookingData = {
          turf_id: turfId,
          date: dateStr,
          start_time: startTime,
          end_time: endTime,
          customer_name: customerName,
          phone_number: phoneNumber,
          price_per_hour: parseFloat(pricePerHour)
        };

        if (editingEntry) {
          await axios.put(`${API}/bookings/${editingEntry.booking_id}`, bookingData, { withCredentials: true });
          toast.success("Booking updated successfully");
        } else {
          await axios.post(`${API}/bookings`, bookingData, { withCredentials: true });
          toast.success("Booking created successfully");
        }
      } else {
        if (!turfId || !expenseAmount || !expenseDescription) {
          toast.error("Please fill in all fields");
          setLoading(false);
          return;
        }

        const expenseData = {
          turf_id: turfId,
          date: dateStr,
          amount: parseFloat(expenseAmount),
          description: expenseDescription
        };

        if (editingEntry) {
          await axios.put(`${API}/expenses/${editingEntry.expense_id}`, expenseData, { withCredentials: true });
          toast.success("Expense updated successfully");
        } else {
          await axios.post(`${API}/expenses`, expenseData, { withCredentials: true });
          toast.success("Expense created successfully");
        }
      }

      onSuccess();
      onClose();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to save entry";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 border-b border-stone-200">
            <SheetTitle className="font-heading text-xl font-semibold text-stone-900">
              {editingEntry ? "Edit Entry" : "Add Entry"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {/* Entry Type Toggle */}
            {!editingEntry && (
              <Tabs value={entryType} onValueChange={setEntryType} className="mb-6">
                <TabsList className="grid w-full grid-cols-2 h-12 bg-stone-100 rounded-xl p-1">
                  <TabsTrigger 
                    value="booking" 
                    data-testid="tab-booking"
                    className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold"
                  >
                    Booking
                  </TabsTrigger>
                  <TabsTrigger 
                    value="expense"
                    data-testid="tab-expense"
                    className="rounded-lg data-[state=active]:bg-orange-500 data-[state=active]:text-white font-semibold"
                  >
                    Expense
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Turf Selection */}
              <div>
                <Label className="input-label flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Turf
                </Label>
                <Select value={turfId} onValueChange={setTurfId}>
                  <SelectTrigger className="input-field" data-testid="select-turf">
                    <SelectValue placeholder="Select turf" />
                  </SelectTrigger>
                  <SelectContent>
                    {turfs.map(turf => (
                      <SelectItem key={turf.turf_id} value={turf.turf_id}>{turf.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div>
                <Label className="input-label flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date
                </Label>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full input-field justify-start text-left font-normal"
                      data-testid="select-date"
                    >
                      {format(selectedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        if (date) {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {entryType === "booking" ? (
                <>
                  {/* Time Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="input-label flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Start Time
                      </Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                        <SelectTrigger className="input-field" data-testid="select-start-time">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {TIME_SLOTS.map(slot => (
                            <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="input-label flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        End Time
                      </Label>
                      <Select value={endTime} onValueChange={setEndTime}>
                        <SelectTrigger className="input-field" data-testid="select-end-time">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {availableEndTimes.map(slot => (
                            <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <Label className="input-label flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Customer Name
                    </Label>
                    <Input
                      className="input-field"
                      placeholder="Enter customer name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      data-testid="input-customer-name"
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <Label className="input-label flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </Label>
                    <Input
                      className="input-field"
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      data-testid="input-phone-number"
                    />
                  </div>

                  {/* Price Per Hour */}
                  <div>
                    <Label className="input-label flex items-center gap-2">
                      <span className="text-sm font-bold">₹</span>
                      Price Per Hour (₹)
                    </Label>
                    <Input
                      className="input-field"
                      type="number"
                      placeholder="Enter price per hour"
                      value={pricePerHour}
                      onChange={(e) => setPricePerHour(e.target.value)}
                      min="0"
                      step="0.01"
                      data-testid="input-price-per-hour"
                    />
                  </div>

                  {/* Total Price Preview */}
                  {startTime && endTime && pricePerHour && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-stone-600">Duration</span>
                        <span className="font-semibold">
                          {(() => {
                            const start = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
                            const end = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
                            const hours = (end - start) / 60;
                            return `${hours} hour${hours !== 1 ? 's' : ''}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-orange-200">
                        <span className="text-stone-800 font-semibold">Total Price</span>
                        <span className="text-xl font-bold text-orange-600" data-testid="total-price">
                          ₹{(() => {
                            const start = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
                            const end = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
                            const hours = (end - start) / 60;
                            return (hours * parseFloat(pricePerHour || 0)).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Expense Amount */}
                  <div>
                    <Label className="input-label flex items-center gap-2">
                      <span className="text-sm font-bold">₹</span>
                      Amount (₹)
                    </Label>
                    <Input
                      className="input-field"
                      type="number"
                      placeholder="Enter expense amount"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      min="0"
                      step="0.01"
                      data-testid="input-expense-amount"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="input-label flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Description
                    </Label>
                    <Textarea
                      className="input-field min-h-[100px] resize-none"
                      placeholder="Enter expense description"
                      value={expenseDescription}
                      onChange={(e) => setExpenseDescription(e.target.value)}
                      data-testid="input-expense-description"
                    />
                  </div>
                </>
              )}

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full btn-primary"
                  disabled={loading}
                  data-testid="submit-entry"
                >
                  {loading ? (
                    <div className="spinner" />
                  ) : (
                    editingEntry ? "Update" : "Save"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AddEntrySheet;
