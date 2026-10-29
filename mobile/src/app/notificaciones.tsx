import { Stack, useRouter, type Href } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { formatDate } from '@/lib/format';
import { EmptyState, Skeleton } from '~/components/ui/feedback';
import { Screen } from '~/components/ui/screen';
import { Text } from '~/components/ui/text';
import { useMarkNotificationsRead, useNotifications } from '~/features/account/notifications';
import { colors, radius } from '~/theme/tokens';

/** Enlaces de las notificaciones: son las mismas rutas del web (salvo las del admin). */
export function openNotificationLink(router: ReturnType<typeof useRouter>, link: string | null | undefined) {
  if (!link || !link.startsWith('/') || link.startsWith('/admin')) return;
  router.push(link as Href);
}

export default function NotificationsScreen() {
  const router = useRouter();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const unread = notifications.data?.some((n) => !n.read_at);

  // Al abrir la pantalla quedan leídas (como la campana del web).
  useEffect(() => {
    if (unread) markRead.mutate();
  }, [unread, markRead]);

  return (
    <Screen refreshing={notifications.isRefetching} onRefresh={notifications.refetch}>
      <Stack.Screen options={{ title: 'Notificaciones' }} />
      {notifications.isLoading ? (
        <Skeleton height={80} />
      ) : notifications.data?.length ? (
        notifications.data.map((n, i) => (
          <Animated.View key={n.id} entering={FadeInDown.delay(Math.min(i, 8) * 40)}>
            <Pressable onPress={() => openNotificationLink(router, n.link)} style={({ pressed }) => [styles.item, !n.read_at && styles.unread, pressed && styles.pressed]}>
              {!n.read_at && <View style={styles.dot} />}
              <View style={styles.flex}>
                <Text variant="bodyMedium">{n.title}</Text>
                {n.body ? (
                  <Text variant="small" tone="muted">
                    {n.body}
                  </Text>
                ) : null}
                <Text variant="small" tone="muted" style={styles.time}>
                  {formatDate(n.created_at)}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        ))
      ) : (
        <EmptyState icon={Bell} title="Sin notificaciones" description="Aquí verás los avisos de tus pedidos y entregas." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  item: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  unread: { backgroundColor: colors.niebla, borderColor: colors.hojaClara },
  pressed: { opacity: 0.85 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brote, marginTop: 7 },
  time: { fontSize: 11 },
});
