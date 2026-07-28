import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { getSubjectsByCategory, getSubjectById, MATH_SUBJECTS } from '../models/subjects';
import { MathSubject, SubjectCategory } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import {
  loadCustomSubjects,
  addCustomSubject,
  deleteCustomSubject,
  loadCustomCategories,
  addCustomCategory,
  deleteCustomCategory,
} from '../utilities/settings';

/**
 * Props for the {@link SubjectPicker} component.
 */
export interface SubjectPickerProps {
  /** ID of the currently selected subject (or undefined if none selected) */
  selectedSubjectId?: string;
  /** Callback triggered when a subject is selected or cleared */
  onSubjectChange: (subjectId: string | undefined) => void;
  disabled?: boolean;
  /** Optional callback triggered when a custom subject is deleted */
  onDeleteSubject?: (id: string) => void;
  /** Optional callback triggered when a custom category is deleted */
  onDeleteCategory?: (id: string, parentId?: string) => void;
}

/**
 * SubjectPicker provides a trigger button and grouped modal for selecting the target math subject.
 *
 * Subject context helps Gemini tailor mathematical terminology and proof rigor
 * (e.g. Real Analysis vs. Linear Algebra).
 */
export const SubjectPicker: React.FC<SubjectPickerProps> = ({
  selectedSubjectId,
  onSubjectChange,
  disabled = false,
  onDeleteSubject,
  onDeleteCategory,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [customSubjects, setCustomSubjects] = useState<MathSubject[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  
  const [newDomainModalVisible, setNewDomainModalVisible] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainCategory, setNewDomainCategory] = useState<string>('');

  useEffect(() => {
    loadCustomSubjects().then(setCustomSubjects).catch(console.error);
    loadCustomCategories().then(setCustomCategories).catch(console.error);
  }, []);

  const selectedSubject = selectedSubjectId
    ? getSubjectById(selectedSubjectId) || customSubjects.find(s => s.id === selectedSubjectId)
    : undefined;
  
  const subjectsByCategory: Record<string, MathSubject[]> = { ...getSubjectsByCategory() };
  
  customCategories.forEach(cat => {
    if (!subjectsByCategory[cat]) subjectsByCategory[cat] = [];
  });

  customSubjects.forEach(subj => {
    const cat = subj.category as string;
    if (!subjectsByCategory[cat]) {
      subjectsByCategory[cat] = [];
    }
    subjectsByCategory[cat].push(subj);
  });

  const handleSelect = (subjectId: string | undefined) => {
    if (disabled) return;
    onSubjectChange(subjectId);
    setModalVisible(false);
  };

  const confirmDeleteSubject = (id: string) => {
    Alert.alert(
      'Delete Custom Domain',
      'Delete this custom domain?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomSubject(id);
              setCustomSubjects(prev => prev.filter(s => s.id !== id));
              if (onDeleteSubject) {
                onDeleteSubject(id);
              }
            } catch (e) {
              console.error('Failed to delete custom subject', e);
            }
          },
        },
      ]
    );
  };

  const confirmDeleteCategory = (category: string) => {
    Alert.alert(
      'Delete Custom Category',
      'Delete this custom category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomCategory(category);
              setCustomCategories(prev => prev.filter(c => c !== category));
              setCustomSubjects(prev => prev.filter(s => s.category !== category));
              if (onDeleteCategory) {
                onDeleteCategory(category, category);
              }
            } catch (e) {
              console.error('Failed to delete custom category', e);
            }
          },
        },
      ]
    );
  };

  const handleAddCategory = () => {
    Alert.prompt('New Category', 'Enter the name of the new category:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Add',
        onPress: async (name?: string) => {
          if (name?.trim()) {
            const newCat = name.trim();
            try {
              await addCustomCategory(newCat);
              setCustomCategories(prev => prev.includes(newCat) ? prev : [...prev, newCat]);
            } catch (e) {
              console.error(e);
            }
          }
        },
      }
    ]);
  };

  const handleSaveNewDomain = async () => {
    if (newDomainName.trim() && newDomainCategory) {
      const newSubj: MathSubject = {
        id: `custom_${Date.now()}`,
        name: newDomainName.trim(),
        category: newDomainCategory,
      };
      try {
        await addCustomSubject(newSubj);
        setCustomSubjects(prev => [...prev, newSubj]);
        handleSelect(newSubj.id);
        setNewDomainModalVisible(false);
        setNewDomainName('');
        setNewDomainCategory('');
      } catch (e) {
        console.error(e);
      }
    } else {
      Alert.alert('Error', 'Please enter a name and select a category.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Selector Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={disabled}
        onPress={() => setModalVisible(true)}
        style={[
          styles.triggerButton,
          selectedSubject && styles.triggerButtonActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Select Math Subject"
        accessibilityState={{ disabled }}
      >
        <Text style={styles.triggerIcon}>
          {selectedSubject ? '📐' : '➕'}
        </Text>
        <View style={styles.triggerTextContainer}>
          <Text style={styles.triggerLabel}>Subject Context</Text>
          <Text
            style={[
              styles.triggerValue,
              !selectedSubject && styles.triggerValuePlaceholder,
            ]}
            numberOfLines={1}
          >
            {selectedSubject ? selectedSubject.name : 'No subject selected (Optional)'}
          </Text>
        </View>
        <Text style={styles.chevron}>▼</Text>
      </TouchableOpacity>

      {/* Grouped Subjects Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContentContainer}>
            <View style={styles.modalCard}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Select Math Subject</Text>
                  <Text style={styles.modalSubtitle}>
                    Helps Gemini apply domain-specific definitions & rules
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                  accessibilityLabel="Close subject picker modal"
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={styles.scrollBody}
              >
                {/* Clear Selection Option */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSelect(undefined)}
                  style={[
                    styles.clearOption,
                    !selectedSubjectId && styles.selectedRow,
                  ]}
                >
                  <Text style={styles.clearOptionIcon}>🚫</Text>
                  <Text style={styles.clearOptionText}>No Subject (General Math)</Text>
                  {!selectedSubjectId && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Categorized Subject List */}
                {Object.keys(subjectsByCategory).map((category) => {
                  const subjects = subjectsByCategory[category] || [];
                  const isCustomCategory =
                    customCategories.includes(category) ||
                    !Object.values(SubjectCategory).includes(category as SubjectCategory);

                  if (subjects.length === 0 && !isCustomCategory) return null;

                  return (
                    <View key={category} style={styles.categoryGroup}>
                      <View style={styles.categoryHeaderRow}>
                        <Text style={styles.categoryHeader}>{category}</Text>
                        {isCustomCategory && (
                          <TouchableOpacity
                            style={styles.deleteIconButton}
                            onPress={() => confirmDeleteCategory(category)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            accessibilityLabel={`Delete ${category} category`}
                          >
                            <Text style={styles.deleteIconText}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {subjects.map((subj: MathSubject) => {
                        const isSelected = subj.id === selectedSubjectId;
                        const isCustomSubject = !MATH_SUBJECTS.some((s) => s.id === subj.id);

                        return (
                          <TouchableOpacity
                            key={subj.id}
                            activeOpacity={0.7}
                            onPress={() => handleSelect(subj.id)}
                            onLongPress={() => {
                              if (isCustomSubject) confirmDeleteSubject(subj.id);
                            }}
                            style={[
                              styles.subjectRow,
                              isSelected && styles.selectedRow,
                            ]}
                          >
                            <Text
                              style={[
                                styles.subjectName,
                                isSelected && styles.selectedSubjectName,
                              ]}
                            >
                              {subj.name}
                            </Text>
                            <View style={styles.subjectRightContainer}>
                              {isCustomSubject && (
                                <TouchableOpacity
                                  style={styles.deleteIconButton}
                                  onPress={() => confirmDeleteSubject(subj.id)}
                                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                  accessibilityLabel={`Delete ${subj.name} subject`}
                                >
                                  <Text style={styles.deleteIconText}>🗑️</Text>
                                </TouchableOpacity>
                              )}
                              {isSelected && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}

                <TouchableOpacity 
                  style={styles.addDomainButton} 
                  onPress={() => setNewDomainModalVisible(true)}
                >
                  <Text style={styles.addDomainButtonText}>+ Add New Domain</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.addDomainButton, { marginTop: 0, marginBottom: SPACING.lg }]} 
                  onPress={handleAddCategory}
                >
                  <Text style={styles.addDomainButtonText}>+ Add New Category</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* New Domain Modal */}
      <Modal
        visible={newDomainModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNewDomainModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContentContainer}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add New Domain</Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setNewDomainModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.scrollBody}>
                <Text style={styles.inputLabel}>Domain Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={newDomainName}
                  onChangeText={setNewDomainName}
                  placeholder="e.g. Topology"
                  placeholderTextColor={COLORS.textMuted}
                />
                
                <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>Select Category</Text>
                {Object.keys(subjectsByCategory).map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOptionRow,
                      newDomainCategory === cat && styles.selectedRow
                    ]}
                    onPress={() => setNewDomainCategory(cat)}
                  >
                    <Text style={[
                      styles.subjectName,
                      newDomainCategory === cat && styles.selectedSubjectName
                    ]}>{cat}</Text>
                    {newDomainCategory === cat && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity style={styles.saveDomainButton} onPress={handleSaveNewDomain}>
                  <Text style={styles.saveDomainButtonText}>Save Domain</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: SPACING.xs,
  },
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgCard,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  triggerButtonActive: {
    borderColor: COLORS.primaryLight,
    backgroundColor: COLORS.bgSurface,
  },
  triggerIcon: {
    fontSize: FONT_SIZES.lg,
    marginRight: SPACING.sm,
  },
  triggerTextContainer: {
    flex: 1,
  },
  triggerLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  triggerValue: {
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  triggerValuePlaceholder: {
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  chevron: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginLeft: SPACING.sm,
  },

  // Modal Styles
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
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
  modalSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  clearOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.bgSurface,
    marginBottom: SPACING.sm,
  },
  clearOptionIcon: {
    fontSize: FONT_SIZES.md,
    marginRight: SPACING.sm,
  },
  clearOptionText: {
    flex: 1,
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: SPACING.md,
  },
  categoryGroup: {
    marginBottom: SPACING.lg,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  categoryHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primaryLight,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  deleteIconButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.xs,
  },
  deleteIconText: {
    fontSize: FONT_SIZES.sm,
  },
  subjectRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  selectedRow: {
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  subjectName: {
    fontSize: FONT_SIZES.sm + 1,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  selectedSubjectName: {
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  checkmark: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primaryLight,
    fontWeight: '700',
  },
  addDomainButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  addDomainButtonText: {
    color: COLORS.primaryLight,
    fontSize: FONT_SIZES.sm + 1,
    fontWeight: 'bold',
  },
  textInput: {
    backgroundColor: COLORS.bgSurface,
    color: COLORS.textPrimary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: FONT_SIZES.md,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: 4,
  },
  saveDomainButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  saveDomainButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: FONT_SIZES.md,
  },
});

export default SubjectPicker;
