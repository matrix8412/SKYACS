import assert from 'node:assert/strict';
import test from 'node:test';
import { metricsTabMetrics, healthPanelMetrics } from '../src/lib/metricViews.ts';

const baseDef = {
  id: 1, name: 'CPU Load', description: '', device_type_match: '*',
  parameter_name: 'InternetGatewayDevice.X_CPU', unit: '%',
  source: 'passive', active: true, group: '', color: '', axis: 'left',
  transform: '', multiplier: 1, unit_scale: '', health: false,
  warn_threshold: null, critical_threshold: null,
  threshold_direction: 'higher_is_worse', display_format: 'number',
  chart_type: 'line', created_at: '', updated_at: '',
};

// A metric enabled for the Health panel must ALSO remain in the Metrics tab.
test('health-enabled metric appears in BOTH the Metrics tab and the Health panel', () => {
  const defs = [{ ...baseDef, health: true, display_format: 'gauge' }];
  const tab = metricsTabMetrics(defs);
  const panel = healthPanelMetrics(defs);
  assert.ok(tab.some(m => m.name === 'CPU Load'), 'health metric must appear in the Metrics tab');
  assert.ok(panel.some(m => m.name === 'CPU Load'), 'health metric must appear in the Health panel');
});

test('non-health metric appears only in the Metrics tab', () => {
  const defs = [{ ...baseDef, health: false }];
  const tab = metricsTabMetrics(defs);
  const panel = healthPanelMetrics(defs);
  assert.ok(tab.some(m => m.name === 'CPU Load'), 'non-health metric must appear in the Metrics tab');
  assert.equal(panel.length, 0, 'non-health metric must NOT appear in the Health panel');
});

test('Metrics tab is no longer mutually exclusive with the Health panel', () => {
  const defs = [
    { ...baseDef, id: 1, name: 'CPU', health: true, display_format: 'gauge' },
    { ...baseDef, id: 2, name: 'Temp', health: false, display_format: 'number' },
  ];
  const tab = metricsTabMetrics(defs);
  const panel = healthPanelMetrics(defs);
  assert.equal(tab.length, 2, 'both metrics show in the Metrics tab (no exclusion)');
  assert.equal(panel.length, 1, 'only the health metric shows in the Health panel');
  assert.equal(panel[0].name, 'CPU');
});

test('empty input yields empty views', () => {
  assert.deepEqual(metricsTabMetrics([]), []);
  assert.deepEqual(healthPanelMetrics([]), []);
});
