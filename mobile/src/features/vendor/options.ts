/** Opciones de los formularios del negocio (mismos valores que los esquemas del web). */
export const PERSON_TYPES = [
  { value: 'natural' as const, label: 'Persona natural' },
  { value: 'juridica' as const, label: 'Persona jurídica' },
];

export const TAX_REGIMES = [
  { value: 'cuota_fija' as const, label: 'Cuota fija' },
  { value: 'regimen_general' as const, label: 'Régimen general' },
];

export const ACCOUNT_TYPES = [
  { value: 'ahorro' as const, label: 'Ahorro' },
  { value: 'corriente' as const, label: 'Corriente' },
];

export const CURRENCIES = [
  { value: 'NIO' as const, label: 'Córdobas (NIO)' },
  { value: 'USD' as const, label: 'Dólares (USD)' },
];
