import type { Component } from 'solid-js';
import { createSignal, createResource, createMemo, Show, For } from 'solid-js';
import { Key, LogOut, Plus, Edit, Trash2, Save, Activity } from 'lucide-solid';
import { api, type MetricDefinition } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Dialog from '../components/Dialog';
import ColorSwatch from '../components/ColorSwatch';
import { useFeedback } from '../components/Feedback';
import { useAuth } from '../lib/auth';
import ColumnFilter from '../components/ColumnFilter';
import { applyColumnFilters, type ColumnFilterState } from '../lib/filters';

const EMPTY_METRIC: Omit<MetricDefinition, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  device_type_match: '*',
  parameter_name: '',
  unit: '',
  source: 'passive',
  active: true,
  group: '',
  color: '',
  axis: 'left',
  transform: '',
  multiplier: 1,
  unit_scale: '',
};

const Settings: Component = () => {
  const { user, isFullAccess, logout } = useAuth();
  const { notify, confirm } = useFeedback();
  const [pendingAction, setPendingAction] = createSignal<string | null>(null);

  // Change password
  const [showPasswordModal, setShowPasswordModal] = createSignal(false);
  const [passwordForm, setPasswordForm] = createSignal({ current: '', newPass: '', confirm: '' });

  // Metrics CRUD
  const [metrics, { refetch: refetchMetrics }] = createResource(api.getMetricDefinitions);
  const [editingMetric, setEditingMetric] = createSignal<MetricDefinition | null>(null);
  const [showMetricModal, setShowMetricModal] = createSignal(false);
  const [metricForm, setMetricForm] = createSignal<Omit<MetricDefinition, 'id' | 'created_at' | 'updated_at'>>(EMPTY_METRIC);
  const [columnFilters, setColumnFilters] = createSignal<Record<string, ColumnFilterState>>({});

  const getFilterValue = (def: MetricDefinition, colId: string): string => {
    switch (colId) {
      case 'name': return def.name || '';
      case 'parameter_name': return def.parameter_name || '';
      case 'device_type_match': return def.device_type_match || '';
      case 'source': return def.source || '';
      case 'unit': return def.unit || '';
      case 'group': return def.group || '';
      case 'active': return def.active ? 'Yes' : 'No';
      default: return '';
    }
  };

  const filteredMetrics = createMemo(() => {
    const all = metrics() || [];
    return applyColumnFilters(all, columnFilters(), getFilterValue);
  });

  const openCreateMetric = () => {
    setEditingMetric(null);
    setMetricForm(EMPTY_METRIC);
    setShowMetricModal(true);
  };

  const openEditMetric = (def: MetricDefinition) => {
    setEditingMetric(def);
    setMetricForm({
      name: def.name,
      description: def.description,
      device_type_match: def.device_type_match,
      parameter_name: def.parameter_name,
      unit: def.unit,
      source: def.source,
      active: def.active,
      group: def.group,
      color: def.color,
      axis: def.axis,
      transform: def.transform,
      multiplier: def.multiplier,
      unit_scale: def.unit_scale,
    });
    setShowMetricModal(true);
  };

  const handleSaveMetric = async () => {
    const form = metricForm();
    if (!form.name.trim() || !form.parameter_name.trim()) {
      notify({ tone: 'error', title: 'Missing fields', message: 'Name and parameter name are required.' });
      return;
    }
    setPendingAction('save-metric');
    try {
      if (editingMetric()) {
        await api.updateMetricDefinition(editingMetric()!.id, form);
        notify({ tone: 'success', title: 'Metric updated', message: `"${form.name}" has been updated.` });
      } else {
        await api.createMetricDefinition(form);
        notify({ tone: 'success', title: 'Metric created', message: `"${form.name}" is now active.` });
      }
      setShowMetricModal(false);
      refetchMetrics();
    } catch (err) {
      notify({ tone: 'error', title: 'Metric save failed', message: (err as Error).message, persistent: true });
    } finally {
      setPendingAction(null);
    }
  };

  const handleDeleteMetric = async (def: MetricDefinition) => {
    if (!await confirm({ title: `Delete metric "${def.name}"?`, description: 'Historical samples remain but will no longer be collected.', confirmLabel: 'Delete metric', tone: 'danger' })) return;
    setPendingAction(`delete-metric-${def.id}`);
    try {
      await api.deleteMetricDefinition(def.id);
      notify({ tone: 'success', title: 'Metric deleted', message: `"${def.name}" has been removed.` });
      refetchMetrics();
    } catch (err) {
      notify({ tone: 'error', title: 'Delete failed', message: (err as Error).message, persistent: true });
    } finally {
      setPendingAction(null);
    }
  };

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

      {/* Metrics Section */}
      <div class="card p-5">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-sm font-medium text-secondary flex items-center gap-2">
            <Activity size={14} />
            Metric Definitions
          </h2>
          <Show when={isFullAccess()}>
            <button onClick={openCreateMetric} class="btn btn-primary text-xs">
              <Plus size={12} />
              Add metric
            </button>
          </Show>
        </div>
        <Show when={metrics.loading}>
          <div class="skeleton h-16 w-full" />
        </Show>
        <Show when={!metrics.loading && (metrics() || []).length === 0}>
          <p class="text-sm text-muted">No metric definitions. Add a metric to start collecting time-series data from CPEs.</p>
        </Show>
        <Show when={!metrics.loading && (metrics() || []).length > 0}>
          <div class="overflow-x-auto">
            <table class="data-table w-full text-sm">
              <thead class="sticky top-0 bg-base z-10">
                <tr class="border-b-2 border-subtle bg-base">
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Name
                      <ColumnFilter columnId="name" label="Name" active={columnFilters()['name'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['name'] = s; else delete n['name']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Parameter
                      <ColumnFilter columnId="parameter_name" label="Parameter" active={columnFilters()['parameter_name'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['parameter_name'] = s; else delete n['parameter_name']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Device Match
                      <ColumnFilter columnId="device_type_match" label="Device Match" active={columnFilters()['device_type_match'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['device_type_match'] = s; else delete n['device_type_match']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Source
                      <ColumnFilter columnId="source" label="Source" active={columnFilters()['source'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['source'] = s; else delete n['source']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Unit
                      <ColumnFilter columnId="unit" label="Unit" active={columnFilters()['unit'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['unit'] = s; else delete n['unit']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Group
                      <ColumnFilter columnId="group" label="Group" active={columnFilters()['group'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['group'] = s; else delete n['group']; return n; }); }} />
                    </div>
                  </th>
                  <th class="text-center px-3 py-2.5 font-semibold text-primary">
                    <div class="flex items-center gap-1.5">Active
                      <ColumnFilter columnId="active" label="Active" active={columnFilters()['active'] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n['active'] = s; else delete n['active']; return n; }); }} />
                    </div>
                  </th>
                  <Show when={isFullAccess()}>
                    <th class="text-right px-3 py-2.5 font-semibold text-primary"></th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={filteredMetrics()}>
                  {(def) => (
                    <tr class="border-t border-subtle hover:bg-elevated/30 transition-colors">
                      <td class="px-3 py-2.5 text-primary font-medium">
                        {def.name}
                        <Show when={def.description}>
                          <div class="text-[10px] text-muted mt-0.5">{def.description}</div>
                        </Show>
                      </td>
                      <td class="px-3 py-2.5 text-secondary font-mono text-xs">{def.parameter_name}</td>
                      <td class="px-3 py-2.5 text-secondary font-mono text-xs">{def.device_type_match}</td>
                      <td class="px-3 py-2.5">
                        <span class={`badge ${def.source === 'active' ? 'badge-warning' : def.source === 'universal' ? 'badge-success' : ''}`}>{def.source}</span>
                      </td>
                      <td class="px-3 py-2.5 text-secondary">{def.unit || '-'}</td>
                      <td class="px-3 py-2.5 text-secondary">
                        <div class="flex items-center gap-1.5">
                          <span class="w-2.5 h-2.5 rounded-[2px] inline-block" style={{ background: def.color || '#475569' }} />
                          <span class="text-xs">{def.group || '-'}</span>
                        </div>
                      </td>
                      <td class="px-3 py-2.5 text-center">
                        <span class={`badge ${def.active ? 'badge-success' : 'badge-error'}`}>{def.active ? 'Yes' : 'No'}</span>
                      </td>
                      <Show when={isFullAccess()}>
                        <td class="px-3 py-2.5 text-right">
                          <div class="flex gap-1 justify-end">
                            <button onClick={() => openEditMetric(def)} class="icon-button" aria-label={`Edit ${def.name}`}>
                              <Edit size={13} />
                            </button>
                            <button onClick={() => void handleDeleteMetric(def)} disabled={pendingAction() === `delete-metric-${def.id}`} class="icon-button hover:text-rose-400" aria-label={`Delete ${def.name}`}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </Show>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>
      </div>

      {/* Metric Modal */}
      <Show when={showMetricModal()}>
        <Dialog
          title={editingMetric() ? `Edit metric: ${editingMetric()!.name}` : 'New metric definition'}
          description="Defines a CWMP parameter to collect as a time-series metric. Device match uses glob patterns (e.g. 'Huawei/*'). Source: passive = from Inform, active = polled via GPV, universal = both."
          size="large"
          onClose={() => setShowMetricModal(false)}
          actions={
            <>
              <button onClick={() => setShowMetricModal(false)} class="btn btn-secondary">Cancel</button>
              <button onClick={() => void handleSaveMetric()} disabled={pendingAction() === 'save-metric'} class="btn btn-primary">
                <Save size={14} />
                {pendingAction() === 'save-metric' ? 'Saving…' : 'Save metric'}
              </button>
            </>
          }
        >
          <div class="space-y-4">
            <div>
              <label for="metric-name" class="block text-xs text-muted mb-1.5">Name</label>
              <input id="metric-name" type="text" value={metricForm().name} onInput={(e) => setMetricForm(f => ({ ...f, name: e.currentTarget.value }))} class="input w-full" placeholder="e.g. CPU Usage" required />
            </div>
            <div>
              <label for="metric-description" class="block text-xs text-muted mb-1.5">Description</label>
              <input id="metric-description" type="text" value={metricForm().description} onInput={(e) => setMetricForm(f => ({ ...f, description: e.currentTarget.value }))} class="input w-full" placeholder="Optional description" />
            </div>
            <div>
              <label for="metric-param" class="block text-xs text-muted mb-1.5">CWMP Parameter Name</label>
              <input id="metric-param" type="text" value={metricForm().parameter_name} onInput={(e) => setMetricForm(f => ({ ...f, parameter_name: e.currentTarget.value }))} class="input w-full font-mono text-xs" placeholder="e.g. InternetGatewayDevice.DeviceInfo.X_HW_CPUUsage" required />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="metric-device-match" class="block text-xs text-muted mb-1.5">Device Type Match</label>
                <input id="metric-device-match" type="text" value={metricForm().device_type_match} onInput={(e) => setMetricForm(f => ({ ...f, device_type_match: e.currentTarget.value }))} class="input w-full font-mono text-xs" placeholder="* (all devices)" />
              </div>
              <div>
                <label for="metric-unit" class="block text-xs text-muted mb-1.5">Unit</label>
                <input id="metric-unit" type="text" value={metricForm().unit} onInput={(e) => setMetricForm(f => ({ ...f, unit: e.currentTarget.value }))} class="input w-full" placeholder="e.g. %, °C, dBm" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="metric-source" class="block text-xs text-muted mb-1.5">Collection Source</label>
                <select id="metric-source" value={metricForm().source} onChange={(e) => setMetricForm(f => ({ ...f, source: e.currentTarget.value as 'passive' | 'active' | 'universal' }))} class="input w-full">
                  <option value="passive">Passive (from Inform)</option>
                  <option value="active">Active (polled via GPV)</option>
                  <option value="universal">Universal (both)</option>
                </select>
              </div>
              <div>
                <label for="metric-active" class="block text-xs text-muted mb-1.5">Active</label>
                <select id="metric-active" value={metricForm().active ? 'true' : 'false'} onChange={(e) => setMetricForm(f => ({ ...f, active: e.currentTarget.value === 'true' }))} class="input w-full">
                  <option value="true">Yes — collect this metric</option>
                  <option value="false">No — paused</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="metric-group" class="block text-xs text-muted mb-1.5">Chart Group</label>
                <input id="metric-group" type="text" value={metricForm().group} onInput={(e) => setMetricForm(f => ({ ...f, group: e.currentTarget.value }))} class="input w-full" placeholder="e.g. throughput (optional)" />
              </div>
              <div>
                <label for="metric-axis" class="block text-xs text-muted mb-1.5">Y-Axis</label>
                <select id="metric-axis" value={metricForm().axis} onChange={(e) => setMetricForm(f => ({ ...f, axis: e.currentTarget.value as 'left' | 'right' }))} class="input w-full">
                  <option value="left">Left (default)</option>
                  <option value="right">Right (secondary)</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs text-muted mb-1.5">Line Color</label>
              <ColorSwatch value={metricForm().color} onChange={(c) => setMetricForm(f => ({ ...f, color: c }))} />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="metric-transform" class="block text-xs text-muted mb-1.5">Transform</label>
                <select id="metric-transform" value={metricForm().transform} onChange={(e) => setMetricForm(f => ({ ...f, transform: e.currentTarget.value }))} class="input w-full">
                  <option value="">None (raw value)</option>
                  <option value="rate">Rate (delta / time)</option>
                </select>
              </div>
              <div>
                <label for="metric-multiplier" class="block text-xs text-muted mb-1.5">Multiplier</label>
                <input id="metric-multiplier" type="number" min="0" step="any" value={metricForm().multiplier} onInput={(e) => setMetricForm(f => ({ ...f, multiplier: parseFloat(e.currentTarget.value) || 0 }))} placeholder="1" class="input w-full" />
              </div>
              <div>
                <label for="metric-unit-scale" class="block text-xs text-muted mb-1.5">Unit Scale</label>
                <select id="metric-unit-scale" value={metricForm().unit_scale} onChange={(e) => setMetricForm(f => ({ ...f, unit_scale: e.currentTarget.value }))} class="input w-full">
                  <option value="">None (raw)</option>
                  <option value="auto">Auto (K/M/G/T)</option>
                  <option value="bytes">Bytes (KB/MB/GB/TB)</option>
                  <option value="bits">Bits (Kb/Mb/Gb/Tb)</option>
                </select>
              </div>
            </div>
          </div>
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
