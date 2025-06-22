export default {
  expo: {
    name: "Proof",
    slug: "Proof",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "proof",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff",
      },
      edgeToEdgeEnabled: true,
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      ANON_PUBLIC_KEY: process.env.ANON_PUBLIC_KEY,
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL,
      SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
      eas: {
        projectId: "b435d21c-5ce2-4d2a-911a-5104207a163a", // ✅ REQUIRED for push notifications
      },
    },
  },
};
