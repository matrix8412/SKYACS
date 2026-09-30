import assert from 'node:assert/strict';
import test from 'node:test';
import { getWanProfiles } from '../src/lib/wanProfiles.ts';

test('discovers WANConnectionDevice.2.WANIPConnection.1 independently of child index', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'Existing WAN' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ConnectionStatus', value: 'Connected' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress', value: '192.0.2.1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.Enable', value: '0' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.ConnectionType', value: 'Unconfigured' },
  ];

  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].name, 'Existing WAN');
  assert.equal(profiles[1].path, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.');
  assert.equal(profiles[1].status, '-');
  assert.equal(profiles[1].type, 'Unconfigured');
  assert.equal(profiles[1].ipAddress, '-');
});

test('keeps multiple and sparse WAN instances separate', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.9.WANPPPConnection.3.Username', value: 'user9' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.9.WANIPConnection.1.Name', value: 'IP profile' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.9.WANPPPConnection.3.Name', value: 'PPP profile' },
  ];

  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 2);
  assert.equal(profiles[0].path, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.9.WANIPConnection.1.');
  assert.equal(profiles[0].username, '-');
  assert.equal(profiles[1].path, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.9.WANPPPConnection.3.');
  assert.equal(profiles[1].username, 'user9');
});

test('shows an object discovered before its status parameters arrive', () => {
  const path = 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.2.WANIPConnection.1.';
  const profiles = getWanProfiles([{ name: path, value: '' }]);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].path, path);
  assert.equal(profiles[0].status, '-');
});
