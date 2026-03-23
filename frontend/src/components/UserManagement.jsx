import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { API } from "@/App";
import { Users, Plus, Trash2, Mail, Shield, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";

const UserManagement = ({ open, onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [addingUser, setAddingUser] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/users/authorized`, { withCredentials: true });
      setUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load authorized users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open, fetchUsers]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (!newEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    if (!newEmail.includes("@") || !newEmail.includes(".")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setAddingUser(true);
    try {
      await axios.post(`${API}/users/authorized`, { email: newEmail }, { withCredentials: true });
      toast.success("User authorized successfully");
      setNewEmail("");
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to add user";
      toast.error(message);
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (email) => {
    try {
      await axios.delete(`${API}/users/authorized/${encodeURIComponent(email)}`, { withCredentials: true });
      toast.success("User removed successfully");
      fetchUsers();
    } catch (error) {
      const message = error.response?.data?.detail || "Failed to remove user";
      toast.error(message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 border-b border-stone-200 flex-shrink-0">
            <SheetTitle className="font-heading text-xl font-semibold text-stone-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-500" />
              User Management
            </SheetTitle>
            <p className="text-sm text-stone-500 mt-1">
              Manage who can access the app
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 pb-32">
            {/* Add User Form */}
            <form onSubmit={handleAddUser} className="mb-6">
              <Label className="input-label flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Add Authorized User
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  className="input-field flex-1"
                  placeholder="Enter email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  data-testid="input-new-user-email"
                />
                <Button
                  type="submit"
                  className="btn-primary h-12 px-4"
                  disabled={addingUser}
                  data-testid="add-user-btn"
                >
                  {addingUser ? <div className="spinner" /> : <Plus className="w-5 h-5" />}
                </Button>
              </div>
            </form>

            {/* User List */}
            <div>
              <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
                Authorized Users ({users.length})
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                  <p className="text-stone-500">No authorized users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <div
                      key={user.email}
                      data-testid={`user-item-${user.email}`}
                      className="card-surface p-4 flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <Mail className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-stone-800 truncate">{user.email}</p>
                            <p className="text-xs text-stone-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Added {user.added_by === "system" ? "automatically" : `by ${user.added_by}`}
                              {user.added_at && (
                                <span>• {format(new Date(user.added_at), "MMM d, yyyy")}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-stone-400 hover:text-red-600 flex-shrink-0"
                            data-testid={`remove-user-${user.email}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove User Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove access for <strong>{user.email}</strong>?
                              They will be logged out immediately and won't be able to access the app.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveUser(user.email)}
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Remove Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
              <h4 className="font-semibold text-orange-800 text-sm mb-2">About Access Control</h4>
              <ul className="text-xs text-orange-700 space-y-1">
                <li>• Only authorized emails can log in to the app</li>
                <li>• Unauthorized users see an "Access Denied" screen</li>
                <li>• You cannot remove yourself or the last user</li>
                <li>• Removed users are logged out immediately</li>
              </ul>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserManagement;
