import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '~/theme/tokens';

/**
 * Contador redondo (campana, pestañas, menús). Usa la fuente del sistema con
 * altura de línea igual al círculo y sin el relleno de fuente de Android, para
 * que el número quede centrado (con DM Sans se veía corrido).
 */
export function CountBadge({
  count,
  size = 20,
  tone = 'brote',
  style,
}: {
  count: number;
  size?: number;
  tone?: 'brote' | 'white' | 'soft';
  style?: StyleProp<ViewStyle>;
}) {
  if (!count) return null;
  const bg = tone === 'white' ? colors.white : tone === 'soft' ? colors.niebla : colors.brote;
  const fg = tone === 'brote' ? colors.white : colors.catarina;
  return (
    <View style={[styles.badge, { minWidth: size, height: size, borderRadius: size / 2, backgroundColor: bg }, style]}>
      <Text style={[styles.text, { fontSize: Math.round(size * 0.55), lineHeight: size, color: fg }]} allowFontScaling={false}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  text: { fontWeight: '700', textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
});
