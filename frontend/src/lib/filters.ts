export type FilterOperator = 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'equals';
export type FilterLogic = 'all' | 'any';

export interface FilterRule {
  operator: FilterOperator;
  value: string;
}

export interface ColumnFilterState {
  logic: FilterLogic;
  rules: FilterRule[];
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'Obsahuje',
  not_contains: 'Neobsahuje',
  starts_with: 'Začína na',
  ends_with: 'Končí na',
  equals: 'Rovná sa',
};

export const LOGIC_LABELS: Record<FilterLogic, string> = {
  all: 'Zodpovedá všetkým',
  any: 'Zodpovedá akémukolvek',
};

export function matchesValue(value: string, rule: FilterRule): boolean {
  const v = value.toLowerCase();
  const target = rule.value.toLowerCase();
  switch (rule.operator) {
    case 'contains': return v.includes(target);
    case 'not_contains': return !v.includes(target);
    case 'starts_with': return v.startsWith(target);
    case 'ends_with': return v.endsWith(target);
    case 'equals': return v === target;
    default: return true;
  }
}

export function applyColumnFilters<T>(
  items: T[],
  filters: Record<string, ColumnFilterState>,
  getValue: (item: T, colId: string) => string
): T[] {
  const activeCols = Object.entries(filters).filter(([, f]) => f.rules.length > 0);
  if (activeCols.length === 0) return items;

  return items.filter((item) => {
    return activeCols.every(([colId, filter]) => {
      const val = getValue(item, colId);
      if (filter.logic === 'all') {
        return filter.rules.every((rule) => matchesValue(val, rule));
      }
      return filter.rules.some((rule) => matchesValue(val, rule));
    });
  });
}
