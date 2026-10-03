import assert from 'node:assert/strict';
import test from 'node:test';
import { GENERAL_FIELDS, CREDENTIALS_FIELDS, ADVANCED_FIELDS, ALL_FIELDS, resolveSuffix, getChangedParams, validateFields } from '../src/lib/wanFields.ts';

const prefix = 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.';

const makeParams = (entries) =>
  Object.entries(entries).map(([name, value]) => ({ name: prefix + name, value }));

test('resolveSuffix finds first matching suffix', () => {
  const params = [{ name: prefix + 'Name', value: 'WAN1' }];
  assert.equal(resolveSuffix(params, prefix, ['Name']), 'Name');
});

test('resolveSuffix falls back to second suffix', () => {
  const params = [{ name: prefix + 'X_HW_VLAN', value: '832' }];
  assert.equal(resolveSuffix(params, prefix, ['X_HW_VLAN', 'VLANID', 'VLANIDMark']), 'X_HW_VLAN');
});

test('resolveSuffix falls back to third suffix', () => {
  const params = [{ name: prefix + 'VLANIDMark', value: '832' }];
  assert.equal(resolveSuffix(params, prefix, ['X_HW_VLAN', 'VLANID', 'VLANIDMark']), 'VLANIDMark');
});

test('resolveSuffix returns null when no suffix matches', () => {
  const params = [{ name: prefix + 'Name', value: 'WAN1' }];
  assert.equal(resolveSuffix(params, prefix, ['Username', 'Password']), null);
});

test('getChangedParams returns empty when no edits', () => {
  const params = makeParams({ Name: 'WAN1', Enable: '1', ConnectionType: 'PPPoE' });
  const changed = getChangedParams(params, prefix, {});
  assert.deepEqual(changed, {});
});

test('getChangedParams detects single field change', () => {
  const params = makeParams({ Name: 'WAN1', Enable: '1' });
  const changed = getChangedParams(params, prefix, { [prefix + 'Name']: 'WAN2' });
  assert.deepEqual(changed, { [prefix + 'Name']: 'WAN2' });
});

test('getChangedParams detects credential change', () => {
  const params = makeParams({ Username: 'user1', Password: 'pass1' });
  const changed = getChangedParams(params, prefix, { [prefix + 'Username']: 'user2' });
  assert.deepEqual(changed, { [prefix + 'Username']: 'user2' });
});

test('getChangedParams detects multiple field changes', () => {
  const params = makeParams({ Name: 'WAN1', Enable: '1', X_HW_MTU: '1492' });
  const changed = getChangedParams(params, prefix, {
    [prefix + 'Name']: 'WAN2',
    [prefix + 'X_HW_MTU']: '1500',
  });
  assert.deepEqual(changed, {
    [prefix + 'Name']: 'WAN2',
    [prefix + 'X_HW_MTU']: '1500',
  });
});

test('validateFields returns empty when all valid', () => {
  const params = makeParams({ X_HW_VLAN: '100', X_HW_MTU: '1492' });
  const errors = validateFields(params, prefix, {});
  assert.deepEqual(errors, {});
});

test('validateFields detects invalid VLAN (0)', () => {
  const params = makeParams({ X_HW_VLAN: '0' });
  const errors = validateFields(params, prefix, {});
  assert.ok(errors[prefix + 'X_HW_VLAN']);
});

test('validateFields detects invalid VLAN (4095)', () => {
  const params = makeParams({ X_HW_VLAN: '4095' });
  const errors = validateFields(params, prefix, {});
  assert.ok(errors[prefix + 'X_HW_VLAN']);
});

test('validateFields detects invalid MTU (too small)', () => {
  const params = makeParams({ X_HW_MTU: '500' });
  const errors = validateFields(params, prefix, {});
  assert.ok(errors[prefix + 'X_HW_MTU']);
});

test('validateFields detects invalid MTU (too large)', () => {
  const params = makeParams({ X_HW_MTU: '9999' });
  const errors = validateFields(params, prefix, {});
  assert.ok(errors[prefix + 'X_HW_MTU']);
});

test('validateFields uses edited value over original', () => {
  const params = makeParams({ X_HW_MTU: '1492' });
  const errors = validateFields(params, prefix, { [prefix + 'X_HW_MTU']: '100' });
  assert.ok(errors[prefix + 'X_HW_MTU']);
});

test('ALL_FIELDS contains all general, credentials, and advanced fields', () => {
  assert.equal(ALL_FIELDS.length, GENERAL_FIELDS.length + CREDENTIALS_FIELDS.length + ADVANCED_FIELDS.length);
});

test('GENERAL_FIELDS has 5 fields', () => {
  assert.equal(GENERAL_FIELDS.length, 5);
});

test('CREDENTIALS_FIELDS has 3 fields', () => {
  assert.equal(CREDENTIALS_FIELDS.length, 3);
});

test('ADVANCED_FIELDS has 9 fields', () => {
  assert.equal(ADVANCED_FIELDS.length, 9);
});
