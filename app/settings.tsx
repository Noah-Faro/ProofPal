import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiKey, deleteApiKey } from '../services/secureStorage';
import { GEMINI_MODELS } from '../models/geminiModels';
import { GeminiModel } from '../models/types';
import { ModelBadge } from '../components/ModelBadge';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH_36);
  const [apiKeyPreview, setApiKeyPreview] = useState<string>('Not set');

  useEffect(() => {
    loadSettings();
    loadApiKeyPreview();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem('proofpal_settings');
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        if (settings.selectedModel) {
          setSelectedModel(settings.selectedModel);
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const loadApiKeyPreview = async () => {
    const key = await getApiKey();
    if (key) {
      setApiKeyPreview(`${key.substring(0, 8)}...${key.substring(key.length - 4)}`);
    } else {
      setApiKeyPreview('Not set');
    }
  };

  const saveModel = async (model: GeminiModel) => {
    setSelectedModel(model);
    try {
      const currentSettingsJson = await AsyncStorage.getItem('proofpal_settings');
      const currentSettings = currentSettingsJson ? JSON.parse(currentSettingsJson) : {};
      await AsyncStorage.setItem('proofpal_settings', JSON.stringify({ ...currentSettings, selectedModel: model }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  const handleChangeKey = () => {
    Alert.alert(
      "Change API Key",
      "Are you sure you want to change your API key? You will be redirected to the onboarding screen.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Change Key", 
          onPress: async () => {
            await deleteApiKey();
            router.replace('/onboarding');
          } 
        }
      ]
    );
  };

  const handleDeleteKey = () => {
    Alert.alert(
      "Delete API Key",
      "This will remove your API key and redirect you to onboarding. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            await deleteApiKey();
            try {
              const currentSettingsJson = await AsyncStorage.getItem('proofpal_settings');
              const currentSettings = currentSettingsJson ? JSON.parse(currentSettingsJson) : {};
              await AsyncStorage.setItem('proofpal_settings', JSON.stringify({ ...currentSettings, hasCompletedOnboarding: false }));
            } catch (e) {
              console.error(e);
            }
            router.replace('/onboarding');
          } 
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Model Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Model</Text>
          <View style={styles.card}>
            {Object.values(GEMINI_MODELS).map((model) => {
              const isSelected = selectedModel === model.model;
              return (
                <TouchableOpacity 
                  key={model.model} 
                  style={[styles.modelRow, isSelected && styles.modelRowSelected]}
                  onPress={() => saveModel(model.model)}
                >
                  <View style={styles.modelRowContent}>
                    <View style={styles.modelHeader}>
                      <Text style={styles.modelName}>{model.label}</Text>
                      <ModelBadge model={model.model} />
                    </View>
                    <Text style={styles.modelDescription}>{model.description}</Text>
                  </View>
                  <View style={styles.radio}>
                    {isSelected && <View style={styles.radioSelected} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* API Key Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Key</Text>
          <View style={styles.card}>
            <View style={styles.keyPreviewRow}>
              <Text style={styles.keyLabel}>Current Key:</Text>
              <Text style={styles.keyValue}>{apiKeyPreview}</Text>
            </View>
            <View style={styles.keyActionRow}>
              <TouchableOpacity style={styles.keyButton} onPress={handleChangeKey}>
                <Text style={styles.keyButtonText}>Change Key</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.keyButton, styles.keyButtonDanger]} onPress={handleDeleteKey}>
                <Text style={styles.keyButtonTextDanger}>Delete Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <Text style={styles.aboutTitle}>ProofPal v1.0</Text>
            <Text style={styles.aboutText}>
              Your AI math proof checker companion. Designed for iPad Split View to work alongside note-taking apps like Goodnotes.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: SPACING.sm,
    flex: 1,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    flex: 2,
    textAlign: 'center',
  },
  headerRight: {
    flex: 1,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textMuted,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  modelRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modelRowSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  modelRowContent: {
    flex: 1,
  },
  modelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modelName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  modelDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  keyPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  keyLabel: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textPrimary,
  },
  keyValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
  },
  keyActionRow: {
    flexDirection: 'row',
    padding: SPACING.md,
    justifyContent: 'space-around',
  },
  keyButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  keyButtonDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  keyButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  keyButtonTextDanger: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  aboutTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    padding: SPACING.md,
    paddingBottom: 0,
  },
  aboutText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
    padding: SPACING.md,
    lineHeight: 22,
  },
});
