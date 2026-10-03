import assert from 'node:assert/strict';
import test from 'node:test';
import { lanStatusColor } from '../src/lib/lanFields.ts';

test('maps NoLink / LinkDown / Disabled to rose', () => {
  assert.equal(lanStatusColor('NoLink'), 'bg-rose-500');
  assert.equal(lanStatusColor('LinkDown'), 'bg-rose-500');
  assert.equal(lanStatusColor('Down'), 'bg-rose-500');
  assert.equal(lanStatusColor('Disabled'), 'bg-rose-500');
});

test('maps Up / LinkUp / Connected / Enabled to emerald', () => {
  assert.equal(lanStatusColor('Up'), 'bg-emerald-500');
  assert.equal(lanStatusColor('LinkUp'), 'bg-emerald-500');
  assert.equal(lanStatusColor('Connected'), 'bg-emerald-500');
  assert.equal(lanStatusColor('Enabled'), 'bg-emerald-500');
});

test('is case-insensitive and trims whitespace', () => {
  assert.equal(lanStatusColor('  nOLINK  '), 'bg-rose-500');
  assert.equal(lanStatusColor('UP'), 'bg-emerald-500');
});

test('defaults unknown values to gray', () => {
  assert.equal(lanStatusColor('Unknown'), 'bg-gray-400');
  assert.equal(lanStatusColor(''), 'bg-gray-400');
  assert.equal(lanStatusColor('-'), 'bg-gray-400');
});
