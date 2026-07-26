import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface LibraryBook {
  id: string;
  name: string;
  domain: string;
  uri: string;
  size?: number;
  addedAt: number;
}

const STORAGE_KEY = 'proofpal_library';

export default function LibraryScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<LibraryBook[]>([]);

  useEffect(() => {
    loadBooks();
  }, []);

  const loadBooks = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setBooks(JSON.parse(data));
      }
    } catch (e) {
      console.error('Failed to load books', e);
    }
  };

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

      const file = result.assets[0];

      Alert.prompt(
        'Math Domain',
        'Enter the math domain/field for this book (e.g., Linear Algebra, Calculus):',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (domain?: string) => {
              const newBook: LibraryBook = {
                id: Date.now().toString(),
                name: file.name,
                domain: domain || 'General',
                uri: file.uri,
                size: file.size,
                addedAt: Date.now(),
              };
              saveBooks([newBook, ...books]);
            },
          },
        ],
        'plain-text'
      );
    } catch (e) {
      console.error('Failed to pick document', e);
      Alert.alert('Error', 'Failed to pick the document.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Book', 'Are you sure you want to delete this book?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const newBooks = books.filter(b => b.id !== id);
          saveBooks(newBooks);
        }
      }
    ]);
  };

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
});
