export interface WanFieldDef {
  label: string;
  suffixes: string[];
  type: 'text' | 'password' | 'select' | 'number' | 'toggle';
  options?: string[];
  placeholder?: string;
  validate?: (value: string) => string | null;
}

export const GENERAL_FIELDS: WanFieldDef[] = [
  { label: 'Name', suffixes: ['Name'], type: 'text', placeholder: 'Connection name' },
  { label: 'Enable', suffixes: ['Enable'], type: 'toggle' },
  { label: 'Connection Type', suffixes: ['ConnectionType'], type: 'select', options: ['PPPoE', 'IP', 'DHCP', 'Static', 'Unconfigured'] },
  { label: 'VLAN', suffixes: ['X_HW_VLAN', 'VLANID', 'VLANIDMark'], type: 'number', placeholder: '1–4094', validate: (v) => { const n = parseInt(v, 10); if (isNaN(n) || n < 1 || n > 4094) return 'VLAN must be 1–4094'; return null; } },
  { label: 'Service', suffixes: ['X_HW_SERVICELIST', 'X_HW_ServiceList', 'ServiceList'], type: 'text', placeholder: 'e.g. 832' },
];

export const CREDENTIALS_FIELDS: WanFieldDef[] = [
  { label: 'Username', suffixes: ['Username'], type: 'text', placeholder: 'PPPoE username' },
  { label: 'Password', suffixes: ['Password'], type: 'password', placeholder: 'PPPoE password' },
  { label: 'Service Name', suffixes: ['ServiceName'], type: 'text', placeholder: 'e.g. INTERNET' },
];

export const ADVANCED_FIELDS: WanFieldDef[] = [
  { label: 'NAT', suffixes: ['NATEnabled'], type: 'toggle' },
  { label: 'Max Bit Rate', suffixes: ['MaxBitRate'], type: 'number', placeholder: 'e.g. 1000000' },
  { label: 'Min Bit Rate', suffixes: ['MinBitRate'], type: 'number', placeholder: 'e.g. 1000000' },
  { label: 'MTU', suffixes: ['X_HW_MTU'], type: 'number', placeholder: '576–9000', validate: (v) => { const n = parseInt(v, 10); if (isNaN(n) || n < 576 || n > 9000) return 'MTU must be 576–9000'; return null; } },
  { label: 'DSL Link Type', suffixes: ['X_HW_DSLLinkType'], type: 'select', options: ['Auto', 'G.dmt', 'G.992.1', 'G.992.3', 'G.992.5'] },
  { label: 'Line Profile', suffixes: ['X_HW_LineProfile'], type: 'select', options: ['Auto', '26M', '35M', '40M', '52M', '60M', '80M', '100M'] },
  { label: 'Line Mode', suffixes: ['X_HW_LineMode'], type: 'select', options: ['Auto', 'AnnexA', 'AnnexB', 'AnnexM', 'AnnexJ'] },
  { label: 'ATM Encapsulation', suffixes: ['X_HW_ATMEncapsulation'], type: 'select', options: ['Auto', 'LLC', 'VC-Mux', 'Bridged'] },
  { label: 'ATM Payload', suffixes: ['X_HW_ATMPayload'], type: 'number', placeholder: 'e.g. 8' },
];

export const ALL_FIELDS = [...GENERAL_FIELDS, ...CREDENTIALS_FIELDS, ...ADVANCED_FIELDS];

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
