import type { Component } from 'solid-js';
import { createResource, createSignal, Show, For } from 'solid-js';
import { Save, Settings as SettingsIcon, Info, Users, Trash2, Edit2, Key, LogOut } from 'lucide-solid';
import { api, type User } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Dialog from '../components/Dialog';
import { useFeedback } from '../components/Feedback';
import { EmptyState, ResourceError } from '../components/ResourceState';

import { useAuth } from '../lib/auth';

interface SettingField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder?: string;
}

const settingFields: SettingField[] = [
  { key: 'firmware_base_url', label: 'Firmware base URL', type: 'text', placeholder: 'https://acs.example.com' },
];

const Settings: Component = () => {
  const { user, isFullAccess, logout } = useAuth();
  const { confirm, notify } = useFeedback();
  const [settings, { refetch }] = createResource(() => api.getSettings());
  const [formData, setFormData] = createSignal<Record<string, string>>({});
  const [saving, setSaving] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<string | null>(null);
  const [message, setMessage] = createSignal<{ type: 'success' | 'error'; text: string } | null>(null);

  // User management
  const [users, { refetch: refetchUsers }] = createResource(async () => {
    if (!isFullAccess()) return [];
    return api.getUsers();
  });

  const [showUserModal, setShowUserModal] = createSignal(false);
  const [editingUser, setEditingUser] = createSignal<User | null>(null);
  const [userForm, setUserForm] = createSignal({ username: '', password: '', role: 'read' as 'full' | 'read' });

  // Change password
  const [showPasswordModal, setShowPasswordModal] = createSignal(false);
  const [passwordForm, setPasswordForm] = createSignal({ current: '', newPass: '', confirm: '' });

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.updateSettings(formData());
      setMessage({ type: 'success', text: 'Connection and delivery settings saved.' });
      refetch();
      setFormData({});
    } catch (err) {
      notify({ tone: 'error', title: 'Settings were not saved', message: 'The previous connection and delivery configuration remains active. Review the fields and retry.', detail: (err as Error).message, persistent: true });
    } finally {
      setSaving(false);
    }
  };

  const getValue = (key: string) => {
    return formData()[key] ?? settings()?.[key] ?? '';
  };

  const handleCreateUser = async () => {
    if (pendingAction()) return;
    setPendingAction('create-user');
    try {
      await api.createUser(userForm());
      notify({ tone: 'success', title: 'Operator account created', message: userForm().username });
      setShowUserModal(false);
      setUserForm({ username: '', password: '', role: 'read' });
      refetchUsers();
    } catch (error) { notify({ tone: 'error', title: 'Could not create operator', message: 'The operator account was not created. The entered values are preserved.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleUpdateUser = async () => {
    const u = editingUser();
    if (!u || pendingAction()) return;
    setPendingAction('update-user');
    const body: Partial<{ username: string; password: string; role: 'full' | 'read' }> = { username: userForm().username, role: userForm().role };
    if (userForm().password) body.password = userForm().password;
    try {
      await api.updateUser(u.id, body);
      notify({ tone: 'success', title: 'Operator account updated', message: userForm().username });
      setShowUserModal(false);
      setEditingUser(null);
      setUserForm({ username: '', password: '', role: 'read' });
      refetchUsers();
    } catch (error) { notify({ tone: 'error', title: 'Could not update operator', message: 'The existing account remains unchanged. The entered values are preserved.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleDeleteUser = async (id: number) => {
    if (!await confirm({ title: 'Delete operator account?', description: 'The operator will immediately lose access. Existing audit records remain attributed to the account.', confirmLabel: 'Delete operator', tone: 'danger' })) return;
    if (pendingAction()) return;
    setPendingAction(`delete-user-${id}`);
    try { await api.deleteUser(id); notify({ tone: 'success', title: 'Operator account deleted' }); refetchUsers(); }
    catch (error) { notify({ tone: 'error', title: 'Could not delete operator', message: 'The account remains active.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleChangePassword = async () => {
    if (passwordForm().newPass !== passwordForm().confirm) {
      notify({ tone: 'error', title: 'Passwords do not match', message: 'Re-enter the new password and confirmation with identical values.', persistent: true });
      return;
    }
    if (pendingAction()) return;
    setPendingAction('change-password');
    try {
      await api.changePassword(passwordForm().current, passwordForm().newPass);
      setShowPasswordModal(false);
      setPasswordForm({ current: '', newPass: '', confirm: '' });
      logout();
    } catch (error) { notify({ tone: 'error', title: 'Could not change password', message: 'The current password remains valid.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const openEditUser = (u: User) => {
    setEditingUser(u);
    setUserForm({ username: u.username, password: '', role: u.role });
    setShowUserModal(true);
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUserForm({ username: '', password: '', role: 'read' });
    setShowUserModal(true);
  };



  return (
    <div class="space-y-5">
      <PageHeader title="System settings" description="Operator accounts and CWMP defaults.">
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted">
            Logged in as <span class="text-sky-400">{user()?.username}</span> ({user()?.role})
          </span>
          <button onClick={logout} class="btn btn-secondary text-xs py-1.5">
            <LogOut size={12} />
            Logout
          </button>
        </div>
      </PageHeader>

      <Show when={message()}>
        <div role={message()?.type === 'error' ? 'alert' : 'status'} class={`p-3 rounded-md text-sm ${message()?.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
          {message()?.text}
        </div>
      </Show>

      {/* Account Section */}
      <div class="card p-5">
        <h2 class="text-sm font-medium text-secondary mb-4 flex items-center gap-2">
          <Key size={14} />
          Account
        </h2>
        <button onClick={() => setShowPasswordModal(true)} class="btn btn-secondary">
          <Key size={14} />
          Change password
        </button>
      </div>

      {/* User Management - Only for full access */}
      <Show when={isFullAccess()}>
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-medium text-secondary flex items-center gap-2">
              <Users size={14} />
              Operator management
            </h2>
            <button onClick={openCreateUser} class="btn btn-primary text-xs py-1.5">
              <Plus size={12} />
              Add operator
            </button>
          </div>

          <Show when={users.error}><ResourceError title="Operator accounts are unavailable" description="SKYACS could not read the account directory. Retry before changing access." onRetry={() => refetchUsers()} /></Show>
          <Show when={users.loading}><div class="space-y-3"><div class="skeleton h-8 w-full" /><div class="skeleton h-8 w-4/5" /></div></Show>
          <Show when={!users.loading && !users.error && (users()?.length ?? 0) > 0}>
            <div class="overflow-x-auto"><table class="data-table w-full text-sm min-w-[620px]">
              <thead>
                <tr class="border-b border-subtle">
                  <th class="text-left py-2 text-xs text-muted font-medium">Username</th>
                  <th class="text-left py-2 text-xs text-muted font-medium">Role</th>
                  <th class="text-left py-2 text-xs text-muted font-medium">Last Login</th>
                  <th class="text-right py-2 text-xs text-muted font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                <For each={users()}>
                  {(u) => (
                    <tr class="border-b border-subtle/50">
                      <td class="py-2 text-primary">{u.username}</td>
                      <td class="py-2">
                        <span class={`badge ${u.role === 'full' ? 'badge-success' : 'badge-warning'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td class="py-2 text-muted text-xs">
                        {u.last_login ? new Date(u.last_login).toLocaleString('id-ID') : 'Never'}
                      </td>
                      <td class="py-2 text-right">
                        <div class="flex items-center justify-end gap-1">
                          <button onClick={() => openEditUser(u)} class="icon-button" aria-label={`Edit operator ${u.username}`} disabled={pendingAction() !== null}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteUser(u.id)} class="icon-button" aria-label={`Delete operator ${u.username}`} disabled={pendingAction() !== null}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table></div>
          </Show>
          <Show when={!users.loading && !users.error && (users()?.length ?? 0) === 0}><EmptyState compact title="No additional operators exist" description="Create a named operator account instead of sharing administrative credentials." action={<button type="button" class="btn btn-primary" onClick={openCreateUser}>Add operator</button>} /></Show>
        </div>



      {/* Delivery and connection request settings */}
      <div class="card p-5">
        <h2 class="text-sm font-medium text-secondary mb-4 flex items-center gap-2">
          <SettingsIcon size={14} />
          Delivery & Connection Request
        </h2>
        <p class="text-muted text-xs mb-4">
          Firmware delivery endpoint and credentials used when SKYACS contacts a CPE.
        </p>

        <Show when={settings.error}><ResourceError title="Connection settings are unavailable" description="SKYACS could not read the current firmware and connection-request configuration. Retry before changing deployment settings." onRetry={() => refetch()} /></Show>
        <Show when={!settings.loading && !settings.error} fallback={settings.loading ?
          <div class="space-y-4">
            <div class="skeleton h-10 w-full" />
            <div class="skeleton h-10 w-full" />
            <div class="skeleton h-10 w-full" />
          </div> : undefined
        }>
          <div class="space-y-4">
            <For each={settingFields}>
              {(field) => (
                <div>
                  <label for={`setting-${field.key}`} class="block text-xs text-muted mb-1.5">
                    {field.label}
                  </label>
                  <input
                    id={`setting-${field.key}`}
                    type={field.type}
                    value={getValue(field.key)}
                    onInput={(e) => handleChange(field.key, e.currentTarget.value)}
                    placeholder={field.placeholder}
                    class="input"
                    disabled={!isFullAccess()}
                  />
                </div>
              )}
            </For>

            {/* Connection Request Credentials Section */}
            <div class="pt-4 border-t border-subtle">
              <div class="flex items-center justify-between mb-3">
                <div>
                  <span class="block text-xs text-muted">Connection-request credential mode</span>
                  <p class="text-xs text-muted mt-0.5">Choose how SKYACS authenticates outbound connection requests to each CPE.</p>
                </div>
                <button
                  onClick={() => handleChange('use_auto_conn_credentials', getValue('use_auto_conn_credentials') === 'true' ? 'false' : 'true')}
                  class={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    getValue('use_auto_conn_credentials') === 'true'
                      ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      : 'bg-zinc-700 text-secondary border border-zinc-600'
                  }`}
                  disabled={!isFullAccess()}
                  aria-pressed={getValue('use_auto_conn_credentials') === 'true'}
                >
                  {getValue('use_auto_conn_credentials') === 'true' ? 'Auto (Serial Number)' : 'Custom'}
                </button>
              </div>

              <Show when={getValue('use_auto_conn_credentials') !== 'true'}>
                <div class="space-y-3 pt-3 border-t border-subtle">
                  <div>
                    <label for="connection-request-username" class="block text-xs text-muted mb-1.5">Connection-request username</label>
                    <input
                      id="connection-request-username"
                      type="text"
                      value={getValue('connection_request_username')}
                      onInput={(e) => handleChange('connection_request_username', e.currentTarget.value)}
                      placeholder="admin"
                      class="input"
                      disabled={!isFullAccess()}
                    />
                  </div>
                  <div>
                    <label for="connection-request-password" class="block text-xs text-muted mb-1.5">Connection-request password</label>
                    <input
                      id="connection-request-password"
                      type="password"
                      value={getValue('connection_request_password')}
                      onInput={(e) => handleChange('connection_request_password', e.currentTarget.value)}
                      placeholder="Optional"
                      class="input"
                      disabled={!isFullAccess()}
                    />
                  </div>
                </div>
              </Show>

              <Show when={getValue('use_auto_conn_credentials') === 'true'}>
                <div class="space-y-3 pt-3 border-t border-subtle">
                  <div>
                    <label for="connection-request-secret" class="block text-xs text-muted mb-1.5">Connection-request master secret</label>
                    <input
                      id="connection-request-secret"
                      type="password"
                      value={getValue('connection_request_password')}
                      onInput={(e) => handleChange('connection_request_password', e.currentTarget.value)}
                      placeholder="Minimum 16 characters"
                      class="input"
                      disabled={!isFullAccess()}
                    />
                  </div>
                  <div class="p-3 bg-sky-500/10 border border-sky-500/20 text-xs text-sky-400">
                    <p><strong>Username:</strong> CPE serial number</p>
                    <p><strong>Password:</strong> unique HMAC-SHA256 value derived for each CPE</p>
                  </div>
                </div>
              </Show>
            </div>
          </div>

          <div class="mt-6 pt-4 border-t border-subtle">
            <Show when={isFullAccess()}><button
              onClick={handleSave}
              disabled={saving()}
              class="btn btn-primary"
            >
              <Save size={14} />
              {saving() ? 'Saving settings…' : 'Save connection settings'}
            </button></Show>
          </div>
        </Show>
      </div>

      <div class="card p-5">
        <h2 class="text-sm font-medium text-secondary mb-4 flex items-center gap-2">
          <Info size={14} />
          CPE Configuration Guide
        </h2>
        <div class="text-muted text-xs space-y-2">
          <p>To connect a CPE to SKYACS:</p>
          <ol class="list-decimal list-inside space-y-1 ml-2">
            <li>Sign in to the CPE management interface.</li>
            <li>Open its TR-069 or CWMP settings.</li>
				<li>Set the ACS URL to the published CWMP endpoint, for example <code class="bg-elevated px-2 py-0.5 rounded text-sky-400">https://cwmp.example.com/</code>.</li>
				<li>Configure <code>CWMP_USERNAME</code> and <code>CWMP_PASSWORD</code> when endpoint authentication is enabled.</li>
            <li>Save the configuration and verify that an Inform reaches SKYACS.</li>
          </ol>
        </div>
      </div>

      {/* User Modal */}
      <Show when={showUserModal()}>
        <Dialog title={editingUser() ? 'Edit operator' : 'Add operator'} description="Operator roles determine access to configuration and destructive CPE actions." size="small" onClose={() => { if (!pendingAction()) setShowUserModal(false); }}>
            <form class="space-y-4" onSubmit={(event) => { event.preventDefault(); void (editingUser() ? handleUpdateUser() : handleCreateUser()); }}>
              <div>
                <label for="operator-username" class="block text-xs text-muted mb-1.5">Username</label>
                <input
                  id="operator-username"
                  type="text"
                  value={userForm().username}
                  onInput={(e) => setUserForm(f => ({ ...f, username: e.currentTarget.value }))}
                  class="input w-full"
                  placeholder="Username"
                  required
                  maxlength={64}
                />
              </div>
              <div>
                <label for="operator-password" class="block text-xs text-muted mb-1.5">
                  Password {editingUser() && '(leave blank to preserve the current password)'}
                </label>
                <input
                  id="operator-password"
                  type="password"
                  value={userForm().password}
                  onInput={(e) => setUserForm(f => ({ ...f, password: e.currentTarget.value }))}
                  class="input w-full"
                  placeholder="Password"
                  minlength={12}
                  required={!editingUser()}
                />
              </div>
              <div>
                <label for="operator-role" class="block text-xs text-muted mb-1.5">Role</label>
                <select
                  id="operator-role"
                  value={userForm().role}
                  onChange={(e) => setUserForm(f => ({ ...f, role: e.currentTarget.value as 'full' | 'read' }))}
                  class="input w-full"
                >
                  <option value="read">Read Only</option>
                  <option value="full">Full Access</option>
                </select>
              </div>
              <div class="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowUserModal(false)} class="btn btn-secondary flex-1" disabled={pendingAction() !== null}>
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary flex-1" disabled={pendingAction() !== null}>
                  {pendingAction() ? 'Saving operator…' : editingUser() ? 'Update operator' : 'Add operator'}
                </button>
              </div>
            </form>
        </Dialog>
      </Show>

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
                  {pendingAction() === 'change-password' ? 'Changing password…' : 'Change password'}
                </button>
              </div>
            </form>
        </Dialog>
      </Show>




    </div>
  );
};

export default Settings;
