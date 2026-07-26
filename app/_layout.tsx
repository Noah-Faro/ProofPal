import 'react-native-url-polyfill/auto';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function checkStatus() {
      try {
        const settingsJson = await AsyncStorage.getItem('proofpal_settings');
        const settings = settingsJson ? JSON.parse(settingsJson) : {};
        const isCompleted = settings.hasCompletedOnboarding;
        
        if (!isCompleted) {
          // Only redirect to onboarding on initial launch if not completed
          router.replace('/onboarding');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsReady(true);
      }
    }
    checkStatus();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
