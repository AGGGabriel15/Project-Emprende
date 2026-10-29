import { ScrollView, StyleSheet, View, KeyboardAvoidingView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '~/components/brand/logo';
import { PatternBackground } from '~/components/brand/pattern';
import { Text } from '~/components/ui/text';
import { colors, radius, shadow } from '~/theme/tokens';

/** Marco de login y registro: cabecera verde con el patrón y tarjeta blanca encima. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} bounces={false}>
        <View style={[styles.hero, { paddingTop: insets.top + 28 }]}>
          <PatternBackground variant="green" />
          <View style={styles.logo}>
            <Logo tone="negative" height={46} />
          </View>
        </View>
        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.card}>
          <View style={styles.heading}>
            <Text variant="title" style={styles.center}>
              {title}
            </Text>
            {description && (
              <Text variant="small" tone="muted" style={styles.center}>
                {description}
              </Text>
            )}
          </View>
          {children}
        </Animated.View>
        {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  hero: { height: 230, alignItems: 'center', justifyContent: 'flex-start', overflow: 'hidden' },
  logo: { zIndex: 1 },
  card: {
    marginTop: -64,
    marginHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    gap: 16,
    ...shadow.raised,
  },
  heading: { gap: 6, alignItems: 'center' },
  center: { textAlign: 'center' },
  footer: { alignItems: 'center', gap: 10, paddingTop: 20, paddingHorizontal: 16 },
});
