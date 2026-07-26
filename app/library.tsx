import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Alert, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { MATH_SUBJECTS } from '../models/subjects';
import { loadCustomSubjects } from '../utilities/settings';
import { MathSubject } from '../models/types';

interface LibraryBook {
  id: string;
  name: string;
  domain: string;
  subjectId?: string;
  uri: string;
  size?: number;
  addedAt: number;
}

const STORAGE_KEY = 'proofpal_library';

export default function LibraryScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [domainModalVisible, setDomainModalVisible] = useState(false);
  const [allSubjects, setAllSubjects] = useState<MathSubject[]>([]);
  const [pendingFile, setPendingFile] = useState<any>(null);

  useEffect(() => {
    let isActive = true;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (isActive && data) {
          setBooks(JSON.parse(data));
        }
      })
      .catch((e) => console.error('Failed to load books', e));
      
    loadCustomSubjects().then(custom => {
      if (isActive) setAllSubjects([...MATH_SUBJECTS, ...custom]);
    });

    return () => {
      isActive = false;
    };
  }, []);

  const saveBooks = async (newBooks: LibraryBook[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
      setBooks(newBooks);
    } catch (e) {
      console.error('Failed to save books', e);
    }
  };

  const handleAddBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      setPendingFile(result.assets[0]);
      
      const custom = await loadCustomSubjects();
      setAllSubjects([...MATH_SUBJECTS, ...custom]);
      setDomainModalVisible(true);
      
    } catch (e) {
      console.error('Failed to pick document', e);
      Alert.alert('Error', 'Failed to pick the document.');
    }
  };

  const handleSelectDomain = useCallback((subject: MathSubject) => {
    if (!pendingFile) return;
    const newBook: LibraryBook = {
      id: Date.now().toString(),
      name: pendingFile.name,
      domain: subject.name,
      subjectId: subject.id,
      uri: pendingFile.uri,
      size: pendingFile.size,
      addedAt: Date.now(),
    };
    saveBooks([newBook, ...books]);
    setDomainModalVisible(false);
    setPendingFile(null);
  }, [pendingFile, books]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete Book', 'Are you sure you want to delete this book?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          saveBooks(books.filter(b => b.id !== id));
        },
      },
    ]);
  }, [books]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const renderItem = ({ item }: { item: LibraryBook }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.bookName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.domainText}>{item.domain}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatSize(item.size)}</Text>
          <Text style={styles.metaText}> • </Text>
          <Text style={styles.metaText}>{new Date(item.addedAt).toLocaleDateString()}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
        <Text style={styles.deleteButtonText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Library</Text>
        <TouchableOpacity style={styles.headerRight} onPress={handleAddBook}>
          <Text style={styles.addText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No books in library.</Text>
          <TouchableOpacity style={styles.addButton} onPress={handleAddBook}>
            <Text style={styles.addButtonText}>Add a Book</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Domain Selection Modal */}
      <Modal
        visible={domainModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setDomainModalVisible(false);
          setPendingFile(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContentContainer}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Math Domain</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => {
                    setDomainModalVisible(false);
                    setPendingFile(null);
                  }}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                {allSubjects.map((subj) => (
                  <TouchableOpacity
                    key={subj.id}
                    style={styles.subjectRow}
                    onPress={() => handleSelectDomain(subj)}
                  >
                    <Text style={styles.subjectName}>{subj.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
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
    alignItems: 'flex-end',
  },
  addText: {
    color: COLORS.primaryLight,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.md,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginRight: SPACING.md,
  },
  bookName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  domainText: {
    color: COLORS.primaryLight,
    fontSize: FONT_SIZES.sm,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
  },
  deleteButton: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BORDER_RADIUS.full,
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 13, 35, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContentContainer: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '85%',
  },
  modalCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  scrollBody: {
    padding: SPACING.lg,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
});
