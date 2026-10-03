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
  assert.equal(profiles[1].enable, 'Disabled');
  assert.equal(profiles[0].enable, '-');
  assert.equal(profiles[1].type, 'Unconfigured');
  assert.equal(profiles[1].ipAddress, '-');
});

test('shows Enable as Enabled when value is 1', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Enable', value: '1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].enable, 'Enabled');
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

test('populates portParams when a service list parameter is present', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_SERVICELIST', value: 'lan1,lan2' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.ok(profiles[0].portParams);
  assert.equal(profiles[0].portParams.serviceListPath, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_SERVICELIST');
  assert.equal(profiles[0].portParams.serviceListValue, 'lan1,lan2');
});

test('portParams is undefined when no service list parameter exists', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Enable', value: '1' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].portParams, undefined);
});

test('portParams picks up X_CT_ServiceList variant', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Name', value: 'PPP' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_CT_ServiceList', value: 'eth1' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.ok(profiles[0].portParams);
  assert.equal(profiles[0].portParams.serviceListPath, 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_CT_ServiceList');
  assert.equal(profiles[0].portParams.serviceListValue, 'eth1');
});

test('extracts SSID boolean enable paths and populates portParams without service list', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID1Enable', value: '1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID2Enable', value: '0' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.Lan1Enable', value: '1' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.ok(profiles[0].portParams);
  assert.equal(profiles[0].portParams.serviceListPath, undefined);
  assert.equal(
    profiles[0].portParams.ssidEnablePaths[1],
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID1Enable'
  );
  assert.equal(
    profiles[0].portParams.ssidEnablePaths[2],
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID2Enable'
  );
  assert.equal(
    profiles[0].portParams.lanEnablePaths[1],
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.Lan1Enable'
  );
  assert.equal(profiles[0].ssid1, true);
  assert.equal(profiles[0].ssid2, false);
  assert.equal(profiles[0].lan1, true);
});

test('portParams is present when only boolean paths exist (no service list)', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID1Enable', value: 'true' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.ok(profiles[0].portParams);
  assert.equal(profiles[0].portParams.serviceListPath, undefined);
  assert.ok(profiles[0].portParams.ssidEnablePaths);
  assert.equal(profiles[0].portParams.ssidEnablePaths[1], 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID1Enable');
});

test('discovers SSID5-8 boolean enable paths', () => {
  const parameters = [
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.Name', value: 'WAN1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID5Enable', value: '1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID6Enable', value: '1' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID7Enable', value: '0' },
    { name: 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID8Enable', value: '0' },
  ];
  const profiles = getWanProfiles(parameters);
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].ssid5, true);
  assert.equal(profiles[0].ssid6, true);
  assert.equal(profiles[0].ssid7, false);
  assert.equal(profiles[0].ssid8, false);
  assert.ok(profiles[0].portParams);
  assert.equal(profiles[0].portParams.ssidEnablePaths[5], 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID5Enable');
  assert.equal(profiles[0].portParams.ssidEnablePaths[8], 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.X_HW_LANBIND.SSID8Enable');
});
