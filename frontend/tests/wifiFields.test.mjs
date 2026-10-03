import assert from 'node:assert/strict';
import test from 'node:test';
import { GENERAL_FIELDS, SECURITY_FIELDS, ADVANCED_FIELDS, ALL_FIELDS, WLAN_PREFIX, resolveSuffix, getChangedParams, validateFields } from '../src/lib/wifiFields.ts';

const prefix = WLAN_PREFIX(1);

const makeParams = (entries) =>
  Object.entries(entries).map(([name, value]) => ({ name: prefix + name, value }));

test('WLAN_PREFIX generates correct path for index 1', () => {
  assert.equal(prefix, 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.');
});

test('WLAN_PREFIX generates correct path for index 3', () => {
  assert.equal(WLAN_PREFIX(3), 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.3.');
});

test('resolveSuffix finds first matching suffix', () => {
  const params = [{ name: prefix + 'BeaconType', value: 'WPA2-Personal' }];
  assert.equal(resolveSuffix(params, prefix, ['BeaconType', 'WPAEncryptionModes']), 'BeaconType');
});

test('resolveSuffix falls back to second suffix', () => {
  const params = [{ name: prefix + 'WPAEncryptionModes', value: 'AES' }];
  assert.equal(resolveSuffix(params, prefix, ['BeaconType', 'WPAEncryptionModes']), 'WPAEncryptionModes');
});

test('resolveSuffix returns null when no suffix matches', () => {
  const params = [{ name: prefix + 'SSID', value: 'Test' }];
  assert.equal(resolveSuffix(params, prefix, ['BeaconType', 'WPAEncryptionModes']), null);
});

test('resolveSuffix handles Huawei X_HW_ fallback', () => {
  const params = [{ name: prefix + 'X_HW_MaxBitRate', value: '300000' }];
  assert.equal(resolveSuffix(params, prefix, ['MaxBitRate', 'X_HW_MaxBitRate']), 'X_HW_MaxBitRate');
});

test('getChangedParams returns empty when no edits', () => {
  const params = makeParams({ SSID: 'MyNetwork', Enable: '1', Channel: '6' });
  const changed = getChangedParams(params, prefix, {});
  assert.deepEqual(changed, {});
});

test('getChangedParams detects single field change', () => {
  const params = makeParams({ SSID: 'MyNetwork', Enable: '1' });
  const changed = getChangedParams(params, prefix, { [prefix + 'SSID']: 'NewNetwork' });
  assert.deepEqual(changed, { [prefix + 'SSID']: 'NewNetwork' });
});

test('getChangedParams detects multiple field changes', () => {
  const params = makeParams({ SSID: 'MyNetwork', Channel: '6', Enable: '1' });
  const changed = getChangedParams(params, prefix, {
    [prefix + 'SSID']: 'NewNetwork',
    [prefix + 'Channel']: '11',
  });
  assert.equal(Object.keys(changed).length, 2);
  assert.equal(changed[prefix + 'SSID'], 'NewNetwork');
  assert.equal(changed[prefix + 'Channel'], '11');
  assert.equal(changed[prefix + 'Enable'], undefined);
});

test('getChangedParams ignores fields not present on device', () => {
  const params = makeParams({ SSID: 'MyNetwork' });
  const changed = getChangedParams(params, prefix, { [prefix + 'Channel']: '11' });
  assert.deepEqual(changed, {});
});
test('validateFields passes valid SSID', () => {
  const params = makeParams({ SSID: 'MyNetwork' });
  const errors = validateFields(params, prefix, {});
  assert.deepEqual(errors, {});
});

test('validateFields rejects empty SSID', () => {
  const params = makeParams({ SSID: '' });
  const errors = validateFields(params, prefix, {});
  assert.ok(errors[prefix + 'SSID']);
  assert.match(errors[prefix + 'SSID'], /1–32/);
});

test('validateFields rejects SSID longer than 32 chars', () => {
  const params = makeParams({ SSID: 'A' });
  const longSsid = 'A'.repeat(33);
  const errors = validateFields(params, prefix, { [prefix + 'SSID']: longSsid });
  assert.ok(errors[prefix + 'SSID']);
});

test('validateFields accepts SSID of exactly 32 chars', () => {
  const params = makeParams({ SSID: 'A' });
  const ssid32 = 'A'.repeat(32);
  const errors = validateFields(params, prefix, { [prefix + 'SSID']: ssid32 });
  assert.equal(errors[prefix + 'SSID'], undefined);
});

test('validateFields rejects password shorter than 8 chars', () => {
  const params = makeParams({ 'PreSharedKey.1.KeyPassphrase': 'valid123' });
  const errors = validateFields(params, prefix, { [prefix + 'PreSharedKey.1.KeyPassphrase']: 'short' });
  assert.ok(errors[prefix + 'PreSharedKey.1.KeyPassphrase']);
  assert.match(errors[prefix + 'PreSharedKey.1.KeyPassphrase'], /8–63/);
});

test('validateFields accepts password of exactly 8 chars', () => {
  const params = makeParams({ 'PreSharedKey.1.KeyPassphrase': 'valid123' });
  const errors = validateFields(params, prefix, { [prefix + 'PreSharedKey.1.KeyPassphrase']: '12345678' });
  assert.equal(errors[prefix + 'PreSharedKey.1.KeyPassphrase'], undefined);
});

test('validateFields rejects password longer than 63 chars', () => {
  const params = makeParams({ 'PreSharedKey.1.KeyPassphrase': 'valid123' });
  const longPass = 'A'.repeat(64);
  const errors = validateFields(params, prefix, { [prefix + 'PreSharedKey.1.KeyPassphrase']: longPass });
  assert.ok(errors[prefix + 'PreSharedKey.1.KeyPassphrase']);
});

test('validateFields rejects channel out of range (negative)', () => {
  const params = makeParams({ Channel: '6' });
  const errors = validateFields(params, prefix, { [prefix + 'Channel']: '-1' });
  assert.ok(errors[prefix + 'Channel']);
});

test('validateFields rejects channel out of range (>177)', () => {
  const params = makeParams({ Channel: '6' });
  const errors = validateFields(params, prefix, { [prefix + 'Channel']: '178' });
  assert.ok(errors[prefix + 'Channel']);
});

test('validateFields accepts channel 0 (auto)', () => {
  const params = makeParams({ Channel: '6' });
  const errors = validateFields(params, prefix, { [prefix + 'Channel']: '0' });
  assert.equal(errors[prefix + 'Channel'], undefined);
});

test('validateFields accepts channel 177 (max)', () => {
  const params = makeParams({ Channel: '6' });
  const errors = validateFields(params, prefix, { [prefix + 'Channel']: '177' });
  assert.equal(errors[prefix + 'Channel'], undefined);
});

test('validateFields rejects beacon period out of range', () => {
  const params = makeParams({ BeaconPeriod: '100' });
  const errors = validateFields(params, prefix, { [prefix + 'BeaconPeriod']: '0' });
  assert.ok(errors[prefix + 'BeaconPeriod']);
});

test('validateFields rejects DTIM out of range', () => {
  const params = makeParams({ DTIMPeriod: '2' });
  const errors = validateFields(params, prefix, { [prefix + 'DTIMPeriod']: '256' });
  assert.ok(errors[prefix + 'DTIMPeriod']);
});

test('validateFields skips validation for fields not present on device', () => {
  const params = makeParams({ SSID: 'MyNetwork' });
  const errors = validateFields(params, prefix, { [prefix + 'Channel']: '999' });
  assert.equal(errors[prefix + 'Channel'], undefined);
});

test('GENERAL_FIELDS includes SSID, Enable, Channel', () => {
  const labels = GENERAL_FIELDS.map(f => f.label);
  assert.ok(labels.includes('SSID Name'));
  assert.ok(labels.includes('Enable'));
  assert.ok(labels.includes('Channel'));
});

test('SECURITY_FIELDS includes Security Mode and Key Passphrase', () => {
  const labels = SECURITY_FIELDS.map(f => f.label);
  assert.ok(labels.includes('Security Mode'));
  assert.ok(labels.includes('Key Passphrase'));
});

test('ADVANCED_FIELDS includes TX Power and Beacon Period', () => {
  const labels = ADVANCED_FIELDS.map(f => f.label);
  assert.ok(labels.includes('TX Power'));
  assert.ok(labels.includes('Beacon Period'));
});

test('ALL_FIELDS is concatenation of all three tabs', () => {
  assert.equal(ALL_FIELDS.length, GENERAL_FIELDS.length + SECURITY_FIELDS.length + ADVANCED_FIELDS.length);
});

