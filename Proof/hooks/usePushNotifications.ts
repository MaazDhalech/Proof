import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../services/supabase";

export interface PushNotificationState {
  expoPushToken?: string;
  notification?: Notifications.Notification;
}

export const usePushNotifications = (): PushNotificationState => {
  const [expoPushToken, setExpoPushToken] = useState<string>();
  const [notification, setNotification] = useState<Notifications.Notification>();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  async function registerForPushNotificationsAsync() {
    console.log("📲 Starting push notification registration...");

    if (!Device.isDevice) {
      alert("Must use physical device for push notifications.");
      console.warn("❌ Not a physical device");
      return;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      alert("Failed to get push token for notifications.");
      console.warn("❌ Notification permissions not granted");
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn("❌ Missing EAS project ID in app config");
      return;
    }

    console.log("📡 Fetching Expo push token...");
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
      const token = tokenResponse.data;
      console.log("✅ Push token fetched:", token);
      setExpoPushToken(token);

      // Get current user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("❌ No authenticated user found:", authError);
        return;
      }

      console.log("👤 Saving push token for user ID:", user.id);
      const { error } = await supabase
        .from("profile")
        .update({ expo_push_token: token })
        .eq("id", user.id);

      if (error) {
        console.error("❌ Failed to save token to Supabase:", error);
      } else {
        console.log("✅ Expo push token saved to Supabase profile!");
      }
    } catch (err) {
      console.error("❌ Error fetching push token:", err);
    }
  }

  useEffect(() => {
    console.log("🔁 usePushNotifications mounted");
    registerForPushNotificationsAsync();

    notificationListener.current = Notifications.addNotificationReceivedListener((n) => {
      console.log("🔔 Notification received:", n);
      setNotification(n);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("📨 Notification tapped:", response);
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  return { expoPushToken, notification };
};
