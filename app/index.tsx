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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DropZone } from '../components/DropZone';
import { DepthPicker } from '../components/DepthPicker';
import { SubjectPicker } from '../components/SubjectPicker';
import { ExerciseContextPanel } from '../components/ExerciseContext';
import { ModelBadge } from '../components/ModelBadge';
import { FeedbackPanel } from '../components/FeedbackPanel';
import { ErrorDialog } from '../components/ErrorDialog';
import { checkProof, sendFollowUpMessage } from '../services/geminiService';
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
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatImageUri, setChatImageUri] = useState<string | null>(null);
  const requestId = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const hydratedPreferences = useRef<Pick<AppSettings, 'selectedModel' | 'selectedDepth' | 'selectedSubjectId'> | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [chatHistory]);

  // Bottom sheet animation
  const sheetAnim = useMemo(() => new Animated.Value(0), []);

  const sheetHeight = height * 0.9;
  const snapExpanded = 0;
  const snapHalf = height * 0.4;
  const snapClosed = height * 0.9;

  const lastSheetY = useRef(snapHalf);

  const openSheet = () => {
    setShowFeedback(true);
    lastSheetY.current = snapHalf;
    sheetAnim.setOffset(0);
    sheetAnim.setValue(snapClosed);
    Animated.spring(sheetAnim, { toValue: snapHalf, useNativeDriver: true }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: snapClosed, duration: 250, useNativeDriver: true }).start(() => {
      setShowFeedback(false);
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
        onPanResponderGrant: () => {
          sheetAnim.setOffset(lastSheetY.current);
          sheetAnim.setValue(0);
        },
        onPanResponderMove: (_, gestureState) => {
          let newY = gestureState.dy;
          if (lastSheetY.current + newY < 0) {
            newY = -lastSheetY.current + (newY + lastSheetY.current) * 0.2;
          }
          sheetAnim.setValue(newY);
        },
        onPanResponderRelease: (_, gestureState) => {
          sheetAnim.flattenOffset();
          const currentY = lastSheetY.current + gestureState.dy;
          const velocityY = gestureState.vy;
          const predictedY = currentY + velocityY * 150;

          let nextSnap = snapHalf;
          const distExpanded = Math.abs(predictedY - snapExpanded);
          const distHalf = Math.abs(predictedY - snapHalf);
          const distClosed = Math.abs(predictedY - snapClosed);

          if (distClosed < distHalf && distClosed < distExpanded) {
            nextSnap = snapClosed;
          } else if (distExpanded < distHalf) {
            nextSnap = snapExpanded;
          } else {
            nextSnap = snapHalf;
          }

          if (nextSnap === snapClosed) {
            closeSheet();
          } else {
            Animated.spring(sheetAnim, { toValue: nextSnap, useNativeDriver: true }).start();
            lastSheetY.current = nextSnap;
          }
        },
      }),
    [sheetAnim, height],
  );

  const [availableBooks, setAvailableBooks] = useState<{id: string, name: string, uri: string, subjectId?: string}[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();

  useEffect(() => {
    if (selectedSubjectId) {
      AsyncStorage.getItem('proofpal_library').then(json => {
        if (json && mounted.current) {
          const books = JSON.parse(json);
          const matching = books.filter((b: any) => b.subjectId === selectedSubjectId);
          setAvailableBooks(matching);
          // If there's exactly one book, auto-select it
          if (matching.length === 1 && !selectedBookId) {
            setSelectedBookId(matching[0].id);
            setExerciseContext(prev => ({ ...prev, coursePdf: { uri: matching[0].uri, name: matching[0].name, mimeType: 'application/pdf' } }));
          }
        }
      });
    } else {
      setAvailableBooks([]);
      setSelectedBookId(undefined);
      setExerciseContext(prev => ({ ...prev, coursePdf: undefined }));
    }
  }, [selectedSubjectId]);

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
    void persist({ selectedDepth: nextDepth });
  };

  const handleSubjectChange = (subjectId: string | undefined) => {
    if (isLoading) return;
    setSelectedSubjectId(subjectId);
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

  const handlePickChatImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setChatImageUri(result.assets[0].uri);
    }
  };

  const handleSendChat = async (text: string) => {
    if ((!text.trim() && !chatImageUri) || chatLoading || !result) return;
    
    const newMessage = { role: 'user' as const, text: text || (chatImageUri ? '[Image attached]' : '') };
    setChatHistory(prev => [...prev, newMessage]);
    setChatLoading(true);
    
    try {
      const responseText = await sendFollowUpMessage(
        text, 
        result.feedbackMarkdown, 
        chatHistory, 
        { model: selectedModel, depth },
        chatImageUri || undefined
      );
      setChatHistory(prev => [...prev, { role: 'model', text: responseText }]);
      setChatImageUri(null);
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setChatLoading(false);
    }
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
    setChatHistory([]);
    try {
      const libraryBooksJson = await AsyncStorage.getItem('proofpal_library');
      if (libraryBooksJson) {
        // TODO: pass book context to gemini
      }

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
          {availableBooks.length > 0 && (
            <View style={{ marginTop: SPACING.md }}>
              <Text style={{ color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '600', marginBottom: SPACING.xs, marginLeft: SPACING.xs }}>
                Reference Book
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: SPACING.xs }}>
                {availableBooks.map(book => {
                  const isSelected = selectedBookId === book.id;
                  return (
                    <TouchableOpacity
                      key={book.id}
                      activeOpacity={0.7}
                      disabled={isLoading}
                      onPress={() => {
                        if (isSelected) {
                          setSelectedBookId(undefined);
                          setExerciseContext(prev => ({ ...prev, coursePdf: undefined }));
                        } else {
                          setSelectedBookId(book.id);
                          setExerciseContext(prev => ({ ...prev, coursePdf: { uri: book.uri, name: book.name, mimeType: 'application/pdf' } }));
                        }
                      }}
                      style={{
                        paddingHorizontal: SPACING.md,
                        paddingVertical: SPACING.sm,
                        borderRadius: BORDER_RADIUS.full,
                        borderWidth: 1,
                        borderColor: isSelected ? COLORS.primary : 'rgba(255,255,255,0.1)',
                        backgroundColor: isSelected ? 'rgba(99,102,241,0.15)' : COLORS.bgSurface,
                      }}
                    >
                      <Text style={{ color: isSelected ? COLORS.primaryLight : COLORS.textPrimary, fontSize: FONT_SIZES.sm, fontWeight: isSelected ? 'bold' : '500' }}>
                        {book.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
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
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
              >
                <View style={{ flex: 1 }}>
                  <FeedbackPanel result={result} isLoading={isLoading} stage={stage} />
                </View>
                {result && (
                  <View style={styles.chatContainer}>
                    <ScrollView ref={chatScrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatScrollContent}>
                      {chatHistory.map((msg, index) => (
                        <View key={index} style={[styles.chatBubble, msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleModel]}>
                          <MarkdownRenderer content={msg.text} />
                        </View>
                      ))}
                      {chatLoading && (
                        <ActivityIndicator style={{marginTop: 8}} color={COLORS.primaryLight} />
                      )}
                    </ScrollView>
                    
                    {chatImageUri && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: SPACING.md, marginBottom: SPACING.sm }}>
                        <Image source={{ uri: chatImageUri }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 8 }} />
                        <TouchableOpacity onPress={() => setChatImageUri(null)} style={{ backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 4 }}>
                          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    
                    <View style={styles.chatInputRow}>
                      <TouchableOpacity onPress={handlePickChatImage} style={{ padding: SPACING.xs }}>
                        <Text style={{ fontSize: 20 }}>📷</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={styles.chatInput}
                        placeholder="Ask a follow-up question..."
                        placeholderTextColor={COLORS.textMuted}
                        value={chatInput}
                        onChangeText={setChatInput}
                        onSubmitEditing={() => {
                          handleSendChat(chatInput);
                          setChatInput('');
                        }}
                      />
                      <TouchableOpacity
                        style={styles.chatSendButton}
                        onPress={() => {
                          handleSendChat(chatInput);
                          setChatInput('');
                        }}
                        disabled={chatLoading || (!chatInput.trim() && !chatImageUri)}
                      >
                        <Text style={styles.chatSendButtonText}>Send</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </KeyboardAvoidingView>
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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1 },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: COLORS.textPrimary, flexShrink: 1 },
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
  chatContainer: { flex: 1, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: SPACING.md },
  chatScroll: { flex: 1, marginBottom: SPACING.sm },
  chatScrollContent: { gap: SPACING.sm },
  chatBubble: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, maxWidth: '85%' },
  chatBubbleUser: { backgroundColor: COLORS.primary, alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleModel: { backgroundColor: COLORS.bgSurface, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  chatText: { fontSize: FONT_SIZES.sm, lineHeight: 20 },
  chatTextUser: { color: '#fff' },
  chatTextModel: { color: COLORS.textPrimary },
  chatInputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  chatInput: { flex: 1, minHeight: 44, backgroundColor: COLORS.bgSurface, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  chatSendButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, minHeight: 44, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  chatSendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZES.sm },
});
