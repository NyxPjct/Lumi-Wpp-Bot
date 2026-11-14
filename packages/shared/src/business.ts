export interface BusinessSettings {
  name: string;
  address: string;
  hours: string;
  payments: string;
  delivery: string;
}

export type BusinessField = keyof BusinessSettings;
export type SettingsErrors = Partial<Record<BusinessField, string>>;
export const emptySettings: BusinessSettings = {
  name: '', address: '', hours: '', payments: '', delivery: '',
};
const labels: Record<BusinessField, string> = {
  name: 'Nome da ótica', address: 'Endereço', hours: 'Horário de atendimento',
  payments: 'Formas de pagamento', delivery: 'Prazo dos óculos',
};

// Shared by the local prototype and future server-side persistence adapters.
// Return only known, normalized fields; never trust browser storage as validated input.
export function validateSettings(input: unknown):
  | {ok: true; value: BusinessSettings}
  | {ok: false; errors: SettingsErrors} {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown> : {};
  const value = {...emptySettings};
  const errors: SettingsErrors = {};
  for (const field of Object.keys(labels) as BusinessField[]) {
    const raw = source[field];
    const text = typeof raw === 'string' ? raw.trim() : '';
    const max = field === 'name' ? 80 : 300;
    if (text.length < 2 || text.length > max) {
      errors[field] = `${labels[field]} deve ter entre 2 e ${max} caracteres.`;
    } else {
      value[field] = text;
    }
  }
  return Object.keys(errors).length ? {ok: false, errors} : {ok: true, value};
}

export function faqForSettings(settings: BusinessSettings) {
  return [
    {question: 'Horário de atendimento', answer: settings.hours},
    {question: 'Formas de pagamento', answer: settings.payments},
    {question: 'Prazo dos óculos', answer: settings.delivery},
    {question: 'Endereço da ótica', answer: settings.address},
  ];
}
