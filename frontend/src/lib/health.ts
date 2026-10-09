import type { MetricDefinition } from './api';

export interface HealthTile {
  label: string;
  value: string;
  color: string;
}

export function formatUptime(seconds: number | string): string {
  const secs = typeof seconds === 'string' ? parseInt(seconds) : seconds;
  if (isNaN(secs) || secs <= 0) return '-';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function findHealthValue(params: { name: string; value: string }[], def: MetricDefinition): number | null {
  const p = params.find(p => p.name === def.parameter_name);
  if (!p) return null;
  const num = parseFloat(p.value);
  if (isNaN(num)) return null;
  return num * (def.multiplier || 1);
}

export function formatHealthValue(v: number | null, def: MetricDefinition): string {
  if (v === null) return '-';
  if (def.display_format === 'uptime') return formatUptime(v);
  const unit = def.unit ? ` ${def.unit}` : '';
  return `${v.toFixed(1)}${unit}`;
}

export function healthColor(v: number | null, def: MetricDefinition): string {
  if (v === null) return 'text-muted';
  const warn = def.warn_threshold;
  const crit = def.critical_threshold;
  if (warn === null && crit === null) return 'text-secondary';
  if (def.threshold_direction === 'lower_is_worse') {
    if (crit !== null && v <= crit) return 'text-rose-400';
    if (warn !== null && v <= warn) return 'text-amber-400';
    return 'text-emerald-400';
  }
  if (crit !== null && v >= crit) return 'text-rose-400';
  if (warn !== null && v >= warn) return 'text-amber-400';
  return 'text-emerald-400';
}
