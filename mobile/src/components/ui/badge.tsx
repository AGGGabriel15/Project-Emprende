import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radius } from '~/theme/tokens';
import { Text } from './text';

const TONES = {
  brand: { bg: colors.niebla, fg: colors.catarina },
  green: { bg: colors.niebla, fg: colors.catarina },
  amber: { bg: colors.warningSoft, fg: colors.warning },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  violet: { bg: colors.violetSoft, fg: colors.violet },
  blue: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.muted, fg: colors.mutedForeground },
  solid: { bg: colors.catarina, fg: colors.white },
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({ children, tone = 'brand', icon: Icon }: { children: React.ReactNode; tone?: BadgeTone; icon?: LucideIcon }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      {Icon && <Icon size={12} color={t.fg} strokeWidth={2.4} />}
      <Text style={[styles.text, { color: t.fg }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontFamily: fonts.sansMedium, fontSize: 12, lineHeight: 16 },
});
