import assert from 'node:assert/strict';
import test from 'node:test';
import { statusBadgeClass } from '../src/lib/lanFields.ts';

test('maps Up / LinkUp / Connected / Enabled to success badge', () => {
  assert.equal(statusBadgeClass('Up'), 'badge-success');
  assert.equal(statusBadgeClass('LinkUp'), 'badge-success');
  assert.equal(statusBadgeClass('Connected'), 'badge-success');
  assert.equal(statusBadgeClass('Enabled'), 'badge-success');
});

test('maps NoLink / LinkDown / Down / Disabled to error badge', () => {
  assert.equal(statusBadgeClass('NoLink'), 'badge-error');
  assert.equal(statusBadgeClass('LinkDown'), 'badge-error');
  assert.equal(statusBadgeClass('Down'), 'badge-error');
  assert.equal(statusBadgeClass('Disabled'), 'badge-error');
});

test('is case-insensitive and trims whitespace', () => {
  assert.equal(statusBadgeClass('  nOLINK  '), 'badge-error');
  assert.equal(statusBadgeClass('UP'), 'badge-success');
});

test('maps empty / dash to warning badge', () => {
  assert.equal(statusBadgeClass(''), 'badge-warning');
  assert.equal(statusBadgeClass('-'), 'badge-warning');
});

test('defaults unknown values to error badge', () => {
  assert.equal(statusBadgeClass('Unknown'), 'badge-error');
});
