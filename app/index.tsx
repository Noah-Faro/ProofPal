import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, useWindowDimensions, ScrollView, ActivityIndicator } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { DropZone } from '../components/DropZone';
import { DepthPicker } from '../components/DepthPicker';
import { SubjectPicker } from '../components/SubjectPicker';
import { ExerciseContextPanel } from '../components/ExerciseContext';
import { ModelBadge } from '../components/ModelBadge';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { ErrorDialog } from '../components/ErrorDialog';
import { checkProof } from '../services/geminiService';
import { prepareImageForApi } from '../utilities/imageHelper';
import { DEFAULT_APP_SETTINGS, loadAppSettings, updateAppSettings } from '../utilities/settings';
import { GeminiModel, type AppSettings, PedagogicalDepth } from '../models/types';
import type { AppError, LocalAttachment, ProofCheckResult, ProofCheckStage, ProofExerciseContext } from '../types/proof';
import { ProofPalError } from '../types/proof';
import { getSubjectById } from '../models/subjects';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

function toAppError(error: unknown): AppError {
  if (error instanceof ProofPalError) return error;
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    const candidate = error as Partial<AppError>;
    if (typeof candidate.code === 'string' && typeof candidate.message === 'string') {
      return {
        code: candidate.code as AppError['code'],
        message: candidate.message,
        retryable: candidate.retryable === true,
        recoveryAction: candidate.recoveryAction,
      };
    }
  }
  return { code: 'API', message: error instanceof Error ? error.message : 'ProofPal could not check this proof. Please try again.', retryable: true, recoveryAction: 'retry' };
}

