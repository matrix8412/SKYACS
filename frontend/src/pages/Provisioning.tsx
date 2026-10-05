import { createSignal, createEffect, createMemo, onMount, onCleanup, Show, For, type Component } from 'solid-js';
import { Check, ChevronLeft, ChevronRight, Edit2, GripVertical, MoreVertical, Plus, Settings as SettingsIcon, Settings2, Trash2, X } from 'lucide-solid';
import { api, type ProvisioningRule } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useFeedback } from '../components/Feedback';
import Dialog from '../components/Dialog';
import PageHeader from '../components/PageHeader';
import { EmptyState, ResourceError } from '../components/ResourceState';
import ColumnFilter from '../components/ColumnFilter';
import Pagination from '../components/Pagination';
import { applyColumnFilters, type ColumnFilterState } from '../lib/filters';
import { usePageSize } from '../lib/usePageSize';

interface ProvColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const defaultProvColumns: ProvColumnConfig[] = [
  { id: 'parameter', label: 'CWMP path', visible: true, order: 0 },
  { id: 'value', label: 'Value', visible: true, order: 1 },
  { id: 'manufacturer', label: 'Manufacturer', visible: true, order: 2 },
  { id: 'product_class', label: 'Product Class', visible: true, order: 3 },
  { id: 'tag', label: 'Tag', visible: true, order: 4 },
  { id: 'phase', label: 'Phase', visible: true, order: 5 },
  { id: 'status', label: 'Status', visible: true, order: 6 },
];

const PROV_STORAGE_KEY = 'skyacs-prov-columns';

