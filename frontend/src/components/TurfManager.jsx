import { useState } from "react";
import axios from "axios";
import { API } from "@/App";
import { Plus, Edit2, Trash2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const TurfManager = ({ open, onClose, turfs, onRefresh }) => {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingTurf, setEditingTurf] = useState(null);
  const [turfName, setTurfName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpenAdd = () => {
    setTurfName("");
    setEditingTurf(null);
    setShowAddDialog(true);
  };

  const handleOpenEdit = (turf) => {
    setTurfName(turf.name);
    setEditingTurf(turf);
    setShowAddDialog(true);
  };

  const handleSave = async () => {
    if (!turfName.trim()) {
      toast.error("Please enter a turf name");
      return;
    }

    setLoading(true);
    try {
      if (editingTurf) {
        await axios.put(`${API}/turfs/${editingTurf.turf_id}`, { name: turfName }, { withCredentials: true });
        toast.success("Turf updated successfully");
      } else {
        await axios.post(`${API}/turfs`, { name: turfName }, { withCredentials: true });
        toast.success("Turf created successfully");
      }
      setShowAddDialog(false);
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save turf");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (turfId) => {
    try {
      await axios.delete(`${API}/turfs/${turfId}`, { withCredentials: true });
      toast.success("Turf deleted successfully");
      onRefresh();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete turf");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <SheetTitle className="font-heading text-xl font-semibold text-stone-900">
                  Manage Turfs
                </SheetTitle>
                <Button
                  data-testid="add-turf-btn"
                  onClick={handleOpenAdd}
                  className="btn-primary h-10 px-4"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4">
              {turfs.length === 0 ? (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">No turfs yet</p>
                  <Button
                    onClick={handleOpenAdd}
                    variant="ghost"
                    className="mt-4 text-orange-600"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add your first turf
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {turfs.map(turf => (
                    <div 
                      key={turf.turf_id}
                      data-testid={`turf-item-${turf.turf_id}`}
                      className="card-surface p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <MapPin className="w-5 h-5 text-orange-600" />
                        </div>
                        <span className="font-medium text-stone-800">{turf.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          data-testid={`edit-turf-${turf.turf_id}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(turf)}
                          className="h-9 w-9 text-stone-500 hover:text-orange-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              data-testid={`delete-turf-${turf.turf_id}`}
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-stone-500 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Turf</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{turf.name}"? This turf cannot be deleted if it has existing bookings.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(turf.turf_id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Add/Edit Turf Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">
              {editingTurf ? "Edit Turf" : "Add New Turf"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label className="input-label">Turf Name</Label>
            <Input
              className="input-field"
              placeholder="Enter turf name"
              value={turfName}
              onChange={(e) => setTurfName(e.target.value)}
              data-testid="input-turf-name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="btn-primary"
              disabled={loading}
              data-testid="save-turf-btn"
            >
              {loading ? <div className="spinner" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TurfManager;
