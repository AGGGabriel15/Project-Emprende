import * as Haptics from 'expo-haptics';
import { CircleAlert, CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { colors, radius, shadow } from '~/theme/tokens';
import { Text } from './text';

type Toast = { id: number; message: string; tone: 'success' | 'error' };

const useToasts = create<{ toast: Toast | null; show: (message: string, tone?: Toast['tone']) => void }>((set) => ({
  toast: null,
  show: (message, tone = 'success') => {
    const id = Date.now();
    set({ toast: { id, message, tone } });
    setTimeout(() => set((state) => (state.toast?.id === id ? { toast: null } : state)), 3200);
  },
}));

/** Aviso breve arriba de la pantalla (equivale a los toasts del web). */
export const toast = {
  success: (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useToasts.getState().show(message, 'success');
  },
  error: (message: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    useToasts.getState().show(message, 'error');
  },
};

export function ToastHost() {
  const current = useToasts((state) => state.toast);
  const insets = useSafeAreaInsets();
  if (!current) return null;
  const Icon = current.tone === 'success' ? CircleCheck : CircleAlert;
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View key={current.id} entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp} style={styles.toast}>
        <Icon size={20} color={current.tone === 'success' ? colors.hojaClara : '#FFB4AE'} />
        <Text variant="bodyMedium" tone="white" style={styles.text}>
          {current.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 16, right: 16, zIndex: 50, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 520,
    backgroundColor: colors.bosque,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...shadow.raised,
  },
  text: { flexShrink: 1 },
});
