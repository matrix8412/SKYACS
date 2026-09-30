import type { Component } from 'solid-js';
import { createSignal, Show, For, onCleanup } from 'solid-js';
import { Filter, Plus, X } from 'lucide-solid';
import {
  type ColumnFilterState,
  type FilterOperator,
  type FilterLogic,
  OPERATOR_LABELS,
  LOGIC_LABELS,
} from '../lib/filters';

interface ColumnFilterProps {
  columnId: string;
  label: string;
  active: ColumnFilterState | null;
  onApply: (state: ColumnFilterState | null) => void;
}

const ColumnFilter: Component<ColumnFilterProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [logic, setLogic] = createSignal<FilterLogic>(props.active?.logic ?? 'all');
  const [rules, setRules] = createSignal<{ operator: FilterOperator; value: string }[]>(
    props.active?.rules?.length ? props.active.rules : [{ operator: 'contains', value: '' }]
  );
  const [pos, setPos] = createSignal<{ top: number; left: number }>({ top: 0, left: 0 });
  let btnRef: HTMLButtonElement | undefined;
  let panelRef: HTMLDivElement | undefined;

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    if (panelRef && !panelRef.contains(target) && btnRef && !btnRef.contains(target)) {
      setOpen(false);
    }
  };

  const toggle = () => {
    if (!open()) {
      setLogic(props.active?.logic ?? 'all');
      setRules(props.active?.rules?.length ? props.active.rules : [{ operator: 'contains', value: '' }]);
      if (btnRef) {
        const rect = btnRef.getBoundingClientRect();
        setPos({ top: rect.bottom + 4, left: rect.left });
      }
    }
    setOpen(!open());
  };

  const addRule = () => {
    setRules((r) => [...r, { operator: 'contains', value: '' }]);
  };

  const removeRule = (index: number) => {
    setRules((r) => r.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, field: 'operator' | 'value', val: string) => {
    setRules((r) => r.map((rule, i) => i === index ? { ...rule, [field]: val } : rule));
  };

  const handleApply = () => {
    const validRules = rules().filter((r) => r.value.trim() !== '');
    if (validRules.length === 0) {
      props.onApply(null);
    } else {
      props.onApply({ logic: logic(), rules: validRules });
    }
    setOpen(false);
  };

  const handleClear = () => {
    props.onApply(null);
    setLogic('all');
    setRules([{ operator: 'contains', value: '' }]);
    setOpen(false);
  };

  onCleanup(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  return (
    <>
      <button
        type="button"
        class={`filter-toggle ${props.active ? 'filter-toggle-active' : ''}`}
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        aria-label={`Filter ${props.label}`}
        aria-expanded={open()}
      >
        <Filter size={11} />
        <Show when={props.active}>
          <span class="filter-badge">{props.active!.rules.length}</span>
        </Show>
      </button>
      <Show when={open()}>
        <div
          class="filter-dropdown"
          style={{ position: 'fixed', top: `${pos().top}px`, left: `${pos().left}px` }}
          ref={(el) => {
            panelRef = el;
            if (el) document.addEventListener('click', handleClickOutside);
          }}
          onClick={(e) => e.stopPropagation()}
        >
            <div class="filter-dropdown-header">
              <span class="filter-dropdown-title">{props.label}</span>
              <button type="button" class="filter-dropdown-close" onClick={() => setOpen(false)} aria-label="Close filter">
                <X size={12} />
              </button>
            </div>
            <div class="filter-dropdown-body">
              <label class="filter-dropdown-label">Logika</label>
              <select
                class="filter-dropdown-select"
                value={logic()}
                onChange={(e) => setLogic(e.currentTarget.value as FilterLogic)}
              >
                <For each={Object.entries(LOGIC_LABELS)}>
                  {([value, label]) => <option value={value}>{label}</option>}
                </For>
              </select>
              <div class="filter-rules">
                <For each={rules()}>
                  {(rule, idx) => (
                    <div class="filter-rule">
                      <select
                        class="filter-dropdown-select filter-rule-op"
                        value={rule.operator}
                        onChange={(e) => updateRule(idx(), 'operator', e.currentTarget.value)}
                      >
                        <For each={Object.entries(OPERATOR_LABELS)}>
                          {([value, label]) => <option value={value}>{label}</option>}
                        </For>
                      </select>
                      <input
                        type="text"
                        class="filter-rule-input"
                        value={rule.value}
                        onInput={(e) => updateRule(idx(), 'value', e.currentTarget.value)}
                        placeholder="Hodnota…"
                      />
                      <Show when={rules().length > 1}>
                        <button type="button" class="filter-rule-remove" onClick={() => removeRule(idx())} aria-label="Remove rule">
                          <X size={10} />
                        </button>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
              <button type="button" class="filter-add-rule" onClick={addRule}>
                <Plus size={11} />
                Pridať pravidlo
              </button>
            </div>
            <div class="filter-dropdown-footer">
              <button type="button" class="filter-btn-clear" onClick={handleClear}>
                Vymazať
              </button>
              <button type="button" class="filter-btn-apply" onClick={handleApply}>
                Aplikovať
              </button>
            </div>
        </div>
      </Show>
    </>
  );
};

export default ColumnFilter;
