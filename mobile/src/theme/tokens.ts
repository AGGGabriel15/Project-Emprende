/**
 * Tokens del manual de identidad de Catarina Market (los mismos del web,
 * src/app/globals.css). Verde Brote solo para la hoja y detalles, nunca textos.
 */
export const colors = {
  catarina: '#1E7A4C',
  bosque: '#0E3B27',
  brote: '#3FA66B',
  niebla: '#E7F2EA',
  hojaClara: '#9BD3AE',

  background: '#F8FBF9',
  card: '#FFFFFF',
  foreground: '#0E3B27',
  muted: '#F0F6F2',
  mutedForeground: '#4A6B5A',
  secondaryForeground: '#2F5442',
  border: '#D6E9DC',
  input: '#A9C7B4',
  primary: '#1E7A4C',
  primaryPressed: '#17643E',
  white: '#FFFFFF',

  warning: '#A86B12',
  warningSoft: '#FCF2DC',
  info: '#2563A8',
  infoSoft: '#E7EFF9',
  violet: '#6B46C1',
  violetSoft: '#F1ECFA',
  danger: '#C2362F',
  dangerSoft: '#FBEAEA',
} as const;

/** Outfit para logotipo, títulos y botones; DM Sans para textos e interfaz. */
export const fonts = {
  display: 'Outfit_600SemiBold',
  displayMedium: 'Outfit_500Medium',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

export const shadow = {
  card: {
    shadowColor: '#0E3B27',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#0E3B27',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;
