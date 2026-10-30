import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ClipboardList, LayoutDashboard, Package, Store } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { isActiveBusiness, useMyBusiness, useVendorBoard } from '~/features/vendor/queries';
import { colors, fonts } from '~/theme/tokens';

/** Contador de la pestaña: fuente del sistema y alto de línea fijo para que el número quede centrado. */
const BADGE = { backgroundColor: colors.brote, fontSize: 11, lineHeight: 18, minWidth: 18, height: 18, includeFontPadding: false, textAlignVertical: 'center' } as const;

/** Panel del negocio aprobado (o suspendido, solo lectura). Sin negocio activo, a la solicitud. */
export default function VendorTabs() {
  const business = useMyBusiness();
  const board = useVendorBoard(isActiveBusiness(business.data) ? business.data!.id : undefined);
  const preparing = board.data?.active.filter((o) => o.status === 'preparing').length ?? 0;

  // isPending (no isLoading): sin sesión la consulta queda en espera y no debe
  // tomarse como "sin negocio" (eso mandaba un instante a la solicitud).
  if (business.isPending) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.catarina} size="large" />
      </View>
    );
  }
  if (!isActiveBusiness(business.data)) return <Redirect href="/vendedor/solicitud" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.catarina,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="panel" options={{ title: 'Panel', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarBadge: preparing || undefined,
          tabBarBadgeStyle: BADGE,
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="productos" options={{ title: 'Productos', tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }} />
      <Tabs.Screen name="negocio" options={{ title: 'Mi negocio', tabBarIcon: ({ color, size }) => <Store color={color} size={size} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
