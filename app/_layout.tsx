import 'react-native-url-polyfill/auto';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { hasApiKey } from '../services/secureStorage';
import { COLORS } from '../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function checkStatus() {
      try {
        const hasKey = await hasApiKey();
        const settingsJson = await AsyncStorage.getItem('proofpal_settings');
        const settings = settingsJson ? JSON.parse(settingsJson) : {};
        const isCompleted = hasKey && settings.hasCompletedOnboarding;
        setOnboarded(!!isCompleted);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setIsReady(true);
      }
    }
    checkStatus();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inOnboardingGroup = segments[0] === 'onboarding';

    if (!onboarded && !inOnboardingGroup) {
      // Redirect to onboarding if not onboarded and not already there
      router.replace('/onboarding');
    } else if (onboarded && inOnboardingGroup) {
      // Go to main app if onboarded but still in onboarding
      router.replace('/');
    }
  }, [isReady, onboarded, segments, router]);

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
