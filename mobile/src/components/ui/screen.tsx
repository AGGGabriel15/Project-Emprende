import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { use } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
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
  // El pie y el final del scroll respetan la barra de navegación del sistema.
  const insets = useSafeAreaInsets();
  // Dentro de pestañas la barra de pestañas ya ocupa ese espacio.
  const inTabs = use(BottomTabBarHeightContext) !== undefined;
  const bottom = edges.includes('bottom') || inTabs ? 0 : insets.bottom;
  return (
    <SafeAreaView edges={edges} style={styles.root}>
      <KeyboardAvoidingView style={styles.root} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, !footer && { paddingBottom: 40 + bottom }, contentStyle]}
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
        {footer && <View style={[styles.footer, { paddingBottom: 12 + Math.max(bottom, 4) }]}>{footer}</View>}
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
  },
});
