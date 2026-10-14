import "../../global.css";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initializeDatabase } from "../db/client";
import { useSuryoyeTheme } from "../theme/colors";

export default function RootLayout() {
  const theme = useSuryoyeTheme();
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    "NotoSansSyriacWestern-Regular": require("../../assets/fonts/NotoSansSyriacWestern-Regular.ttf"),
    "NotoSansSyriacWestern-Bold": require("../../assets/fonts/NotoSansSyriacWestern-Bold.ttf"),
    "NotoSans-Regular": require("../../assets/fonts/NotoSans-Regular.ttf"),
    "NotoSans-Bold": require("../../assets/fonts/NotoSans-Bold.ttf"),
  });

  useEffect(() => {
    let mounted = true;
    initializeDatabase()
      .then(() => {
        if (mounted) setDbReady(true);
      })
      .catch((err) => {
        console.error("Fout bij initialiseren van surayt.db:", err);
        if (mounted) setDbError(String(err));
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (dbError) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: theme.background }]}>
        <Text style={{ color: theme.error, fontSize: 16, textAlign: "center", padding: 24 }}>
          Database fout: {dbError}
        </Text>
      </View>
    );
  }

  if (!fontsLoaded || !dbReady) {
    return (
      <View style={[styles.centerScreen, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>
          Šlomo Surayt wordt geladen...
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: "fade_from_bottom",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    marginTop: 14,
    fontSize: 15,
    fontWeight: "600",
  },
});
