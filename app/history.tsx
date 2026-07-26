import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';

import { loadHistory, clearHistory, deleteHistoryEntry } from '../utilities/settings';
import { HistoryEntry } from '../models/types';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory().then(setHistory).catch(console.error);
  }, []);

  const handleClear = () => {
    Alert.alert('Clear History', 'Are you sure you want to clear all history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await clearHistory();
          setHistory([]);
        }
      }
    ]);
  };

  const getVerdictColor = (verdict?: string) => {
    if (verdict === 'correct') return COLORS.success;
    if (verdict === 'incorrect') return COLORS.error;
    if (verdict === 'incomplete') return COLORS.warning;
    return COLORS.primary;
  };

  const handleDeleteItem = (id: string) => {
    Alert.alert('Delete Entry', 'Are you sure you want to delete this history entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteHistoryEntry(id);
          setHistory(prev => prev.filter(item => item.id !== id));
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: HistoryEntry }) => {
    const isExpanded = expandedId === item.id;
    return (
      <TouchableOpacity 
        style={styles.card} 
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.subjectText}>{item.subjectName || 'Unknown Subject'}</Text>
            <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
          <View style={styles.badgeContainer}>
            <View style={[styles.badge, { backgroundColor: getVerdictColor(item.verdict) }]}>
              <Text style={styles.badgeText}>{item.verdict ? item.verdict.toUpperCase() : 'REVIEWED'}</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteItem(item.id)} style={styles.deleteIcon}>
              <Text style={{color: COLORS.error, fontSize: 18}}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.depthText}>Depth: {item.depth || 'Standard'}</Text>
        
        {isExpanded ? (
          <View style={styles.markdownContainer}>
            <MarkdownRenderer content={item.feedbackMarkdown} />
          </View>
        ) : (
          <Text style={styles.previewText} numberOfLines={2}>
            {item.feedbackMarkdown}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>History</Text>
        <TouchableOpacity style={styles.headerRight} onPress={handleClear}>
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No history yet.</Text>
        </View>
      ) : (
        <FlatList
          data={history}
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
  clearText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
  },
  listContent: {
    padding: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  subjectText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
  },
  dateText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteIcon: {
    marginLeft: SPACING.md,
    padding: 4,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  badgeText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: 'bold',
  },
  depthText: {
    color: COLORS.primaryLight,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.sm,
  },
  previewText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
  markdownContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  }
});