export default function MainScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [proofImage, setProofImage] = useState<LocalAttachment | undefined>();
  const [result, setResult] = useState<ProofCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stage, setStage] = useState<ProofCheckStage | undefined>();
  const [error, setError] = useState<AppError | null>(null);
  const [depth, setDepth] = useState<PedagogicalDepth>(PedagogicalDepth.GUIDE);
  const [selectedModel, setSelectedModel] = useState<GeminiModel>(GeminiModel.FLASH_36);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
  const [exerciseContext, setExerciseContext] = useState<ProofExerciseContext>({});
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const hydratedPreferences = useRef<Pick<AppSettings, 'selectedModel' | 'selectedDepth' | 'selectedSubjectId'> | null>(null);

  const isLandscapeOrWide = width >= 768;

  const loadSettings = useCallback(async () => {
    try {
      const next = await loadAppSettings();
      if (!mounted.current) return;
      const changed = hydratedPreferences.current !== null && (
        hydratedPreferences.current.selectedModel !== next.selectedModel ||
        hydratedPreferences.current.selectedDepth !== next.selectedDepth ||
        hydratedPreferences.current.selectedSubjectId !== next.selectedSubjectId
      );
      hydratedPreferences.current = {
        selectedModel: next.selectedModel,
        selectedDepth: next.selectedDepth,
        selectedSubjectId: next.selectedSubjectId,
      };
      setSettings(next);
      setSelectedModel(next.selectedModel);
      setDepth(next.selectedDepth);
      setSelectedSubjectId(next.selectedSubjectId);
      if (changed) {
        setResult(null);
        setError(null);
      }
    } catch {
      if (mounted.current) setSettings(DEFAULT_APP_SETTINGS);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadSettings();
  }, [loadSettings]));

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const clearFeedback = () => {
    setResult(null);
    setError(null);
  };

  const persist = async (update: Partial<AppSettings>) => {
    const next = await updateAppSettings(update);
    if (mounted.current) setSettings(next);
  };

  const handleDepthChange = (nextDepth: PedagogicalDepth) => {
    if (isLoading) return;
    setDepth(nextDepth);
    clearFeedback();
    void persist({ selectedDepth: nextDepth });
  };

  const handleSubjectChange = (subjectId: string | undefined) => {
    if (isLoading) return;
    setSelectedSubjectId(subjectId);
    clearFeedback();
    void persist({ selectedSubjectId: subjectId });
  };

  const handleProofImage = (image: LocalAttachment) => {
    if (isLoading) return;
    setProofImage(image);
    clearFeedback();
  };

  const handleContextUpdate = (nextContext: ProofExerciseContext) => {
    if (isLoading) return;
    setExerciseContext(nextContext);
    clearFeedback();
  };

  const handleCancel = () => {
    requestId.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsLoading(false);
    setStage(undefined);
  };

  const handleCheckProof = async () => {
    if (!proofImage || isLoading) return;
    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const snapshot = {
      proofImage,
      depth,
      model: selectedModel,
      subject: selectedSubjectId ? getSubjectById(selectedSubjectId) : undefined,
      exerciseContext: { ...exerciseContext },
    };

    setIsLoading(true);
    setStage('preparing');
    clearFeedback();
    try {
      const preparedImage = await prepareImageForApi(snapshot.proofImage);
      const checkResult = await checkProof({
        proofImage: preparedImage,
        depth: snapshot.depth,
        model: snapshot.model,
        subject: snapshot.subject,
        exerciseContext: snapshot.exerciseContext,
        signal: controller.signal,
        onStageChange: (nextStage) => {
          if (mounted.current && requestId.current === currentRequest) setStage(nextStage);
        },
      });
      if (mounted.current && requestId.current === currentRequest) setResult(checkResult);
    } catch (caught) {
      const nextError = toAppError(caught);
      if (controller.signal.aborted || nextError.code === 'CANCELLED') return;
      if (mounted.current && requestId.current === currentRequest) setError(nextError);
    } finally {
      if (mounted.current && requestId.current === currentRequest) {
        setIsLoading(false);
        setStage(undefined);
        controllerRef.current = null;
      }
    }
  };

  if (!settings) {
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color={COLORS.primaryLight} /><Text style={styles.loadingText}>Loading ProofPal</Text></SafeAreaView>;
  }
  if (!settings.hasCompletedOnboarding) return <Redirect href="/onboarding" />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>ProofPal</Text>
        <ModelBadge model={selectedModel} onPress={() => router.push('/settings')} disabled={isLoading} />
      </View>
      <View style={[styles.mainContent, isLandscapeOrWide ? styles.rowLayout : styles.columnLayout]}>
        <View style={[styles.controlsSection, isLandscapeOrWide && styles.splitSection]}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <DropZone currentImage={proofImage} onImageReceived={handleProofImage} onClear={() => { setProofImage(undefined); clearFeedback(); }} disabled={isLoading} />
            </View>
            <View style={styles.section}><DepthPicker selectedDepth={depth} onDepthChange={handleDepthChange} disabled={isLoading} /></View>
            <View style={styles.section}><SubjectPicker selectedSubjectId={selectedSubjectId} onSubjectChange={handleSubjectChange} disabled={isLoading} /></View>
            <View style={styles.section}><ExerciseContextPanel exerciseContext={exerciseContext} onUpdate={handleContextUpdate} disabled={isLoading} /></View>
            <TouchableOpacity style={[styles.checkButton, (!proofImage || isLoading) && styles.checkButtonDisabled]} onPress={handleCheckProof} disabled={!proofImage || isLoading} accessibilityRole="button" accessibilityLabel="Check proof">
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>Check Proof</Text>}
            </TouchableOpacity>
            {isLoading && <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel proof check"><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>}
          </ScrollView>
        </View>
        <View style={[styles.feedbackSection, isLandscapeOrWide && styles.splitSection]}>
          <FeedbackPanel result={result} isLoading={isLoading} stage={stage} />
        </View>
      </View>
      <ErrorDialog
        error={error}
        onDismiss={() => setError(null)}
        onRetry={() => { setError(null); void handleCheckProof(); }}
        onAddApiKey={() => { setError(null); router.push('/onboarding'); }}
        onOpenSettings={() => { setError(null); router.push('/settings'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgDark },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary },
  mainContent: { flex: 1 },
  rowLayout: { flexDirection: 'row' },
  columnLayout: { flexDirection: 'column' },
  splitSection: { flex: 1 },
  controlsSection: { padding: SPACING.md },
  scrollContent: { paddingBottom: SPACING.xxl },
  section: { marginBottom: SPACING.lg },
  feedbackSection: { padding: SPACING.md, backgroundColor: COLORS.bgCard, borderLeftWidth: 1, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  checkButton: { minHeight: 52, backgroundColor: COLORS.primary, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  checkButtonDisabled: { backgroundColor: COLORS.bgSurface, opacity: 0.7 },
  checkButtonText: { color: '#fff', fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
});
