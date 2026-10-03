export interface WifiFieldDef {
  label: string;
  suffixes: string[];
  type: 'text' | 'password' | 'select' | 'number' | 'toggle';
  options?: string[];
  placeholder?: string;
  validate?: (value: string) => string | null;
}

export const GENERAL_FIELDS: WifiFieldDef[] = [
  { label: 'SSID Name', suffixes: ['SSID'], type: 'text', placeholder: 'Network name', validate: (v) => { if (v.length < 1 || v.length > 32) return 'SSID must be 1–32 characters'; return null; } },
  { label: 'Enable', suffixes: ['Enable'], type: 'toggle' },
  { label: 'Frequency Band', suffixes: ['OperatingFrequencyBand'], type: 'select', options: ['2.4GHz', '5GHz', '6GHz'] },
  { label: 'Channel', suffixes: ['Channel'], type: 'number', placeholder: '0 = auto', validate: (v) => { const n = parseInt(v, 10); if (isNaN(n) || n < 0 || n > 177) return 'Channel must be 0–177'; return null; } },
  { label: 'Channel Width', suffixes: ['ChannelWidth'], type: 'select', options: ['20MHz', '40MHz', '80MHz', '160MHz', '20/40MHz', '20/40/80MHz'] },
  { label: 'Max Bit Rate', suffixes: ['MaxBitRate', 'X_HW_MaxBitRate'], type: 'text', placeholder: 'e.g. 300000' },
  { label: 'Standard', suffixes: ['Standard'], type: 'select', options: ['802.11a', '802.11b', '802.11g', '802.11n', '802.11ac', '802.11ax', '802.11a/b/g/n/ac/ax'] },
];

export const SECURITY_FIELDS: WifiFieldDef[] = [
  { label: 'Security Mode', suffixes: ['BeaconType', 'WPAEncryptionModes'], type: 'select', options: ['open', 'WPA-Personal', 'WPA2-Personal', 'WPA3-Personal', 'WPA2/WPA3-Personal', 'WPA2-Enterprise', 'WPA3-Enterprise'] },
  { label: 'Key Passphrase', suffixes: ['PreSharedKey.1.KeyPassphrase', 'KeyPassphrase', 'X_HW_WPAKey'], type: 'password', placeholder: '8–63 characters', validate: (v) => { if (v && (v.length < 8 || v.length > 63)) return 'Password must be 8–63 characters'; return null; } },
  { label: 'Key Management', suffixes: ['KeyManagement'], type: 'select', options: ['PSK', '802.1X', 'PSK,802.1X'] },
];

export const ADVANCED_FIELDS: WifiFieldDef[] = [
  { label: 'TX Power', suffixes: ['TransmitPower', 'X_HW_TransmitPower'], type: 'text', placeholder: 'e.g. 20 (dBm)' },
  { label: 'Beacon Period', suffixes: ['BeaconPeriod'], type: 'number', placeholder: '1–65535', validate: (v) => { const n = parseInt(v, 10); if (isNaN(n) || n < 1 || n > 65535) return 'Beacon period must be 1–65535'; return null; } },
  { label: 'DTIM Period', suffixes: ['DTIMPeriod'], type: 'number', placeholder: '1–255', validate: (v) => { const n = parseInt(v, 10); if (isNaN(n) || n < 1 || n > 255) return 'DTIM must be 1–255'; return null; } },
  { label: 'WMM', suffixes: ['WMM', 'X_HW_WMM'], type: 'toggle' },
  { label: 'Beacon Transmit', suffixes: ['BeaconTransmit'], type: 'toggle' },
  { label: 'Multicast SSID', suffixes: ['MulticastSSID'], type: 'toggle' },
];

export const ALL_FIELDS = [...GENERAL_FIELDS, ...SECURITY_FIELDS, ...ADVANCED_FIELDS];

export const WLAN_PREFIX = (index: number) => `InternetGatewayDevice.LANDevice.1.WLANConfiguration.${index}.`;

export function resolveSuffix(parameters: { name: string }[], prefix: string, suffixes: string[]): string | null {
  for (const s of suffixes) {
    if (parameters.some(p => p.name === prefix + s)) return s;
  }
  return null;
}

export function getChangedParams(
  parameters: { name: string; value: string }[],
  prefix: string,
  edits: Record<string, string>,
): Record<string, string> {
  const changed: Record<string, string> = {};
  for (const field of ALL_FIELDS) {
    const suffix = resolveSuffix(parameters, prefix, field.suffixes);
    if (!suffix) continue;
    const key = prefix + suffix;
    const original = parameters.find(p => p.name === key)?.value ?? '';
    const current = edits[key] ?? original;
    if (current !== original) changed[key] = current;
  }
  return changed;
}

export function validateFields(
  parameters: { name: string; value: string }[],
  prefix: string,
  edits: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of ALL_FIELDS) {
    if (!field.validate) continue;
    const suffix = resolveSuffix(parameters, prefix, field.suffixes);
    if (!suffix) continue;
    const key = prefix + suffix;
    const value = edits[key] ?? parameters.find(p => p.name === key)?.value ?? '';
    const error = field.validate(value);
    if (error) errors[key] = error;
  }
  return errors;
}
