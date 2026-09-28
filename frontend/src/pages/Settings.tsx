import type { Component } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { Key, LogOut } from 'lucide-solid';
import { api } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Dialog from '../components/Dialog';
import { useFeedback } from '../components/Feedback';
import { useAuth } from '../lib/auth';

const Settings: Component = () => {
  const { user, isFullAccess, logout } = useAuth();
  const { notify } = useFeedback();
  const [pendingAction, setPendingAction] = createSignal<string | null>(null);

  // Change password
  const [showPasswordModal, setShowPasswordModal] = createSignal(false);
  const [passwordForm, setPasswordForm] = createSignal({ current: '', newPass: '', confirm: '' });

  const handleChangePassword = async () => {
    if (passwordForm().newPass !== passwordForm().confirm) {
      notify({ tone: 'error', title: 'Passwords do not match', message: 'The new password and confirmation are different. The current password is unchanged.', persistent: true });
      return;
    }
    if (pendingAction()) return;
    setPendingAction('change-password');
    try {
      await api.changePassword(passwordForm().current, passwordForm().newPass);
      notify({ tone: 'success', title: 'Password changed', message: 'Sign in again with the new password.' });
      setShowPasswordModal(false);
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      logout();
    } catch (error) {
      notify({ tone: 'error', title: 'Could not change password', message: 'The current password remains active. Check the current password and try again.', detail: (error as Error).message, persistent: true });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div class="space-y-5">
      <PageHeader title="System Settings" description="Account, operator access, and CWMP connection configuration." />

      {/* Account Section */}
      <div class="card p-5">
        <h2 class="text-sm font-medium text-secondary mb-4">Account</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-xs text-muted mb-1.5">Username</label>
            <div class="text-sm text-primary">{user()?.username}</div>
          </div>
          <div>
            <label class="block text-xs text-muted mb-1.5">Role</label>
            <span class={`badge ${isFullAccess() ? 'badge-success' : 'badge-warning'}`}>
              {isFullAccess() ? 'Full Access' : 'Read Only'}
            </span>
          </div>
          <div class="flex items-center gap-3 pt-2">
            <button
              onClick={() => setShowPasswordModal(true)}
              class="btn btn-secondary text-xs"
              disabled={pendingAction() !== null}
            >
              <Key size={12} />
              Change password
            </button>
            <button
              onClick={logout}
              class="btn btn-ghost text-xs text-red-400"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Password Modal */}
      <Show when={showPasswordModal()}>
        <Dialog title="Change operator password" description="Changing the password ends the current session and requires a new sign-in." size="small" onClose={() => { if (!pendingAction()) setShowPasswordModal(false); }}>
            <form class="space-y-4" onSubmit={(event) => { event.preventDefault(); void handleChangePassword(); }}>
              <div>
                <label for="current-password" class="block text-xs text-muted mb-1.5">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  value={passwordForm().current}
                  onInput={(e) => setPasswordForm(f => ({ ...f, current: e.currentTarget.value }))}
                  class="input w-full"
                  minlength={12}
                  required
                />
              </div>
              <div>
                <label for="new-password" class="block text-xs text-muted mb-1.5">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={passwordForm().newPass}
                  onInput={(e) => setPasswordForm(f => ({ ...f, newPass: e.currentTarget.value }))}
                  class="input w-full"
                  minlength={12}
                  required
                />
              </div>
              <div>
                <label for="confirm-password" class="block text-xs text-muted mb-1.5">Confirm new password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={passwordForm().confirm}
                  onInput={(e) => setPasswordForm(f => ({ ...f, confirm: e.currentTarget.value }))}
                  class="input w-full"
                  minlength={12}
                  required
                />
              </div>
              <div class="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} class="btn btn-secondary flex-1" disabled={pendingAction() !== null}>
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary flex-1" disabled={pendingAction() !== null}>
                  {pendingAction() === 'change-password' ? 'Changing password\u2026' : 'Change password'}
                </button>
              </div>
            </form>
        </Dialog>
      </Show>
    </div>
  );
};

export default Settings;