const Provisioning: Component = () => {
  const { isFullAccess } = useAuth();
  const { notify, confirm } = useFeedback();

  const [provRules, setProvRules] = createSignal<Awaited<ReturnType<typeof api.getProvisioningRules>> | null>(null);
  const [provError, setProvError] = createSignal<Error | null>(null);
  const [pendingAction, setPendingAction] = createSignal<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = createSignal(false);
  const [showSettingsModal, setShowSettingsModal] = createSignal(false);
  const [settingsLoading, setSettingsLoading] = createSignal(false);
  const [settingsSaving, setSettingsSaving] = createSignal(false);
  const [refreshSettings, setRefreshSettings] = createSignal({ overview: '15m', full: '6h' });
  let settingsMenu: HTMLDivElement | undefined;
  const [showProvModal, setShowProvModal] = createSignal(false);
  const [editingProv, setEditingProv] = createSignal<ProvisioningRule | null>(null);
  const emptyProvisioningRule = { parameter_name: '', parameter_value: '', parameter_type: 'string', phase: 'bootstrap', manufacturer: '', product_class: '', product_classes: [] as string[], tag: '', enabled: true, description: '', add_object_path: '', order: 0, condition: '' };
  const [provForm, setProvForm] = createSignal({ ...emptyProvisioningRule });
  const [isAddObjectRule, setIsAddObjectRule] = createSignal(false);

  const provisioningPayload = (form: typeof emptyProvisioningRule) => {
    const base = isAddObjectRule()
      ? { ...form, parameter_name: '', parameter_value: '', parameter_type: 'string', add_object_path: form.parameter_name.trim() }
      : { ...form, add_object_path: '' };
    // If product_classes is populated, clear the legacy single product_class field
    if (base.product_classes.length > 0) {
      base.product_class = '';
    }
    return base;
  };

  // Provisioning column visibility
  const [provColumns, setProvColumns] = createSignal<ProvColumnConfig[]>((() => {
    try {
      const stored = localStorage.getItem(PROV_STORAGE_KEY);
      if (stored) return JSON.parse(stored) as ProvColumnConfig[];
    } catch { /* ignore */ }
    return defaultProvColumns;
  })());
  const [showProvColumnSettings, setShowProvColumnSettings] = createSignal(false);
  const [provDraggedCol, setProvDraggedCol] = createSignal<string | null>(null);
  const [provDraggedRow, setProvDraggedRow] = createSignal<number | null>(null);
  const [columnFilters, setColumnFilters] = createSignal<Record<string, ColumnFilterState>>({});

  const getFilterValue = (rule: ProvisioningRule, colId: string): string => {
    switch (colId) {
      case 'parameter': return rule.add_object_path || rule.parameter_name || '';
      case 'value': return rule.add_object_path ? '' : rule.parameter_value || '';
      case 'manufacturer': return rule.manufacturer || '';
      case 'product_class': return (rule.product_classes && rule.product_classes.length > 0) ? rule.product_classes.join(', ') : (rule.product_class || '');
      case 'tag': return rule.tag || '';
      case 'phase': return rule.phase || '';
      case 'status': return rule.enabled ? 'Active' : 'Disabled';
      default: return '';
    }
  };

  const filteredProvRules = createMemo(() => {
    const all = provRules() ?? [];
    return applyColumnFilters(all, columnFilters(), getFilterValue);
  });
  const [provPage, setProvPage] = createSignal(0);
  const { pageSize, changePageSize } = usePageSize('provisioning', 15);
  const handlePageSizeChange = (size: number) => { changePageSize(size); setProvPage(0); };
  const pagedProvRules = createMemo(() => {
    const all = filteredProvRules();
    const start = provPage() * pageSize();
    return all.slice(start, start + pageSize());
  });
  const provTotalPages = createMemo(() => Math.ceil(filteredProvRules().length / pageSize()));
  const provDragEnabled = createMemo(() => Object.keys(columnFilters()).length === 0);

  onMount(() => {
    loadProvRules();
    const closeMenu = (event: MouseEvent) => {
      if (!settingsMenu?.contains(event.target as Node)) setShowSettingsMenu(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSettingsMenu(false);
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    onCleanup(() => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    });
  });

  const openRefreshSettings = async () => {
    setShowSettingsMenu(false);
    setSettingsLoading(true);
    try {
      const settings = await api.getSettings();
      setRefreshSettings({
        overview: settings.overview_poll_interval || '15m',
        full: settings.full_tree_poll_interval || '6h',
      });
      setShowSettingsModal(true);
    } catch (error) {
      notify({ tone: 'error', title: 'Could not load provisioning settings', detail: (error as Error).message, persistent: true });
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveRefreshSettings = async () => {
    if (settingsSaving()) return;
    setSettingsSaving(true);
    try {
      await api.updateSettings({
        overview_poll_interval: refreshSettings().overview.trim(),
        full_tree_poll_interval: refreshSettings().full.trim(),
      });
      setShowSettingsModal(false);
      notify({ tone: 'success', title: 'Provisioning settings saved' });
    } catch (error) {
      notify({ tone: 'error', title: 'Could not save provisioning settings', detail: (error as Error).message, persistent: true });
    } finally {
      setSettingsSaving(false);
    }
  };

  createEffect(() => {
    const cols = provColumns();
    localStorage.setItem(PROV_STORAGE_KEY, JSON.stringify(cols));
  });

  const visibleProvColumns = () => provColumns().filter(c => c.visible).sort((a, b) => a.order - b.order);

  const toggleProvColumn = (id: string) => {
    setProvColumns(cols => cols.map(c => c.id === id ? { ...c, visible: !c.visible } : c));
  };

  const handleProvDragStart = (e: DragEvent, id: string) => {
    setProvDraggedCol(id);
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleProvDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleProvDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = provDraggedCol();
    setProvDraggedCol(null);
    if (!sourceId || sourceId === targetId) return;
    const cols = provColumns().sort((a, b) => a.order - b.order);
    const sourceIdx = cols.findIndex(c => c.id === sourceId);
    const targetIdx = cols.findIndex(c => c.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const reordered = [...cols];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setProvColumns(reordered.map((c, i) => ({ ...c, order: i })));
  };

  const handleRowDragStart = (e: DragEvent, id: number) => {
    setProvDraggedRow(id);
    e.dataTransfer?.setData('text/plain', String(id));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };

  const handleRowDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  };

  const handleRowDrop = async (e: DragEvent, targetId: number) => {
    e.preventDefault();
    const sourceId = provDraggedRow();
    setProvDraggedRow(null);
    if (!sourceId || sourceId === targetId) return;
    const rules = provRules() ?? [];
    const sourceIdx = rules.findIndex(r => r.id === sourceId);
    const targetIdx = rules.findIndex(r => r.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const reordered = [...rules];
    const [moved] = reordered.splice(sourceIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    setProvRules(reordered.map((r, i) => ({ ...r, order: i })));
    try {
      await api.reorderProvisioningRules(reordered.map(r => r.id));
      notify({ tone: 'success', title: 'Rules reordered' });
    } catch (error) {
      notify({ tone: 'error', title: 'Reorder failed', detail: (error as Error).message, persistent: true });
      refetchProvRules();
    }
  };

  const moveProvColumn = (id: string, direction: -1 | 1) => {
    const cols = provColumns().sort((a, b) => a.order - b.order);
    const idx = cols.findIndex(c => c.id === id);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= cols.length) return;
    const reordered = [...cols];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    setProvColumns(reordered.map((c, i) => ({ ...c, order: i })));
  };

  const loadProvRules = async () => {
    setProvError(null);
    try {
      const rules = await api.getProvisioningRules();
      setProvRules(rules);
    } catch (error) {
      setProvError(error as Error);
    }
  };

  const refetchProvRules = () => { loadProvRules(); };

  // Provisioning handlers
  const handleCreateProv = async () => {
    if (pendingAction()) return;
    const form = provForm();
    if (!form.parameter_name.trim()) { notify({ tone: 'error', title: 'Missing field', message: 'CWMP path is required.' }); return; }
    if (!isAddObjectRule() && !form.parameter_value.trim()) { notify({ tone: 'error', title: 'Missing field', message: 'Parameter value is required for parameter rules.' }); return; }
    setPendingAction('create-provisioning');
    try {
      const payload = provisioningPayload(form);
      await api.createProvisioningRule(payload);
      notify({ tone: 'success', title: 'Provisioning rule created', message: payload.add_object_path || payload.parameter_name });
      setShowProvModal(false);
      setProvForm({ ...emptyProvisioningRule });
      setIsAddObjectRule(false);
      refetchProvRules();
    } catch (error) { notify({ tone: 'error', title: 'Could not create provisioning rule', message: 'No rule was added. The entered values are preserved.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleUpdateProv = async () => {
    const p = editingProv();
    if (!p || pendingAction()) return;
    const form = provForm();
    if (!form.parameter_name.trim()) { notify({ tone: 'error', title: 'Missing field', message: 'CWMP path is required.' }); return; }
    if (!isAddObjectRule() && !form.parameter_value.trim()) { notify({ tone: 'error', title: 'Missing field', message: 'Parameter value is required for parameter rules.' }); return; }
    setPendingAction('update-provisioning');
    try {
      const payload = provisioningPayload(form);
      await api.updateProvisioningRule(p.id, payload);
      notify({ tone: 'success', title: 'Provisioning rule updated', message: payload.add_object_path || payload.parameter_name });
      setShowProvModal(false);
      setEditingProv(null);
      refetchProvRules();
    } catch (error) { notify({ tone: 'error', title: 'Could not update provisioning rule', message: 'The existing rule remains unchanged. The entered values are preserved.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleDeleteProv = async (id: number) => {
    if (!await confirm({ title: 'Delete provisioning rule?', description: 'The rule will no longer run for future BOOTSTRAP sessions. Previously applied device values are not reverted.', confirmLabel: 'Delete rule', tone: 'danger' })) return;
    if (pendingAction()) return;
    setPendingAction(`delete-provisioning-${id}`);
    try { await api.deleteProvisioningRule(id); notify({ tone: 'success', title: 'Provisioning rule deleted' }); refetchProvRules(); }
    catch (error) { notify({ tone: 'error', title: 'Could not delete provisioning rule', message: 'The rule remains active.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const handleToggleProv = async (id: number, enabled: boolean) => {
    if (pendingAction()) return;
    setPendingAction(`toggle-provisioning-${id}`);
    try { await api.toggleProvisioningRule(id, enabled); notify({ tone: 'success', title: `Provisioning rule ${enabled ? 'enabled' : 'disabled'}` }); refetchProvRules(); }
    catch (error) { notify({ tone: 'error', title: 'Could not change rule state', message: 'The previous provisioning state remains active.', detail: (error as Error).message, persistent: true }); }
    finally { setPendingAction(null); }
  };

  const openEditProv = (p: ProvisioningRule) => {
    setEditingProv(p);
    setIsAddObjectRule(Boolean(p.add_object_path));
    setProvForm({ parameter_name: p.add_object_path || p.parameter_name, parameter_value: p.parameter_value, parameter_type: p.parameter_type, phase: p.phase || 'bootstrap', manufacturer: p.manufacturer || '', product_class: p.product_class || '', product_classes: p.product_classes || [], tag: p.tag || '', enabled: p.enabled, description: p.description, add_object_path: p.add_object_path || '', order: p.order, condition: p.condition || '' });
    setShowProvModal(true);
  };

  const openCreateProv = () => {
    setEditingProv(null);
    setIsAddObjectRule(false);
    setProvForm({ ...emptyProvisioningRule });
    setShowProvModal(true);
  };

  return (
    <div class="page">
      <PageHeader
        title="Provisioning"
        description="Controlled CWMP parameters applied automatically to matching CPEs based on trigger phase."
      >
        <div class="relative" ref={settingsMenu}>
          <button type="button" class="icon-button" aria-label="Provisioning menu" aria-haspopup="menu" aria-expanded={showSettingsMenu()} onClick={() => setShowSettingsMenu(value => !value)}>
            <MoreVertical size={18} />
          </button>
          <Show when={showSettingsMenu()}>
            <div class="absolute right-0 top-full z-50 mt-2 min-w-40 rounded border border-subtle bg-elevated p-1 shadow-xl" role="menu">
              <button type="button" role="menuitem" class="w-full rounded px-3 py-2 text-left text-sm text-primary hover:bg-base disabled:opacity-50" disabled={settingsLoading()} onClick={openRefreshSettings}>
                Settings
              </button>
            </div>
          </Show>
        </div>
      </PageHeader>

      <Show when={isFullAccess()}>
        <div class="card p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-medium text-secondary flex items-center gap-2">
                <SettingsIcon size={14} />
                Provisioning Rules
              </h2>
              <p class="text-muted text-xs mt-1">Rules are evaluated in order. The first matching rule wins for a given parameter.</p>
            </div>
            <div class="flex items-center gap-2">
              <button onClick={() => setShowProvColumnSettings(!showProvColumnSettings())}
                class={`btn btn-secondary text-xs py-1.5 ${showProvColumnSettings() ? 'bg-sky-500/20 text-sky-400' : ''}`}
                aria-expanded={showProvColumnSettings()}
                aria-controls="prov-column-settings"
              >
                <Settings2 size={12} />
                Columns
              </button>
              <button onClick={openCreateProv} class="btn btn-primary text-xs py-1.5">
                <Plus size={12} />
                Add rule
              </button>
            </div>
          </div>

          {/* Column Settings Panel */}
          <Show when={showProvColumnSettings()}>
            <div id="prov-column-settings" class="card p-4 mb-4">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-secondary">Manage Columns</h3>
                <button onClick={() => setShowProvColumnSettings(false)} class="icon-button" aria-label="Close column settings">
                  <X size={16} />
                </button>
              </div>
              <div class="flex flex-wrap gap-2">
                <For each={provColumns().sort((a, b) => a.order - b.order)}>
                  {(col) => (
                    <div
                      draggable={true}
                      onDragStart={(e) => handleProvDragStart(e, col.id)}
                      onDragOver={handleProvDragOver}
                      onDrop={(e) => handleProvDrop(e, col.id)}
                      class={`flex items-center gap-2 px-3 py-1.5 bg-elevated cursor-grab active:cursor-grabbing transition-all ${provDraggedCol() === col.id ? 'opacity-50 scale-95' : 'hover:bg-elevated/80'}`}
                    >
                      <GripVertical size={12} class="text-muted" />
                      <button
                        onClick={() => toggleProvColumn(col.id)}
                        class={`icon-button ${col.visible ? 'text-sky-400 border-sky-500' : ''}`}
                        aria-label={`${col.visible ? 'Hide' : 'Show'} ${col.label} column`}
                        aria-pressed={col.visible}
                      >
                        {col.visible && <Check size={10} class="text-white" />}
                      </button>
                      <span class={`text-sm ${col.visible ? 'text-primary' : 'text-muted'}`}>
                        {col.label}
                      </span>
                      <span class="inline-flex ml-auto">
                        <button type="button" class="icon-button" onClick={() => moveProvColumn(col.id, -1)} aria-label={`Move ${col.label} column left`}><ChevronLeft size={12} /></button>
                        <button type="button" class="icon-button" onClick={() => moveProvColumn(col.id, 1)} aria-label={`Move ${col.label} column right`}><ChevronRight size={12} /></button>
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <Show when={provError()}>
            <ResourceError title="Provisioning rules are unavailable" description="The current provisioning policy could not be loaded. Retry before changing a device rollout." onRetry={loadProvRules} />
          </Show>

          <Show when={!provError() && provRules() !== null}>
            <div class="overflow-x-auto table-scroll">
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-subtle">
                    <th class="py-2 pr-2 w-8 text-xs font-medium text-muted uppercase tracking-wide">#</th>
                    <For each={visibleProvColumns()}>
                      {(col) => (
                        <th class="py-2 pr-4 text-xs font-medium text-muted uppercase tracking-wide">
                          <div class="flex items-center gap-1.5">{col.id === 'parameter' ? 'CWMP path' : col.label}
                            <ColumnFilter columnId={col.id} label={col.label} active={columnFilters()[col.id] || null} onApply={(s) => { setColumnFilters((prev) => { const n = { ...prev }; if (s) n[col.id] = s; else delete n[col.id]; return n; }); }} />
                          </div>
                        </th>
                      )}
                    </For>
                    <th class="py-2 text-right text-xs font-medium text-muted uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={pagedProvRules()}>
                    {(p) => (
                      <tr
                        class={`border-b border-subtle/50 hover:bg-elevated/40 transition-colors ${provDraggedRow() === p.id ? 'opacity-50' : ''}`}
                        draggable={provDragEnabled()}
                        onDragStart={(e) => handleRowDragStart(e, p.id)}
                        onDragOver={handleRowDragOver}
                        onDrop={(e) => handleRowDrop(e, p.id)}
                      >
                        <td class="py-2 pr-2 cursor-grab active:cursor-grabbing select-none">
                          <span class="flex items-center gap-1 text-muted">
                            <GripVertical size={12} />
                            <span class="text-xs">{p.order}</span>
                          </span>
                        </td>
                        <Show when={visibleProvColumns().some(c => c.id === 'parameter')}>
                          <td class="py-2 pr-4">
                            <span class="text-secondary text-xs font-mono">{p.add_object_path || p.parameter_name}</span>
                            <Show when={p.add_object_path}>
                              <span class="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 ml-1.5">AddObject</span>
                            </Show>
                            <Show when={p.condition}>
                              <span class="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 ml-1.5">Conditional</span>
                            </Show>
                            <Show when={p.description}>
                              <p class="text-muted text-xs">{p.description}</p>
                            </Show>
                          </td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'value')}>
                          <td class="py-2 text-secondary text-xs font-mono max-w-xs truncate">{p.add_object_path ? '—' : p.parameter_value}</td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'manufacturer')}>
                          <td class="py-2 text-secondary text-xs">{p.manufacturer || '—'}</td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'product_class')}>
                          <td class="py-2 text-secondary text-xs">
                            {(p.product_classes && p.product_classes.length > 0) ? (
                              <span class="flex flex-wrap gap-1">
                                <For each={p.product_classes}>
                                  {(pc) => <span class="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">{pc}</span>}
                                </For>
                              </span>
                            ) : (p.product_class || '—')}
                          </td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'tag')}>
                          <td class="py-2 text-secondary text-xs">{p.tag ? <span class="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">{p.tag}</span> : '—'}</td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'phase')}>
                          <td class="py-2">
                            <span class={`text-xs px-1.5 py-0.5 rounded ${p.phase === 'default' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{p.phase || 'bootstrap'}</span>
                          </td>
                        </Show>
                        <Show when={visibleProvColumns().some(c => c.id === 'status')}>
                          <td class="py-2">
                            <button
                              onClick={() => handleToggleProv(p.id, !p.enabled)}
                              class={`btn ${p.enabled ? 'btn-secondary' : 'btn-danger'}`}
                              aria-pressed={p.enabled}
                              disabled={pendingAction() !== null}
                            >
                              {pendingAction() === `toggle-provisioning-${p.id}` ? 'Updating…' : p.enabled ? 'Active' : 'Disabled'}
                            </button>
                          </td>
                        </Show>
                        <td class="py-2 text-right">
                          <div class="flex items-center justify-end gap-1">
                            <button onClick={() => openEditProv(p)} class="icon-button" aria-label={`Edit provisioning rule ${p.parameter_name}`} disabled={pendingAction() !== null}>
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteProv(p.id)} class="icon-button" aria-label={`Delete provisioning rule ${p.parameter_name}`} disabled={pendingAction() !== null}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class="px-4 py-3">
              <Pagination page={provPage()} totalPages={provTotalPages()} totalItems={filteredProvRules().length} pageSize={pageSize()} onPageChange={setProvPage} storageKey="provisioning" onPageSizeChange={handlePageSizeChange} />
            </div>
          </Show>

          <Show when={!provError() && provRules() !== null && (provRules()?.length ?? 0) === 0}>
            <EmptyState compact title="No provisioning rules exist" description="Add a scoped rule only when a parameter must be applied automatically to matching CPEs." action={<button type="button" class="btn btn-primary" onClick={openCreateProv}>Add provisioning rule</button>} />
          </Show>
        </div>
      </Show>

      {/* Provisioning Modal */}
      <Show when={showSettingsModal()}>
        <Dialog title="Provisioning settings" description="Refresh intervals are checked whenever the CPE sends an Inform." onClose={() => setShowSettingsModal(false)} actions={<>
          <button type="button" class="btn btn-secondary" onClick={() => setShowSettingsModal(false)} disabled={settingsSaving()}>Cancel</button>
          <Show when={isFullAccess()}><button type="submit" form="provisioning-settings-form" class="btn btn-primary" disabled={settingsSaving()}>{settingsSaving() ? 'Saving…' : 'Save settings'}</button></Show>
        </>}>
          <form id="provisioning-settings-form" class="space-y-4" onSubmit={(event) => { event.preventDefault(); void saveRefreshSettings(); }}>
            <div>
              <label for="overview-poll-interval" class="block text-xs text-muted mb-1.5">Overview refresh interval</label>
              <input id="overview-poll-interval" type="text" class="input w-full" value={refreshSettings().overview} onInput={(event) => setRefreshSettings(settings => ({ ...settings, overview: event.currentTarget.value }))} disabled={!isFullAccess()} required />
              <p class="text-xs text-muted mt-1">Use m or h, from 1m to 24h. Example: 15m.</p>
            </div>
            <div>
              <label for="full-tree-poll-interval" class="block text-xs text-muted mb-1.5">Full parameter tree refresh interval</label>
              <input id="full-tree-poll-interval" type="text" class="input w-full" value={refreshSettings().full} onInput={(event) => setRefreshSettings(settings => ({ ...settings, full: event.currentTarget.value }))} disabled={!isFullAccess()} required />
              <p class="text-xs text-muted mt-1">Use m or h, from 15m to 168h. Example: 6h.</p>
            </div>
          </form>
        </Dialog>
      </Show>
      <Show when={showProvModal()}>
        <Dialog
          title={editingProv() ? 'Edit provisioning rule' : 'Add provisioning rule'}
          onClose={() => setShowProvModal(false)}
        >
          <form onSubmit={(e) => { e.preventDefault(); editingProv() ? handleUpdateProv() : handleCreateProv(); }} class="space-y-4">
            <div>
              <label for="provisioning-parameter" class="block text-xs text-muted mb-1.5">{isAddObjectRule() ? 'CWMP object path' : 'CWMP parameter name'}</label>
              <input id="provisioning-parameter" type="text" value={provForm().parameter_name} onInput={(e) => setProvForm(f => ({ ...f, parameter_name: e.currentTarget.value }))} class="input w-full" placeholder={isAddObjectRule() ? 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection' : 'Path to a writable CWMP parameter'} />
            </div>
            <div>
              <label for="provisioning-add-object" class="flex items-center gap-2 text-sm text-secondary">
                <input id="provisioning-add-object" type="checkbox" checked={isAddObjectRule()} onChange={(e) => setIsAddObjectRule(e.currentTarget.checked)} class="rounded" />
                AddObject: create a new object instance
              </label>
              <Show when={isAddObjectRule()}>
                <p class="text-xs text-muted mt-1">The path above identifies the object collection. No parameter value is sent. In later rules, use <code class="text-amber-400">{'{prev}'}</code> for the latest AddObject instance, or <code class="text-amber-400">{'{prev1}'}</code>, <code class="text-amber-400">{'{prev2}'}</code> for the first and second created instances.</p>
              </Show>
            </div>
            <Show when={!isAddObjectRule()}>
              <div>
                <label for="provisioning-value" class="block text-xs text-muted mb-1.5">Parameter value</label>
                <input id="provisioning-value" type="text" value={provForm().parameter_value} onInput={(e) => setProvForm(f => ({ ...f, parameter_value: e.currentTarget.value }))} class="input w-full" placeholder="Enter the parameter value" />
              </div>
            </Show>
            <div>
              <label for="provisioning-order" class="block text-xs text-muted mb-1.5">Order</label>
              <input id="provisioning-order" type="number" min="0" value={provForm().order} onInput={(e) => setProvForm(f => ({ ...f, order: Number(e.currentTarget.value) || 0 }))} class="input w-full" />
              <p class="text-xs text-muted mt-1">Lower values execute first. Use drag-and-drop in the table or set explicit order here.</p>
            </div>
            <div>
              <label for="provisioning-manufacturer" class="block text-xs text-muted mb-1.5">Manufacturer (optional)</label>
              <input id="provisioning-manufacturer" type="text" value={provForm().manufacturer} onInput={(e) => setProvForm(f => ({ ...f, manufacturer: e.currentTarget.value }))} class="input w-full" placeholder="Leave empty to match all" />
            </div>
            <div>
              <label class="block text-xs text-muted mb-1.5">Product classes (optional)</label>
              <div class="flex flex-wrap gap-1.5 mb-1.5">
                <For each={provForm().product_classes}>
                  {(pc) => (
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-xs">
                      {pc}
                      <button type="button" class="hover:text-sky-100" onClick={() => setProvForm(f => ({ ...f, product_classes: f.product_classes.filter(x => x !== pc) }))} aria-label={`Remove ${pc}`}>
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </For>
              </div>
              <input
                type="text"
                class="input w-full"
                placeholder="Type a product class and press Enter"
                value={provForm().product_class}
                onInput={(e) => setProvForm(f => ({ ...f, product_class: e.currentTarget.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = provForm().product_class.trim().toLowerCase();
                    if (val && !provForm().product_classes.includes(val)) {
                      setProvForm(f => ({ ...f, product_classes: [...f.product_classes, val], product_class: '' }));
                    }
                  }
                }}
              />
              <p class="text-xs text-muted mt-1">Match any of the listed product classes. Leave empty to match all.</p>
            </div>
            <div>
              <label class="block text-xs text-muted mb-1.5">CPE tag conditions (optional)</label>
              <div class="flex flex-wrap gap-1.5 mb-1.5">
                <For each={provForm().tag ? [provForm().tag] : []}>
                  {(tag) => (
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs">
                      hasTag('{tag}')
                      <button type="button" class="hover:text-amber-100" onClick={() => setProvForm(f => ({ ...f, tag: '' }))} aria-label={`Remove tag ${tag}`}>
                        <X size={10} />
                      </button>
                    </span>
                  )}
                </For>
              </div>
              <input
                id="provisioning-tag"
                type="text"
                class="input w-full"
                placeholder="branch-a (press Enter to add)"
                value={provForm().tag}
                onInput={(e) => setProvForm(f => ({ ...f, tag: e.currentTarget.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = provForm().tag.trim().toLowerCase();
                    if (val) {
                      setProvForm(f => {
                        const hasTagExpr = `hasTag('${val}')`;
                        const existing = f.condition.trim();
                        const newCondition = existing ? `${existing} AND ${hasTagExpr}` : hasTagExpr;
                        return { ...f, tag: '', condition: newCondition };
                      });
                    }
                  }
                }}
              />
              <p class="text-xs text-muted mt-1">Adds <code class="text-amber-400">hasTag('…')</code> to the condition. The rule applies only to CPEs carrying that tag.</p>
            </div>
            <Show when={!isAddObjectRule()}>
              <div>
                <label for="provisioning-type" class="block text-xs text-muted mb-1.5">CWMP value type</label>
                <select id="provisioning-type" value={provForm().parameter_type} onChange={(e) => setProvForm(f => ({ ...f, parameter_type: e.currentTarget.value }))} class="input w-full">
                  <option value="string">string</option>
                  <option value="boolean">boolean</option>
                  <option value="int">int</option>
                  <option value="unsignedInt">unsignedInt</option>
                  <option value="dateTime">dateTime</option>
                </select>
              </div>
            </Show>
            <div>
              <label for="provisioning-phase" class="block text-xs text-muted mb-1.5">Trigger phase</label>
              <select id="provisioning-phase" value={provForm().phase} onChange={(e) => setProvForm(f => ({ ...f, phase: e.currentTarget.value }))} class="input w-full">
                <option value="bootstrap">Bootstrap — applied once on first CPE connection</option>
                <option value="default">Default — re-applied on every inform when rule changes</option>
              </select>
              <p class="text-xs text-muted mt-1">Bootstrap rules run once during BOOTSTRAP. Default rules enforce ongoing configuration and re-apply when the rule is updated.</p>
            </div>
            <div>
              <label for="provisioning-description" class="block text-xs text-muted mb-1.5">Operational description (optional)</label>
              <input id="provisioning-description" type="text" value={provForm().description} onInput={(e) => setProvForm(f => ({ ...f, description: e.currentTarget.value }))} class="input w-full" placeholder="Migrate the ACS URL" />
            </div>
            <div>
              <label for="provisioning-condition" class="block text-xs text-muted mb-1.5">Condition (optional)</label>
              <textarea id="provisioning-condition" rows={2} value={provForm().condition} onInput={(e) => setProvForm(f => ({ ...f, condition: e.currentTarget.value }))} class="input w-full font-mono text-xs" placeholder="InternetGatewayDevice.DeviceInfo.Manufacturer == 'SkyDash' AND Device.Model contains 'AC1000'" />
              <p class="text-xs text-muted mt-1">Rule applies only when the condition is true. Operators: <code>==</code> <code>!=</code> <code>&gt;</code> <code>&lt;</code> <code>&gt;=</code> <code>&lt;=</code> <code>contains</code> <code>matches</code>. Device functions: <code>hasTag('…')</code> <code>notHasTag('…')</code>. Combine with <code>AND</code>, <code>OR</code>, <code>NOT</code> and parentheses. Leave empty to always apply.</p>
            </div>
            <div class="flex items-center gap-2">
              <input id="provisioning-enabled" type="checkbox" checked={provForm().enabled} onChange={(e) => setProvForm(f => ({ ...f, enabled: e.currentTarget.checked }))} class="rounded" />
              <label for="provisioning-enabled" class="text-sm text-secondary">Enable this rule</label>
            </div>
            <div class="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowProvModal(false)} class="btn btn-secondary flex-1" disabled={pendingAction() !== null}>Cancel</button>
              <button type="submit" class="btn btn-primary flex-1" disabled={pendingAction() !== null}>
                {pendingAction() ? 'Saving rule…' : editingProv() ? 'Update rule' : 'Add rule'}
              </button>
            </div>
          </form>
        </Dialog>
      </Show>
    </div>
  );
};

export default Provisioning;
