import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { colors } from '@/constants/theme';
import { useMe } from '@/lib/session';

type IconName = ComponentProps<typeof Ionicons>['name'];

type TabIconProps = { color: ColorValue; size: number; focused: boolean };

function TabIcon({ name, focusedName, color, size, focused }: TabIconProps & { name: IconName; focusedName: IconName }) {
  return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
}

const icon = (name: IconName, focusedName: IconName) =>
  function TabBarIcon(props: TabIconProps) {
    return <TabIcon name={name} focusedName={focusedName} {...props} />;
  };

export default function TabsLayout() {
  const { data } = useMe();
  const cartCount = data?.summary.cart ?? 0;
  const warehouseCount = data?.summary.warehouseItems ?? 0;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', headerShown: false, tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="categories" options={{ title: 'Catégories', tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Panier', tabBarIcon: icon('cart-outline', 'cart'), tabBarBadge: cartCount ? cartCount : undefined }}
      />
      <Tabs.Screen
        name="warehouse"
        options={{ title: 'Entrepôt', tabBarIcon: icon('cube-outline', 'cube'), tabBarBadge: warehouseCount ? warehouseCount : undefined }}
      />
      <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: icon('person-outline', 'person') }} />
    </Tabs>
  );
}
