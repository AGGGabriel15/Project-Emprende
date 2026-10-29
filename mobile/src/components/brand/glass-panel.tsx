import { BlurView } from 'expo-blur';
import type { ComponentRef, RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius } from '~/theme/tokens';

/**
 * Panel de vidrio esmerilado (glassmorphism) con tinte verde Bosque, como la
 * portada del web. En Android el desenfoque necesita el BlurTargetView que
 * envuelve la foto (`target`).
 */
export function GlassPanel({
  children,
  target,
  style,
}: {
  children: React.ReactNode;
  target?: RefObject<ComponentRef<typeof View> | null>;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.panel, style]}>
      <BlurView
        intensity={Platform.OS === 'android' ? 40 : 28}
        tint="dark"
        blurTarget={target}
        blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  tint: { backgroundColor: 'rgba(14,59,39,0.28)' },
  content: { padding: 20, gap: 12 },
});
