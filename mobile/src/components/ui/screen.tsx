import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '~/theme/tokens';

/**
 * Contenedor de pantalla: fondo de la marca, scroll con "deslizar para
 * actualizar" en verde Catarina y el teclado nunca tapa los campos.
 */
export function Screen({
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
  edges = [],
  contentStyle,
  footer,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Barra fija abajo (p. ej. "Pagar"), siempre por encima del teclado. */
  footer?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.catarina} colors={[colors.catarina]} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, contentStyle]}>{children}</View>
        )}
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
});
