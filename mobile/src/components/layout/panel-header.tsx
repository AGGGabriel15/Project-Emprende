import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Logo } from '~/components/brand/logo';
import { CountBadge } from '~/components/ui/count-badge';
import { Text } from '~/components/ui/text';
import { useNotifications } from '~/features/account/notifications';
import { colors } from '~/theme/tokens';

/** Encabezado de los paneles (repartidor y vendedor): logo, saludo y campana. */
export function PanelHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const router = useRouter();
  const notifications = useNotifications();
  const unread = notifications.data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Logo height={30} />
        <Pressable onPress={() => router.push('/notificaciones')} hitSlop={8} accessibilityLabel={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} style={styles.bell}>
          <Bell size={22} color={colors.foreground} />
          <CountBadge count={unread} size={18} style={styles.badge} />
        </Pressable>
      </View>
      <View>
        <Text variant="title">{title}</Text>
        {subtitle && (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 2, right: 0 },
});
