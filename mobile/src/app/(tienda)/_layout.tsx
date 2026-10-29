import { Tabs } from 'expo-router/js-tabs';
import { Home, Package, Search, ShoppingBag, User } from 'lucide-react-native';
import { cartCount, useCart } from '@/features/cart/store';
import { colors, fonts } from '~/theme/tokens';

export default function StoreTabs() {
  const count = useCart((s) => cartCount(s.items));
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
      <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="buscar" options={{ title: 'Buscar', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tabs.Screen name="carrito" options={{ title: 'Carrito', tabBarBadge: count || undefined, tabBarBadgeStyle: { backgroundColor: colors.brote, fontFamily: fonts.sansBold }, tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }} />
      <Tabs.Screen name="pedidos" options={{ title: 'Pedidos', tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }} />
      <Tabs.Screen name="cuenta" options={{ title: 'Cuenta', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
