import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  Switch,
  PanResponder,
} from 'react-native';
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
import { DEFAULT_APP_SETTINGS, loadAppSettings, updateAppSettings, saveHistoryEntry } from '../utilities/settings';
import { GeminiModel, type AppSettings, type HistoryEntry, PedagogicalDepth } from '../models/types';
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
  const { height } = useWindowDimensions();
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
  const [showFeedback, setShowFeedback] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [conciseMode, setConciseMode] = useState(false);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const hydratedPreferences = useRef<Pick<AppSettings, 'selectedModel' | 'selectedDepth' | 'selectedSubjectId'> | null>(null);

  // Bottom sheet animation
  const sheetAnim = useMemo(() => new Animated.Value(0), []);

  const openSheet = () => {
    setShowFeedback(true);
    Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true }).start();
  };

  const closeSheet = () => {
    setShowFeedback(false);
    sheetAnim.setValue(0);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            sheetAnim.setValue(-gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 100) {
            setShowFeedback(false);
            sheetAnim.setValue(0);
          } else {
            Animated.spring(sheetAnim, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      }),
    [sheetAnim],
  );

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

  const handleReset = () => {
    setProofImage(undefined);
    setExerciseContext({});
    setResult(null);
    setError(null);
    closeSheet();
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
    const subject = selectedSubjectId ? getSubjectById(selectedSubjectId) : undefined;
    const snapshot = {
      proofImage,
      depth,
      model: selectedModel,
      subject,
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
        concise: conciseMode,
        thinking: thinkingMode,
        onStageChange: (nextStage) => {
          if (mounted.current && requestId.current === currentRequest) setStage(nextStage);
        },
      });
      if (mounted.current && requestId.current === currentRequest) {
        setResult(checkResult);
        openSheet();
        // Save to history
        const entry: HistoryEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: checkResult.timestamp,
          verdict: checkResult.verdict,
          feedbackMarkdown: checkResult.feedbackMarkdown,
          model: checkResult.model,
          depth: checkResult.depth,
          subjectName: subject?.name,
          exerciseReference: snapshot.exerciseContext.reference,
        };
        void saveHistoryEntry(entry);
      }
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

  const sheetHeight = Math.max(height * 0.7, 400);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.title}>ProofPal</Text>
        <View style={styles.topBarRight}>
          {result && (
            <TouchableOpacity style={styles.viewResultButton} onPress={openSheet}>
              <Text style={styles.viewResultText}>View Result</Text>
            </TouchableOpacity>
          )}
          <ModelBadge model={selectedModel} onPress={() => router.push('/settings')} disabled={isLoading} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <DropZone currentImage={proofImage} onImageReceived={handleProofImage} onClear={() => { setProofImage(undefined); clearFeedback(); }} disabled={isLoading} />
        </View>

        <View style={styles.section}>
          <DepthPicker selectedDepth={depth} onDepthChange={handleDepthChange} disabled={isLoading} />
        </View>

        <View style={styles.section}>
          <SubjectPicker selectedSubjectId={selectedSubjectId} onSubjectChange={handleSubjectChange} disabled={isLoading} />
        </View>

        <View style={styles.section}>
          <ExerciseContextPanel exerciseContext={exerciseContext} onUpdate={handleContextUpdate} disabled={isLoading} />
        </View>

        {/* Toggles Row */}
        <View style={styles.togglesRow}>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>Thinking</Text>
            <Switch
              value={thinkingMode}
              onValueChange={setThinkingMode}
              disabled={isLoading}
              trackColor={{ false: COLORS.bgSurface, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.toggleItem}>
            <Text style={styles.toggleLabel}>Concise</Text>
            <Switch
              value={conciseMode}
              onValueChange={setConciseMode}
              disabled={isLoading}
              trackColor={{ false: COLORS.bgSurface, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.checkButton, (!proofImage || isLoading) && styles.checkButtonDisabled]}
          onPress={handleCheckProof}
          disabled={!proofImage || isLoading}
          accessibilityRole="button"
          accessibilityLabel="Check proof"
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>Check Proof</Text>}
        </TouchableOpacity>

        {isLoading && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel proof check">
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {(proofImage || exerciseContext.reference || exerciseContext.sourceText || exerciseContext.sourceImage || exerciseContext.coursePdf) && (
          <TouchableOpacity style={styles.resetButton} onPress={handleReset} disabled={isLoading} accessibilityRole="button" accessibilityLabel="Reset all">
            <Text style={styles.resetButtonText}>Reset</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Bottom Sheet Feedback Overlay */}
      <Modal visible={showFeedback} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
          <Animated.View
            style={[
              styles.sheetContainer,
              { height: sheetHeight, maxWidth: 720, transform: [{ translateY: sheetAnim }] },
            ]}
            {...panResponder.panHandlers}
          >
            <View style={styles.sheetHandle}>
              <View style={styles.sheetHandleBar} />
            </View>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Feedback</Text>
              <TouchableOpacity onPress={closeSheet} style={styles.sheetCloseButton}>
                <Text style={styles.sheetCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sheetBody}>
              <FeedbackPanel result={result} isLoading={isLoading} stage={stage} />
            </View>
          </Animated.View>
        </View>
      </Modal>

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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary },
  viewResultButton: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  viewResultText: { color: COLORS.primaryLight, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  section: { marginBottom: SPACING.lg },
  togglesRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.xs },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  toggleLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  checkButton: { minHeight: 52, backgroundColor: COLORS.primary, padding: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md },
  checkButtonDisabled: { backgroundColor: COLORS.bgSurface, opacity: 0.7 },
  checkButtonText: { color: '#fff', fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  resetButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, borderRadius: BORDER_RADIUS.md, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  resetButtonText: { color: COLORS.error, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  // Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheetContainer: { width: '100%', backgroundColor: COLORS.bgDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden' },
  sheetHandle: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  sheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
  sheetTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  sheetCloseButton: { width: 32, height: 32, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  sheetBody: { flex: 1, padding: SPACING.md },
});
