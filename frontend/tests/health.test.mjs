import assert from 'node:assert/strict';
import test from 'node:test';
import { findHealthValue, formatHealthValue, healthColor, formatUptime, gaugeRange } from '../src/lib/health.ts';

const baseDef = {
  id: 1, name: 'RX Power', description: '', device_type_match: '*',
  parameter_name: 'InternetGatewayDevice.X_RXPower', unit: 'dBm',
  source: 'passive', active: true, group: '', color: '', axis: 'left',
  transform: '', multiplier: 1, unit_scale: '', health: true,
  warn_threshold: null, critical_threshold: null,
  threshold_direction: 'higher_is_worse', display_format: 'number',
  created_at: '', updated_at: '',
};

// findHealthValue
test('findHealthValue returns null when the parameter is missing', () => {
  assert.equal(findHealthValue([], baseDef), null);
});

test('findHealthValue parses the value and applies the multiplier', () => {
  const def = { ...baseDef, multiplier: 100 };
  assert.equal(findHealthValue([{ name: baseDef.parameter_name, value: '0.5' }], def), 50);
});

test('findHealthValue returns null for a non-numeric value', () => {
  assert.equal(findHealthValue([{ name: baseDef.parameter_name, value: 'N/A' }], baseDef), null);
});

// formatHealthValue
test('formatHealthValue returns a dash for a null value', () => {
  assert.equal(formatHealthValue(null, baseDef), '-');
});

test('formatHealthValue formats a number with its unit', () => {
  assert.equal(formatHealthValue(-20.2, baseDef), '-20.2 dBm');
});

test('formatHealthValue rounds to one decimal place', () => {
  assert.equal(formatHealthValue(20.26, baseDef), '20.3 dBm');
});

test('formatHealthValue formats uptime when display_format is uptime', () => {
  const def = { ...baseDef, display_format: 'uptime', unit: '' };
  assert.equal(formatHealthValue(90061, def), '1d 1h 1m');
});

// healthColor
test('healthColor returns muted for a null value', () => {
  assert.equal(healthColor(null, baseDef), 'text-muted');
});

test('healthColor returns neutral when no thresholds are configured', () => {
  assert.equal(healthColor(50, baseDef), 'text-secondary');
});

test('healthColor higher_is_worse: below warn is emerald', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: 90 };
  assert.equal(healthColor(50, def), 'text-emerald-400');
});

test('healthColor higher_is_worse: between warn and critical is amber', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: 90 };
  assert.equal(healthColor(85, def), 'text-amber-400');
});

test('healthColor higher_is_worse: at or above critical is rose', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: 90 };
  assert.equal(healthColor(95, def), 'text-rose-400');
});

test('healthColor higher_is_worse: only warn set still colors correctly', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: null };
  assert.equal(healthColor(95, def), 'text-amber-400');
});

test('healthColor lower_is_worse: above warn is emerald', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: 100, critical_threshold: 50 };
  assert.equal(healthColor(500, def), 'text-emerald-400');
});

test('healthColor lower_is_worse: between critical and warn is amber', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: 100, critical_threshold: 50 };
  assert.equal(healthColor(80, def), 'text-amber-400');
});

test('healthColor lower_is_worse: at or below critical is rose', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: 100, critical_threshold: 50 };
  assert.equal(healthColor(40, def), 'text-rose-400');
});

// formatUptime
test('formatUptime formats days, hours and minutes', () => {
  assert.equal(formatUptime(90061), '1d 1h 1m');
});

test('formatUptime formats hours and minutes only', () => {
  assert.equal(formatUptime(3661), '1h 1m');
});

test('formatUptime formats minutes only', () => {
  assert.equal(formatUptime(120), '2m');
});

test('formatUptime accepts a numeric string', () => {
  assert.equal(formatUptime('3661'), '1h 1m');
});

test('formatUptime returns a dash for non-positive values', () => {
  assert.equal(formatUptime(0), '-');
});

// gaugeRange
test('gaugeRange higher_is_worse: uses critical as max', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: 100 };
  const r = gaugeRange(50, def);
  assert.equal(r.min, 0);
  assert.equal(r.max, 100);
});

test('gaugeRange higher_is_worse: falls back to warn * 1.5 when no critical', () => {
  const def = { ...baseDef, warn_threshold: 80, critical_threshold: null };
  const r = gaugeRange(50, def);
  assert.equal(r.min, 0);
  assert.equal(r.max, 120);
});

test('gaugeRange higher_is_worse: falls back to value * 1.5 when no thresholds', () => {
  const def = { ...baseDef, warn_threshold: null, critical_threshold: null };
  const r = gaugeRange(60, def);
  assert.equal(r.min, 0);
  assert.equal(r.max, 90);
});

test('gaugeRange higher_is_worse: defaults to 100 when value is 0 and no thresholds', () => {
  const def = { ...baseDef, warn_threshold: null, critical_threshold: null };
  const r = gaugeRange(0, def);
  assert.equal(r.min, 0);
  assert.equal(r.max, 100);
});

test('gaugeRange higher_is_worse: handles null value', () => {
  const def = { ...baseDef, warn_threshold: null, critical_threshold: null };
  const r = gaugeRange(null, def);
  assert.equal(r.min, 0);
  assert.equal(r.max, 100);
});

test('gaugeRange lower_is_worse: uses critical as min and warn * 2 as max', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: 100, critical_threshold: 50 };
  const r = gaugeRange(80, def);
  assert.equal(r.min, 50);
  assert.equal(r.max, 200);
});

test('gaugeRange lower_is_worse: falls back to warn * 0.5 for min when no critical', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: 100, critical_threshold: null };
  const r = gaugeRange(80, def);
  assert.equal(r.min, 50);
  assert.equal(r.max, 200);
});

test('gaugeRange lower_is_worse: falls back to value-based range when no thresholds', () => {
  const def = { ...baseDef, threshold_direction: 'lower_is_worse', warn_threshold: null, critical_threshold: null };
  const r = gaugeRange(100, def);
  assert.equal(r.min, 50);
  assert.equal(r.max, 200);
});
