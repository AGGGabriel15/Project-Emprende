import { X } from 'lucide-react-native';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '~/theme/tokens';
import { IconButton } from './button';
import { Text } from './text';

/**
 * Panel inferior (los diálogos de la app). Va dentro de KeyboardAvoidingView:
 * al escribir, el panel sube por encima del teclado en vez de quedar tapado.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      {open && (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
          </Animated.View>
          <KeyboardAvoidingView behavior="padding" style={styles.avoider} pointerEvents="box-none">
            {/* Sin animación de deslizamiento: el panel aparece ya en su lugar (antes rebotaba y se cortaba). */}
            <View style={[styles.panel, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.handle} />
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text variant="title" style={styles.title}>
                    {title}
                  </Text>
                  {description && (
                    <Text variant="small" tone="muted">
                      {description}
                    </Text>
                  )}
                </View>
                <IconButton icon={X} label="Cerrar" onPress={onClose} />
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} bounces={false}>
                {children}
              </ScrollView>
              {footer && <View style={styles.footer}>{footer}</View>}
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(14,59,39,0.45)' },
  avoider: { flex: 1, justifyContent: 'flex-end' },
  panel: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  headerText: { flex: 1, gap: 4, paddingTop: 4 },
  title: { fontSize: 21 },
  body: { gap: 14, paddingBottom: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 12 },
});
