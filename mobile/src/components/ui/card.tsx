import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadow } from '~/theme/tokens';
import { Text } from './text';

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, padded && styles.padded, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

/** Título de sección con acción opcional a la derecha. */
export function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" style={styles.sectionTitle}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/** Fila etiqueta–valor (resúmenes de pedido, datos del negocio). */
export function InfoRow({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      {typeof value === 'string' ? (
        <Text variant={strong ? 'bodyMedium' : 'small'} style={styles.rowValue}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  padded: { padding: 16 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  sectionTitle: { flex: 1 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingVertical: 4 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
