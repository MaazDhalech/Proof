import { Tabs, router } from "expo-router";
import React, { useEffect, useState } from "react";

import { HapticTab } from "@/components/HapticTab";
import { IconSymbol } from "@/components/ui/IconSymbol";
import TabBarBackground from "@/components/ui/TabBarBackground";
import { useColorScheme } from "@/hooks/useColorScheme";
import { supabase } from "@/services/supabase";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        if (__DEV__)
          console.warn("User not authenticated, redirecting to /signin");
        router.replace("/(auth)/signin");
      } else {
        setAuthChecked(true);
      }
    };

    checkAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace("/(auth)/signin");
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!authChecked) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffffff", // Pure white for active tabs
        tabBarInactiveTintColor: "#666666", // Subtle gray for inactive tabs
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          backgroundColor: "#000000", // Pure black background
          borderTopWidth: 0, // Remove top border
          paddingTop: 8, // Add some top padding
          paddingBottom: 8, // Add bottom padding for better spacing
          height: 88, // Slightly taller for better proportions
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          elevation: 8, // Android shadow
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600", // Semi-bold for better readability
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 30 : 28} 
              name="house.fill" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: "Goals",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 30 : 28} 
              name="target" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="proofs"
        options={{
          title: "Proofs",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 30 : 28} 
              name="checkmark.seal.fill" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 30 : 28} 
              name="person.2.fill" 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol 
              size={focused ? 30 : 28} 
              name="person.fill" 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}