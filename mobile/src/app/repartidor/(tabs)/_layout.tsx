import { Tabs } from 'expo-router/js-tabs';
import { Bike, History, UserRound } from 'lucide-react-native';
import { colors, fonts } from '~/theme/tokens';

export default function CourierTabs() {
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
      <Tabs.Screen name="index" options={{ title: 'Entregas', tabBarIcon: ({ color, size }) => <Bike color={color} size={size} /> }} />
      <Tabs.Screen name="historial" options={{ title: 'Historial', tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
