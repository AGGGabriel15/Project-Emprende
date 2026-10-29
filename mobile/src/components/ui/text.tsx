import { Text as RNText, type TextProps } from 'react-native';
import { colors, fonts } from '~/theme/tokens';

const VARIANTS = {
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  smallMedium: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 2, textTransform: 'uppercase' as const },
  price: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
} as const;

const TONES = {
  default: colors.foreground,
  muted: colors.mutedForeground,
  primary: colors.primary,
  white: colors.white,
  danger: colors.danger,
  warning: colors.warning,
} as const;

export type TextVariant = keyof typeof VARIANTS;

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: keyof typeof TONES }) {
  return <RNText {...props} style={[VARIANTS[variant], { color: TONES[tone] }, style]} />;
}
