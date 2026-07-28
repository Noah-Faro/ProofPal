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
  Animated,
  Switch,
  PanResponder,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { Redirect, useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { DropZone } from '../components/DropZone';
import { DepthPicker } from '../components/DepthPicker';
import { SubjectPicker } from '../components/SubjectPicker';
import { ExerciseContextPanel } from '../components/ExerciseContext';
import { ModelBadge } from '../components/ModelBadge';
import { ErrorDialog } from '../components/ErrorDialog';
import { checkProof, sendFollowUpMessage } from '../services/geminiService';
import { prepareImageForApi } from '../utilities/imageHelper';
import { DEFAULT_APP_SETTINGS, loadAppSettings, updateAppSettings, saveHistoryEntry, updateHistoryEntry, loadCustomSubjects, deleteCustomSubject } from '../utilities/settings';
import { GeminiModel, type AppSettings, type HistoryEntry, PedagogicalDepth, MathSubject } from '../models/types';
import type { AppError, LocalAttachment, ProofCheckResult, ProofCheckStage, ProofExerciseContext, ProofVerdict } from '../types/proof';
import { ProofPalError } from '../types/proof';
import { getSubjectById } from '../models/subjects';
import { getModelInfo } from '../models/geminiModels';
import { getDepthInfo } from '../models/depthLevels';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { loadLibrary, updateLibraryBook, LibraryBook } from '../utilities/libraryStorage';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

let NativeDragDropView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const module = require('expo-drag-drop-content-view');
  NativeDragDropView = module.DragDropContentView || module.default;
} catch {
  NativeDragDropView = null;
}

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
        suggestFallbackModel: candidate.suggestFallbackModel,
      };
    }
  }
  return { code: 'API', message: error instanceof Error ? error.message : 'Scribe could not check this proof. Please try again.', retryable: true, recoveryAction: 'retry' };
}

const VERDICT_COPY: Record<ProofVerdict, { label: string; color: string; background: string }> = {
  correct: { label: 'Correct', color: COLORS.success, background: 'rgba(34, 197, 94, 0.15)' },
  incorrect: { label: 'Needs revision', color: COLORS.error, background: 'rgba(239, 68, 68, 0.15)' },
  incomplete: { label: 'Incomplete', color: COLORS.accent, background: 'rgba(245, 158, 11, 0.15)' },
  unreadable: { label: 'Unreadable', color: COLORS.textSecondary, background: COLORS.bgSurface },
};

function VerdictBadge({ verdict }: { verdict: ProofVerdict }) {
  const copy = VERDICT_COPY[verdict];
  if (!copy) return null;
  return (
    <View style={[styles.statusBadge, { backgroundColor: copy.background, borderColor: copy.color }]} accessibilityLabel={`Verdict: ${copy.label}`}>
      <Text style={[styles.statusBadgeText, { color: copy.color }]}>{copy.label}</Text>
    </View>
  );
}

function stageLabel(stage: ProofCheckStage | undefined): string {
  switch (stage) {
    case 'preparing': return 'Preparing your proof';
    case 'uploading-pdf': return 'Uploading course PDF';
    case 'processing-pdf': return 'Processing course PDF';
    default: return 'Checking your proof';
  }
}

