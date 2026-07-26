import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, useWindowDimensions, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DropZone } from '../components/DropZone';
import { DepthPicker } from '../components/DepthPicker';
import { SubjectPicker } from '../components/SubjectPicker';
import { ExerciseContextPanel } from '../components/ExerciseContext';
import { ModelBadge } from '../components/ModelBadge';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { checkProof } from '../services/geminiService';
import { prepareImageForApi } from '../utilities/imageHelper';
import { PedagogicalDepth, GeminiModel, ExerciseContext, ProofCheckResult } from '../models/types';
import { getSubjectById } from '../models/subjects';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export default function MainScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  
  const [proofImageUri, setProofImageUri] = useState<string | undefined>();
  const [result, setResult] = useState<ProofCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [depth, setDepth] = useState<PedagogicalDepth>(PedagogicalDepth.GUIDE);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH_20);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
  const [exerciseContext, setExerciseContext] = useState<ExerciseContext>({});

  // Detect layout based on width (iPad Split View detection)
  const isLandscapeOrWide = width >= 768; // Roughly iPad portrait width or more

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settingsJson = await AsyncStorage.getItem('proofpal_settings');
        if (settingsJson) {
          const settings = JSON.parse(settingsJson);
          if (settings.selectedModel) setSelectedModel(settings.selectedModel);
          if (settings.selectedDepth) setDepth(settings.selectedDepth);
          if (settings.selectedSubjectId) setSelectedSubjectId(settings.selectedSubjectId);
        }
      } catch (e) {
        console.error('Failed to load settings', e);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (newSettings: any) => {
    try {
      const currentSettingsJson = await AsyncStorage.getItem('proofpal_settings');
      const currentSettings = currentSettingsJson ? JSON.parse(currentSettingsJson) : {};
      await AsyncStorage.setItem('proofpal_settings', JSON.stringify({ ...currentSettings, ...newSettings }));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  };

  const handleModelChange = (model: GeminiModel) => {
    setSelectedModel(model);
    saveSettings({ selectedModel: model });
  };

  const handleDepthChange = (newDepth: PedagogicalDepth) => {
    setDepth(newDepth);
    saveSettings({ selectedDepth: newDepth });
  };

  const handleSubjectChange = (subjectId: string | undefined) => {
    setSelectedSubjectId(subjectId);
    saveSettings({ selectedSubjectId: subjectId });
  };

  const handleCheckProof = async () => {
    if (!proofImageUri) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const proofImageBase64 = await prepareImageForApi(proofImageUri);
      const subject = selectedSubjectId ? getSubjectById(selectedSubjectId) : undefined;
      
      const checkResult = await checkProof({
        proofImageBase64,
        depth,
        model: selectedModel,
        subject,
        exerciseContext
      });
      
      setResult(checkResult);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "An error occurred while checking the proof.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Text style={styles.title}>ProofPal</Text>
        <TouchableOpacity onPress={() => router.push('/settings')}>
          <ModelBadge model={selectedModel} />
        </TouchableOpacity>
      </View>

      <View style={[styles.mainContent, isLandscapeOrWide ? styles.rowLayout : styles.columnLayout]}>
        {/* Left/Top Section (Controls) */}
        <View style={[styles.controlsSection, isLandscapeOrWide && { flex: 1 }]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <DropZone onImageReceived={(uri) => setProofImageUri(uri)} currentImage={proofImageUri} onClear={() => setProofImageUri(undefined)} />
            </View>
            
            <View style={styles.section}>
              <DepthPicker selectedDepth={depth} onDepthChange={handleDepthChange} />
            </View>
            
            <View style={styles.section}>
              <SubjectPicker selectedSubjectId={selectedSubjectId} onSubjectChange={handleSubjectChange} />
            </View>
            
            <View style={styles.section}>
              <ExerciseContextPanel exerciseContext={exerciseContext} onUpdate={setExerciseContext} />
            </View>
            
            <TouchableOpacity 
              style={[styles.checkButton, (!proofImageUri || isLoading) && styles.checkButtonDisabled]}
              onPress={handleCheckProof}
              disabled={!proofImageUri || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkButtonText}>✨ Check Proof</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Right/Bottom Section (Feedback) */}
        <View style={[styles.feedbackSection, isLandscapeOrWide && { flex: 1 }]}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : (
            <FeedbackPanel result={result} isLoading={isLoading} />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgDark,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  mainContent: {
    flex: 1,
  },
  rowLayout: {
    flexDirection: 'row',
  },
  columnLayout: {
    flexDirection: 'column',
  },
  controlsSection: {
    padding: SPACING.md,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  feedbackSection: {
    padding: SPACING.md,
    backgroundColor: COLORS.bgCard,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  checkButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  checkButtonDisabled: {
    backgroundColor: COLORS.bgSurface,
    opacity: 0.7,
    shadowOpacity: 0,
    elevation: 0,
  },
  checkButtonText: {
    color: '#fff',
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
  },
  errorContainer: {
    padding: SPACING.xl,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
});
