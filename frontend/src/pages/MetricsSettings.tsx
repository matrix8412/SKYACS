import type { Component } from 'solid-js';
import { createSignal, createResource, Show, For } from 'solid-js';
import { Plus, Edit, Trash2, Activity } from 'lucide-solid';
import { api, type MetricDefinition } from '../lib/api';
import PageHeader from '../components/PageHeader';
import Dialog from '../components/Dialog';
import { useFeedback } from '../components/Feedback';
import { useAuth } from '../lib/auth';

const EMPTY_METRIC: Omit<MetricDefinition, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  device_type_match: '*',
  parameter_name: '',
  unit: '',
  source: 'passive',
  active: true,
};

const MetricsSettings: Component = () => {
  const { isFullAccess } = useAuth();
  const { notify, confirm } = useFeedback();
  const [pendingAction, setPendingAction] = createSignal<string | null>(null);

  const [metrics, { refetch: refetchMetrics }] = createResource(api.getMetricDefinitions);
  const [editingMetric, setEditingMetric] = createSignal<MetricDefinition | null>(null);
  const [showMetricModal, setShowMetricModal] = createSignal(false);
  const [metricForm, setMetricForm] = createSignal<Omit<MetricDefinition, 'id' | 'created_at' | 'updated_at'>>(EMPTY_METRIC);

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
  return (
    <div class="space-y-5">
      <PageHeader title="Monitored Metrics" description="Define which CPE parameters to collect as time-series data." />

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
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">Name</th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">Parameter</th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">Device Match</th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">Source</th>
                  <th class="text-left px-3 py-2.5 font-semibold text-primary">Unit</th>
                  <th class="text-center px-3 py-2.5 font-semibold text-primary">Active</th>
                  <Show when={isFullAccess()}>
                    <th class="text-right px-3 py-2.5 font-semibold text-primary"></th>
                  </Show>
                </tr>
              </thead>
              <tbody>
                <For each={metrics() || []}>
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
                      <td class="px-3 py-2.5 text-secondary">{def.unit || '—'}</td>
                      <td class="px-3 py-2.5 text-center">
                        <span class={`badge ${def.active ? 'badge-success' : 'badge-muted'}`}>{def.active ? 'Yes' : 'No'}</span>
                      </td>
                      <Show when={isFullAccess()}>
                        <td class="px-3 py-2.5 text-right">
                          <div class="flex justify-end gap-1">
                            <button onClick={() => openEditMetric(def)} class="btn btn-ghost text-xs" title="Edit">
                              <Edit size={12} />
                            </button>
                            <button onClick={() => handleDeleteMetric(def)} class="btn btn-ghost text-xs text-red-400" title="Delete">
                              <Trash2 size={12} />
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
          title={editingMetric() ? 'Edit metric' : 'Add metric'}
          description="Define a CWMP parameter to collect as a time-series metric."
          onClose={() => { if (!pendingAction()) setShowMetricModal(false); }}
        >
          <div class="space-y-4">
            <div>
              <label for="metric-name" class="block text-xs text-muted mb-1.5">Name</label>
              <input id="metric-name" type="text" value={metricForm().name} onInput={(e) => setMetricForm(f => ({ ...f, name: e.currentTarget.value }))} placeholder="e.g. Uptime, CPU Load" class="input w-full" />
            </div>
            <div>
              <label for="metric-description" class="block text-xs text-muted mb-1.5">Description (optional)</label>
              <input id="metric-description" type="text" value={metricForm().description} onInput={(e) => setMetricForm(f => ({ ...f, description: e.currentTarget.value }))} placeholder="Short description" class="input w-full" />
            </div>
            <div>
              <label for="metric-parameter" class="block text-xs text-muted mb-1.5">CWMP Parameter Path</label>
              <input id="metric-parameter" type="text" value={metricForm().parameter_name} onInput={(e) => setMetricForm(f => ({ ...f, parameter_name: e.currentTarget.value }))} placeholder="e.g. Device.DeviceInfo.UpTime" class="input w-full font-mono text-xs" />
            </div>
            <div>
              <label for="metric-device-match" class="block text-xs text-muted mb-1.5">Device Type Match (glob)</label>
              <input id="metric-device-match" type="text" value={metricForm().device_type_match} onInput={(e) => setMetricForm(f => ({ ...f, device_type_match: e.currentTarget.value }))} placeholder="* (all) or Zyxel/VMG3625" class="input w-full font-mono text-xs" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="metric-unit" class="block text-xs text-muted mb-1.5">Unit</label>
                <input id="metric-unit" type="text" value={metricForm().unit} onInput={(e) => setMetricForm(f => ({ ...f, unit: e.currentTarget.value }))} placeholder="s, %, MB/s" class="input w-full" />
              </div>
              <div>
                <label for="metric-source" class="block text-xs text-muted mb-1.5">Source</label>
                <select id="metric-source" value={metricForm().source} onChange={(e) => setMetricForm(f => ({ ...f, source: e.currentTarget.value as 'passive' | 'active' | 'universal' }))} class="input w-full">
                  <option value="passive">Passive (from Inform)</option>
                  <option value="active">Active (polled via GPV)</option>
                  <option value="universal">Universal (both)</option>
                </select>
              </div>
            </div>
            <div>
              <label for="metric-active" class="block text-xs text-muted mb-1.5">Active</label>
              <select id="metric-active" value={metricForm().active ? 'true' : 'false'} onChange={(e) => setMetricForm(f => ({ ...f, active: e.currentTarget.value === 'true' }))} class="input w-full">
                <option value="true">Yes — collect this metric</option>
                <option value="false">No — paused</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2 pt-4">
            <button type="button" onClick={() => setShowMetricModal(false)} class="btn btn-secondary flex-1" disabled={pendingAction() !== null}>Cancel</button>
            <button type="button" onClick={handleSaveMetric} class="btn btn-primary flex-1" disabled={pendingAction() !== null}>
              {pendingAction() === 'save-metric' ? 'Saving…' : editingMetric() ? 'Save changes' : 'Create metric'}
            </button>
          </div>
        </Dialog>
      </Show>
    </div>
  );
};

export default MetricsSettings;