export default function MainScreen() {
  const { height } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    verdict?: string;
    feedbackMarkdown?: string;
    model?: string;
    depth?: string;
    subjectName?: string;
    exerciseReference?: string;
    chatHistory?: string;
    timestamp?: string;
  }>();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
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
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; text: string; imageUri?: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatImageUri, setChatImageUri] = useState<string | null>(null);
  const [fullScreenImageUri, setFullScreenImageUri] = useState<string | null>(null);
  const [customSubjects, setCustomSubjects] = useState<MathSubject[]>([]);

  const [proofExecutionDetails, setProofExecutionDetails] = useState<{
    model: GeminiModel;
    depth: PedagogicalDepth;
    subjectName?: string;
  } | null>(null);

  const insets = useSafeAreaInsets();
  const [topBarHeight, setTopBarHeight] = useState(60);
  const [sheetHeaderHeight, setSheetHeaderHeight] = useState(50);

  const sheetKeyboardOffset = Platform.OS === 'ios' ? sheetHeaderHeight + insets.top : 0;

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

  // Bottom sheet animation & snap points
  const sheetAnim = useMemo(() => new Animated.Value(height), [height]);

  const sheetHeight = height;
  const snapExpanded = 0;
  const snapHalf = height * 0.4;
  const snapPeek = height * 0.88;
  const snapClosed = height;

  const lastSheetY = useRef(snapClosed);

  const openSheet = useCallback(() => {
    setShowFeedback(true);
    lastSheetY.current = snapHalf;
    sheetAnim.setOffset(0);
    Animated.spring(sheetAnim, { toValue: snapHalf, useNativeDriver: true }).start();
  }, [sheetAnim, snapHalf]);

  useEffect(() => {
    if (params.id && params.feedbackMarkdown) {
      const loadedVerdict = (params.verdict as ProofVerdict) || 'correct';
      const loadedModel = (params.model as GeminiModel) || GeminiModel.FLASH_36;
      const loadedDepth = (params.depth as PedagogicalDepth) || PedagogicalDepth.GUIDE;
      const loadedTimestamp = params.timestamp ? parseInt(params.timestamp, 10) : Date.now();

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult({
        verdict: loadedVerdict,
        feedbackMarkdown: params.feedbackMarkdown,
        model: loadedModel,
        depth: loadedDepth,
        timestamp: loadedTimestamp,
      });
      setProofExecutionDetails({
        model: loadedModel,
        depth: loadedDepth,
        subjectName: params.subjectName || undefined,
      });
      setCurrentHistoryId(params.id);

      if (params.chatHistory) {
        try {
          const parsed = JSON.parse(params.chatHistory);
          if (Array.isArray(parsed)) {
            setChatHistory(parsed);
          }
        } catch (e) {
          console.error('Failed to parse chatHistory from params:', e);
        }
      } else {
        setChatHistory([]);
      }

      openSheet();
    }
  }, [params.id, params.feedbackMarkdown, params.verdict, params.model, params.depth, params.subjectName, params.chatHistory, params.timestamp, openSheet]);


  const closeSheet = useCallback(() => {
    Animated.spring(sheetAnim, { toValue: snapPeek, useNativeDriver: true }).start(() => {
      lastSheetY.current = snapPeek;
    });
  }, [sheetAnim, snapPeek]);

  const fullyCloseSheet = useCallback((onComplete?: () => void) => {
    Animated.timing(sheetAnim, { toValue: snapClosed, duration: 250, useNativeDriver: true }).start(() => {
      setShowFeedback(false);
      lastSheetY.current = snapClosed;
      if (onComplete) onComplete();
    });
  }, [sheetAnim, snapClosed]);

  /* eslint-disable react-hooks/refs */
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

          const snapPoints = [snapExpanded, snapHalf, snapPeek, snapClosed];
          let nextSnap = snapHalf;
          let minDistance = Infinity;
          for (const pt of snapPoints) {
            const dist = Math.abs(predictedY - pt);
            if (dist < minDistance) {
              minDistance = dist;
              nextSnap = pt;
            }
          }

          if (nextSnap === snapClosed) {
            fullyCloseSheet();
          } else {
            Animated.spring(sheetAnim, { toValue: nextSnap, useNativeDriver: true }).start();
            lastSheetY.current = nextSnap;
          }
        },
      }),
    [sheetAnim, snapExpanded, snapHalf, snapPeek, snapClosed, fullyCloseSheet],
  );
  /* eslint-enable react-hooks/refs */

  const [availableBooks, setAvailableBooks] = useState<LibraryBook[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();

  const refreshAvailableBooks = useCallback(async (subjectId: string | undefined) => {
    if (!subjectId) {
      setAvailableBooks([]);
      return;
    }
    const books = await loadLibrary();
    const matching = books.filter((b) => b.subjectId === subjectId);
    setAvailableBooks(matching);
  }, []);

  useEffect(() => {
    let isActive = true;
    if (selectedSubjectId) {
      void loadLibrary().then((books) => {
        if (isActive && mounted.current) {
          const matching = books.filter((b) => b.subjectId === selectedSubjectId);
          setAvailableBooks(matching);
        }
      });
    } else if (isActive && mounted.current) {
      setAvailableBooks([]);
    }
    return () => {
      isActive = false;
    };
  }, [selectedSubjectId]);

  const loadSettings = useCallback(async () => {
    try {
      const next = await loadAppSettings();
      const subjects = await loadCustomSubjects();
      if (!mounted.current) return;
      setCustomSubjects(subjects);
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
        setProofExecutionDetails(null);
      }
    } catch {
      if (mounted.current) setSettings(DEFAULT_APP_SETTINGS);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void loadSettings();
    void loadCustomSubjects().then(setCustomSubjects);
    if (selectedSubjectId) {
      void refreshAvailableBooks(selectedSubjectId);
    }
  }, [loadSettings, refreshAvailableBooks, selectedSubjectId]));

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
    setProofExecutionDetails(null);
  };

  const handleReset = () => {
    setProofImage(undefined);
    setExerciseContext({});
    setSelectedBookId(undefined);
    setResult(null);
    setError(null);
    setProofExecutionDetails(null);
    setChatHistory([]);
    setCurrentHistoryId(null);
    fullyCloseSheet();
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

  const handleSubjectChange = useCallback((subjectId: string | undefined) => {
    if (isLoading) return;
    setSelectedSubjectId(subjectId);
    setSelectedBookId(undefined);
    // A previous subject's PDF must never be submitted under a new subject
    setExerciseContext((prev) => ({ ...prev, coursePdf: undefined }));
    void refreshAvailableBooks(subjectId);
    void persist({ selectedSubjectId: subjectId });
  }, [isLoading, refreshAvailableBooks]);

  const handleDeleteSubject = useCallback(
    async (id: string) => {
      try {
        const books = await loadLibrary();
        const isLinked = books.some((b) => b.subjectId === id);
        if (isLinked) {
          Alert.alert(
            'Cannot Delete Domain',
            'This domain has linked textbook(s) in your library. Please remove or reassign the textbook(s) before deleting this domain.'
          );
          return;
        }
        await deleteCustomSubject(id);
        if (mounted.current) {
          setCustomSubjects((prev) => prev.filter((s) => s.id !== id));
          if (selectedSubjectId === id) {
            handleSubjectChange(undefined);
          }
        }
      } catch (e) {
        console.error('Failed to delete custom subject', e);
      }
    },
    [selectedSubjectId, handleSubjectChange],
  );

  const handleSelectBook = useCallback((bookId: string | undefined) => {
    setSelectedBookId(bookId);
    if (bookId) {
      setAvailableBooks((currentBooks) => {
        const book = currentBooks.find((b) => b.id === bookId);
        if (book) {
          setExerciseContext((prev) => ({
            ...prev,
            coursePdf: {
              uri: book.uri,
              name: book.name,
              mimeType: 'application/pdf',
              size: book.size,
            },
          }));
        }
        return currentBooks;
      });
    } else {
      setExerciseContext((prev) => ({
        ...prev,
        coursePdf: undefined,
      }));
    }
  }, []);

  const handleProofImage = (image: LocalAttachment) => {
    if (isLoading) return;
    setProofImage(image);
    clearFeedback();
  };

  const handleContextUpdate = (nextContext: ProofExerciseContext) => {
    if (isLoading) return;
    if (!nextContext.coursePdf) {
      setSelectedBookId(undefined);
    }
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
    const pickResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!pickResult.canceled && pickResult.assets && pickResult.assets.length > 0) {
      setChatImageUri(pickResult.assets[0].uri);
    }
  };

  const handleSendChat = async (text: string) => {
    if ((!text.trim() && !chatImageUri) || chatLoading || !result) return;
    
    const activeUri = chatImageUri || undefined;
    const newMessage = { role: 'user' as const, text: text.trim(), imageUri: activeUri };
    const updatedUserHistory = [...chatHistory, newMessage];
    setChatHistory(updatedUserHistory);
    setChatLoading(true);
    setChatImageUri(null);
    
    try {
      const responseText = await sendFollowUpMessage(
        text, 
        result.feedbackMarkdown, 
        chatHistory.map(({ role, text }) => ({ role, text })), 
        {
          model: proofExecutionDetails?.model ?? result.model,
          depth: proofExecutionDetails?.depth ?? result.depth,
        },
        activeUri
      );
      const updatedFullHistory = [...updatedUserHistory, { role: 'model' as const, text: responseText }];
      setChatHistory(updatedFullHistory);
      if (currentHistoryId) {
        void updateHistoryEntry(currentHistoryId, { chatHistory: updatedFullHistory });
      }
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setChatLoading(false);
    }
  };

  const handleCheckProof = async (modelOverride?: GeminiModel) => {
    if (!proofImage || isLoading) return;

    if (showFeedback) {
      fullyCloseSheet();
    }

    const currentRequest = ++requestId.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const subject = selectedSubjectId ? (getSubjectById(selectedSubjectId) || customSubjects.find(s => s.id === selectedSubjectId)) : undefined;

    const snapshot = {
      proofImage,
      depth,
      model: modelOverride ?? selectedModel,
      subject,
      exerciseContext,
    };

    setIsLoading(true);
    setStage('preparing');
    clearFeedback();
    setChatHistory([]);
    setProofExecutionDetails({
      model: snapshot.model,
      depth: snapshot.depth,
      subjectName: snapshot.subject?.name,
    });

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
        if (checkResult.remotePdfName && snapshot.exerciseContext.coursePdf?.bookId) {
          void updateLibraryBook(snapshot.exerciseContext.coursePdf.bookId, {
            remotePdfName: checkResult.remotePdfName,
            remotePdfTimestamp: checkResult.timestamp,
          });
        }
        setResult(checkResult);
        openSheet();
        // Save to history
        const newHistoryId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentHistoryId(newHistoryId);
        const entry: HistoryEntry = {
          id: newHistoryId,
          timestamp: checkResult.timestamp,
          verdict: checkResult.verdict,
          feedbackMarkdown: checkResult.feedbackMarkdown,
          model: checkResult.model,
          depth: checkResult.depth,
          subjectName: subject?.name,
          exerciseReference: snapshot.exerciseContext.reference,
          chatHistory: [],
        };
        void saveHistoryEntry(entry);
      }

    } catch (caught) {
      const nextError = toAppError(caught);
      if (controller.signal.aborted || nextError.code === 'CANCELLED') return;
      
      if (nextError.code === 'FILE_EXPIRED' && snapshot.exerciseContext.coursePdf?.bookId) {
        // Wipe local cache
        void updateLibraryBook(snapshot.exerciseContext.coursePdf.bookId, {
          remotePdfName: undefined,
          remotePdfTimestamp: undefined,
        });
        setExerciseContext((prev) => ({
          ...prev,
          coursePdf: prev.coursePdf ? { ...prev.coursePdf, remoteName: undefined, remoteTimestamp: undefined } : undefined,
        }));
        // Notify the user but leave them in a state to easily click Check Proof again
        if (mounted.current && requestId.current === currentRequest) {
          setError({ ...nextError, message: 'The cached course PDF expired on Google\'s servers. Please press Check Proof again to re-upload it.' });
        }
        return;
      }

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
    return <SafeAreaView style={styles.loadingScreen}><ActivityIndicator color={COLORS.primaryLight} /><Text style={styles.loadingText}>Loading Scribe</Text></SafeAreaView>;
  }
  if (!settings.hasCompletedOnboarding) return <Redirect href="/onboarding" />;

  const activeModel = proofExecutionDetails?.model ?? result?.model ?? selectedModel;
  const activeDepth = proofExecutionDetails?.depth ?? result?.depth ?? depth;
  const resolvedSubject = selectedSubjectId ? (getSubjectById(selectedSubjectId) || customSubjects.find(s => s.id === selectedSubjectId)) : undefined;
  const activeSubjectName = proofExecutionDetails?.subjectName ?? resolvedSubject?.name;
  const modelInfo = getModelInfo(activeModel);
  const depthInfo = getDepthInfo(activeDepth);

  const renderChatContainer = () => {
    const chatContent = (
      <View style={{ flex: 1 }}>
        <ScrollView
          ref={chatScrollRef}
          style={styles.unifiedScroll}
          contentContainerStyle={styles.unifiedScrollContent}
          showsVerticalScrollIndicator={true}
        >
          {/* Thread Header Badges */}
          <View style={styles.threadHeaderBadges}>
            {modelInfo && (
              <View style={styles.modelBadge}>
                <Text style={styles.modelBadgeText}>{modelInfo.badge}</Text>
              </View>
            )}
            {depthInfo && (
              <View style={[styles.depthBadge, { borderColor: `${depthInfo.color}66`, backgroundColor: `${depthInfo.color}1A` }]}>
                <Text style={[styles.depthBadgeText, { color: depthInfo.color }]}>{depthInfo.label}</Text>
              </View>
            )}
            {activeSubjectName && (
              <View style={styles.subjectBadge}>
                <Text style={styles.subjectBadgeText}>{activeSubjectName}</Text>
              </View>
            )}
            {result && <VerdictBadge verdict={result.verdict} />}
            {result && (
              <Text style={styles.timestampText}>
                {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            )}
          </View>

          {/* Initial AI Feedback */}
          {result && (
            <View style={styles.aiMessageContainer}>
              <MarkdownRenderer content={result.feedbackMarkdown} />
            </View>
          )}

          {/* Subsequent Chat Messages */}
          {chatHistory.map((msg, index) => (
            <View key={index} style={msg.role === 'user' ? styles.userMessageContainer : styles.aiMessageContainer}>
              {msg.role === 'user' ? (
                <View style={styles.userBubble}>
                  {msg.imageUri && (
                    <TouchableOpacity onPress={() => setFullScreenImageUri(msg.imageUri ?? null)}>
                      <Image source={{ uri: msg.imageUri }} style={styles.userMessageImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {!!msg.text && (
                    <Text style={styles.userBubbleText}>{msg.text}</Text>
                  )}
                </View>
              ) : (
                <MarkdownRenderer content={msg.text} />
              )}
            </View>
          ))}

          {chatLoading && (
            <View style={styles.chatLoadingRow}>
              <ActivityIndicator color={COLORS.primaryLight} size="small" />
              <Text style={styles.chatLoadingText}>Scribe is thinking...</Text>
            </View>
          )}
        </ScrollView>

        {/* Chat Image Attachment Preview */}
        {chatImageUri && (
          <View style={styles.chatImagePreviewRow}>
            <Image source={{ uri: chatImageUri }} style={styles.chatImagePreview} />
            <TouchableOpacity onPress={() => setChatImageUri(null)} style={styles.removeImageButton}>
              <Text style={styles.removeImageText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Fixed Chat Input Row */}
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
    );

    if (NativeDragDropView) {
      const DragDropView = NativeDragDropView;
      return (
        <DragDropView
          style={{ flex: 1 }}
          allowedMimeTypes={['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']}
          onDrop={(event: any) => {
            const asset = event?.assets?.[0] ?? event?.nativeEvent?.assets?.[0];
            if (asset?.uri) {
              setChatImageUri(asset.uri);
            }
          }}
        >
          {chatContent}
        </DragDropView>
      );
    }
    return chatContent;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar} onLayout={(e) => setTopBarHeight(e.nativeEvent.layout.height)}>
        <Text style={styles.title}>Scribe</Text>
        <View style={styles.topBarRight}>
          {result && (
            <TouchableOpacity style={styles.viewResultButton} onPress={openSheet}>
              <Text style={styles.viewResultText}>View Result</Text>
            </TouchableOpacity>
          )}
          <ModelBadge model={selectedModel} onPress={() => router.push('/settings')} disabled={isLoading} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        keyboardDismissMode="interactive"
      >
        <View style={styles.section}>
          <DropZone currentImage={proofImage} onImageReceived={handleProofImage} onClear={() => { setProofImage(undefined); clearFeedback(); }} disabled={isLoading} />
        </View>

        <View style={styles.section}>
          <DepthPicker selectedDepth={depth} onDepthChange={handleDepthChange} disabled={isLoading} />
        </View>

        <View style={styles.section}>
          <SubjectPicker 
            selectedSubjectId={selectedSubjectId} 
            onSubjectChange={handleSubjectChange} 
            disabled={isLoading} 
            customSubjects={customSubjects}
            onCustomSubjectAdded={(subj) => setCustomSubjects(prev => [...prev, subj])}
            onDeleteSubject={handleDeleteSubject}
          />
          {selectedSubjectId && availableBooks.length === 0 && (
            <TouchableOpacity
              style={styles.addBookLink}
              onPress={() => router.push('/library')}
              disabled={isLoading}
            >
              <Text style={styles.addBookLinkText}>Add a textbook →</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <ExerciseContextPanel
            exerciseContext={exerciseContext}
            onUpdate={handleContextUpdate}
            disabled={isLoading}
            availableBooks={availableBooks}
            selectedBookId={selectedBookId}
            onSelectBook={handleSelectBook}
          />
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

        {/* Action Buttons Row */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.checkButton, (!proofImage || isLoading) && styles.checkButtonDisabled]}
            onPress={() => void handleCheckProof()}
            disabled={!proofImage || isLoading}
            accessibilityRole="button"
            accessibilityLabel="Check proof"
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkButtonText}>Check Proof</Text>}
          </TouchableOpacity>

          {(proofImage || exerciseContext.reference || exerciseContext.sourceText || exerciseContext.sourceImage || exerciseContext.coursePdf) && (
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel="Reset all"
            >
              <Text style={styles.resetButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {isLoading && (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} accessibilityRole="button" accessibilityLabel="Cancel proof check">
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Bottom Sheet Feedback Overlay */}
      {showFeedback && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
          pointerEvents={showFeedback ? 'auto' : 'none'}
        >
          <View style={styles.sheetOverlay}>
            <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={closeSheet} />
            <Animated.View
              style={[
                styles.sheetContainer,
                { height: sheetHeight, maxWidth: 720, transform: [{ translateY: sheetAnim }] },
              ]}
            >
              <View style={styles.sheetHandle} {...panResponder.panHandlers}>
                <View style={styles.sheetHandleBar} />
              </View>
              <View style={styles.sheetHeader} onLayout={(e) => setSheetHeaderHeight(e.nativeEvent.layout.height)} {...panResponder.panHandlers}>
                <View style={styles.sheetHeaderLeft}>
                  <Text style={styles.sheetTitle}>Feedback</Text>
                </View>
                <TouchableOpacity
                  onPress={() => fullyCloseSheet()}
                  style={styles.sheetCloseButton}
                  accessibilityRole="button"
                  accessibilityLabel="Minimize feedback"
                >
                  <Text style={styles.sheetCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.sheetBody}>
                <KeyboardAvoidingView 
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                  keyboardVerticalOffset={sheetKeyboardOffset}
                  style={{ flex: 1 }}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={COLORS.primaryLight} />
                      <Text style={styles.loadingStageText}>{stageLabel(stage)}</Text>
                    </View>
                  ) : result ? (
                    renderChatContainer()
                  ) : (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyTitle}>Drop a proof image and tap Check to get feedback</Text>
                      <Text style={styles.emptySubtitle}>Scribe will analyze your mathematical steps and provide tailored guidance.</Text>
                    </View>
                  )}
                </KeyboardAvoidingView>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      <ErrorDialog
        error={error}
        onDismiss={() => setError(null)}
        onRetry={() => { setError(null); void handleCheckProof(); }}
        onAddApiKey={() => { setError(null); router.push('/onboarding'); }}
        onOpenSettings={() => { setError(null); router.push('/settings'); }}
        onSwitchModel={(model) => {
          persist({ selectedModel: model as GeminiModel });
          setSelectedModel(model as GeminiModel);
          setError(null);
          void handleCheckProof(model as GeminiModel);
        }}
      />

      {/* Fullscreen Image Modal */}
      <Modal visible={!!fullScreenImageUri} transparent={true} animationType="fade" onRequestClose={() => setFullScreenImageUri(null)}>
        <TouchableOpacity style={styles.fullScreenImageOverlay} activeOpacity={1} onPress={() => setFullScreenImageUri(null)}>
          {fullScreenImageUri && (
            <Image source={{ uri: fullScreenImageUri }} style={styles.fullScreenImage} resizeMode="contain" />
          )}
          <TouchableOpacity style={styles.fullScreenCloseButton} onPress={() => setFullScreenImageUri(null)}>
            <Text style={styles.fullScreenCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, backgroundColor: COLORS.bgDark },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexShrink: 1 },
  title: { fontSize: FONT_SIZES.xl, fontWeight: 'bold', color: '#fff', flexShrink: 1 },
  viewResultButton: { backgroundColor: 'rgba(99, 102, 241, 0.2)', borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  viewResultText: { color: COLORS.primaryLight, fontSize: FONT_SIZES.xs, fontWeight: '700' },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xxl },
  section: { marginBottom: SPACING.lg },
  togglesRow: { flexDirection: 'row', gap: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.xs },
  toggleItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  toggleLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '600' },
  // Phase 2C Action Buttons
  actionRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: SPACING.md },
  checkButton: { width: '65%', height: 52, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  checkButtonDisabled: { backgroundColor: COLORS.bgSurface, opacity: 0.7 },
  checkButtonText: { color: '#fff', fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
  resetButton: { width: 52, height: 52, borderRadius: BORDER_RADIUS.md, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center', justifyContent: 'center' },
  resetButtonText: { color: '#fff', fontSize: FONT_SIZES.lg, fontWeight: 'bold' },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  cancelButtonText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: '700' },
  // Bottom Sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  sheetContainer: { width: '100%', backgroundColor: COLORS.bgDark, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255, 255, 255, 0.12)', overflow: 'hidden' },
  sheetHandle: { alignItems: 'center', paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
  sheetHandleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.25)' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sheetTitle: { fontSize: FONT_SIZES.lg, fontWeight: 'bold', color: COLORS.textPrimary },
  sheetCloseButton: { width: 32, height: 32, borderRadius: BORDER_RADIUS.full, backgroundColor: 'rgba(255, 255, 255, 0.08)', alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  sheetBody: { flex: 1, padding: SPACING.md },
  // Phase 2B Unified Chat Thread
  unifiedScroll: { flex: 1 },
  unifiedScrollContent: { paddingBottom: SPACING.md },
  threadHeaderBadges: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACING.sm, paddingBottom: SPACING.sm, marginBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
  modelBadge: { backgroundColor: 'rgba(99, 102, 241, 0.15)', borderWidth: 1, borderColor: 'rgba(129, 140, 248, 0.3)', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  modelBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.primaryLight },
  depthBadge: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  depthBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },
  subjectBadge: { backgroundColor: 'rgba(255, 255, 255, 0.08)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)', borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  subjectBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '600', color: COLORS.textSecondary },
  statusBadge: { borderWidth: 1, borderRadius: BORDER_RADIUS.full, paddingHorizontal: SPACING.sm + 2, paddingVertical: 2 },
  statusBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: '700' },
  timestampText: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginLeft: 'auto' },
  aiMessageContainer: { width: '100%', marginVertical: SPACING.xs },
  userMessageContainer: { width: '100%', alignItems: 'flex-end', marginVertical: SPACING.xs },
  userBubble: { backgroundColor: COLORS.bgSurface, maxWidth: '85%', borderRadius: BORDER_RADIUS.md, padding: SPACING.md, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  userBubbleText: { color: COLORS.textPrimary, fontSize: FONT_SIZES.sm, lineHeight: 20 },
  userMessageImage: { width: 140, height: 140, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.xs },
  chatLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginVertical: SPACING.sm },
  chatLoadingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  chatImagePreviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs, paddingHorizontal: SPACING.xs },
  chatImagePreview: { width: 50, height: 50, borderRadius: BORDER_RADIUS.sm, marginRight: SPACING.xs },
  removeImageButton: { backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: BORDER_RADIUS.full, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  chatInputRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center', marginTop: SPACING.xs },
  chatInput: { flex: 1, minHeight: 44, backgroundColor: COLORS.bgSurface, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.md, color: COLORS.textPrimary, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  chatSendButton: { backgroundColor: COLORS.primary, paddingHorizontal: SPACING.lg, minHeight: 44, borderRadius: BORDER_RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  chatSendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: FONT_SIZES.sm },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
  loadingStageText: { color: COLORS.primaryLight, fontSize: FONT_SIZES.md, fontWeight: '600' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyTitle: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.textPrimary, textAlign: 'center', marginBottom: SPACING.xs },
  emptySubtitle: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted, textAlign: 'center', maxWidth: 360 },
  addBookLink: { marginTop: SPACING.sm, marginLeft: SPACING.xs, alignSelf: 'flex-start' },
  addBookLinkText: { color: COLORS.primaryLight, fontSize: FONT_SIZES.sm, fontWeight: '500' },
  fullScreenImageOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
  fullScreenCloseButton: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  fullScreenCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
});
