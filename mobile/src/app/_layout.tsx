import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { colors } from '@/constants/theme';
import { SessionProvider, useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function WhenReady({ children }: { children: ReactNode }) {
  const { ready } = useSession();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  return ready ? <>{children}</> : null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <WhenReady>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerTintColor: colors.text,
              headerTitleStyle: { fontWeight: '700' },
              headerBackTitle: 'Retour',
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Accueil' }} />
            <Stack.Screen name="search" options={{ title: 'Recherche' }} />
            <Stack.Screen name="product/[platform]/[itemId]" options={{ title: 'Article' }} />
            <Stack.Screen name="link" options={{ title: 'Coller un lien', presentation: 'modal' }} />
            <Stack.Screen name="login" options={{ title: 'Connexion', presentation: 'modal' }} />
            <Stack.Screen name="otp" options={{ title: 'Code', presentation: 'modal' }} />
            <Stack.Screen name="profile" options={{ title: 'Profil et sécurité' }} />
            <Stack.Screen name="checkout" options={{ title: 'Confirmer la commande' }} />
            <Stack.Screen name="orders/index" options={{ title: 'Mes commandes' }} />
            <Stack.Screen name="orders/[id]" options={{ title: 'Commande' }} />
            <Stack.Screen name="parcels/index" options={{ title: 'Mes colis' }} />
            <Stack.Screen name="parcels/new" options={{ title: 'Créer un colis' }} />
            <Stack.Screen name="parcels/[id]" options={{ title: 'Colis' }} />
            <Stack.Screen name="estimate" options={{ title: 'Estimer les frais de port' }} />
            <Stack.Screen name="wallet" options={{ title: 'Portefeuille' }} />
            <Stack.Screen name="addresses" options={{ title: 'Mes adresses' }} />
            <Stack.Screen name="coupons" options={{ title: 'Coupons' }} />
            <Stack.Screen name="favorites" options={{ title: 'Favoris' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="forwarding" options={{ title: 'Transfert de colis' }} />
            <Stack.Screen name="settings" options={{ title: 'Réglages' }} />
            <Stack.Screen name="help" options={{ title: 'Comment ça marche' }} />
          </Stack>
        </WhenReady>
      </SessionProvider>
    </QueryClientProvider>
  );
}
