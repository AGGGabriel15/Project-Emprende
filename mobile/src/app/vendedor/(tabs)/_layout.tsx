import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { ClipboardList, LayoutDashboard, Package, Store } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { isActiveBusiness, useMyBusiness, useVendorBoard } from '~/features/vendor/queries';
import { colors, fonts } from '~/theme/tokens';

/** Panel del negocio aprobado (o suspendido, solo lectura). Sin negocio activo, a la solicitud. */
export default function VendorTabs() {
  const business = useMyBusiness();
  const board = useVendorBoard(isActiveBusiness(business.data) ? business.data!.id : undefined);
  const preparing = board.data?.active.filter((o) => o.status === 'preparing').length ?? 0;

  if (business.isLoading) {
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
          tabBarBadgeStyle: { backgroundColor: colors.brote, fontFamily: fonts.sansBold },
          tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="productos" options={{ title: 'Productos', tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }} />
      <Tabs.Screen name="negocio" options={{ title: 'Mi negocio', tabBarIcon: ({ color, size }) => <Store color={color} size={size} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
