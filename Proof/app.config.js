
export default {
  "expo": {
    "name": "Proof",
    "slug": "Proof",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "proof",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra":{
      ANON_PUBLIC_KEY: process.env.ANON_PUBLIC_KEY,
      SUPABASE_URL: process.env.SUPABASE_URL,
      LETTA_CHATBOT_MODEL: process.env.LETTA_CHATBOT_MODEL,
      LETTA_API_KEY: process.env.LETTA_API_KEY,
      LETTA_IMAGE_VERIFIER_MODEL: process.env.LETTA_IMAGE_VERIFIER_MODEL

    }
  }
}
