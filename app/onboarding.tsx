import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { validateApiKey } from '../services/geminiService';
import { saveApiKey } from '../services/secureStorage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { updateAppSettings } from '../utilities/settings';

export default function OnboardingScreen() {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleValidateAndContinue = async () => {
    if (!apiKey.trim()) {
      setError("API Key cannot be empty.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const isValid = await validateApiKey(apiKey);
      if (isValid) {
        await saveApiKey(apiKey);
        
        await updateAppSettings({ hasCompletedOnboarding: true });
        
        router.replace('/');
      } else {
        setError("Invalid API key. The server returned a blank response.");
      }
    } catch (e: any) {
      setError(`Error: ${e.message || String(e)}`);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Keep existing preferences, but record that the user elected to use the app without a key.
      await updateAppSettings({ hasCompletedOnboarding: true });
      router.replace('/');
    } catch (e) {
      setError('Unable to save setup. Please try again.');
      console.error(e);
    }
  };

  const openAIStudio = () => {
    Linking.openURL('https://aistudio.google.com/app/apikey');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Welcome to ProofPal</Text>
            <Text style={styles.subtitle}>Your AI study buddy for math proofs</Text>
          </View>

        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>{'Let\'s get set up'}</Text>
          
          <View style={styles.stepCard}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepText}>
              Go to{' '}
              <Text style={styles.link} onPress={openAIStudio}>aistudio.google.com</Text>
              {' '}and sign in with your Google account
            </Text>
          </View>
          
          <View style={styles.stepCard}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepText}>{'Click "Get API key" in the left sidebar'}</Text>
          </View>
          
          <View style={styles.stepCard}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepText}>{'Click "Create API key" and copy it'}</Text>
          </View>
          
          <View style={styles.stepCard}>
            <Text style={styles.stepNumber}>4</Text>
            <Text style={styles.stepText}>Paste it below</Text>
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Paste your Gemini API key here..."
            placeholderTextColor={COLORS.textMuted}
            value={apiKey}
            onChangeText={(text) => {
              setApiKey(text);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleValidateAndContinue}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Validate & Continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isLoading}
        >
          <Text style={styles.skipButtonText}>Skip for now (App will be view-only)</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  scrollContent: {
    padding: SPACING.xl,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  instructionsContainer: {
    marginBottom: SPACING.xl,
  },
  instructionsTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgCard,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: 'bold',
    marginRight: SPACING.md,
  },
  stepText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  inputContainer: {
    marginBottom: SPACING.xl,
  },
  input: {
    backgroundColor: COLORS.bgSurface,
    color: COLORS.textPrimary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  skipButton: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  skipButtonText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
});
