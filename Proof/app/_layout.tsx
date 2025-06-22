import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/services/supabase';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();

  const [appReady, setAppReady] = useState(false);
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    let subscription: ReturnType<typeof supabase.auth.onAuthStateChange>['data']['subscription'];

    const initializeApp = async () => {
      try {
        if (!fontsLoaded) return;

        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();
        const inAuthGroup = segments[0] === '(auth)';

        // Handle initial routing
        if (session && inAuthGroup) {
          router.replace('/');
        } else if (!session && !inAuthGroup) {
          router.replace('/signin');
        }

        // Listen for future auth changes
        const authListener = supabase.auth.onAuthStateChange((_event, session) => {
          const currentInAuthGroup = segments[0] === '(auth)';

          if (session && currentInAuthGroup) {
            router.replace('/');
          } else if (!session && !currentInAuthGroup) {
            router.replace('/signin');
          }
        });

        subscription = authListener.data.subscription;

        setAppReady(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };

    initializeApp();

    return () => {
      subscription?.unsubscribe();
    };
  }, [fontsLoaded, segments]);

  if (!appReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <Slot />
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
