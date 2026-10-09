import type { MetricDefinition } from './api';

/**
 * Metrics shown in the Metrics tab (line/bar charts).
 *
 * Every matching metric appears here, regardless of whether it is also
 * enabled for the Device Health panel. The two views are independent: a
 * metric can be a line chart in the Metrics tab while simultaneously
 * appearing as a number or gauge tile in the Health panel.
 */
export function metricsTabMetrics(defs: MetricDefinition[]): MetricDefinition[] {
  return defs;
}

/**
 * Metrics shown in the Device Health panel (number/gauge tiles).
 * Only metrics with `health` enabled appear here.
 */
export function healthPanelMetrics(defs: MetricDefinition[]): MetricDefinition[] {
  return defs.filter(d => d.health);
}
