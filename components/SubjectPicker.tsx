import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { getSubjectsByCategory, getSubjectById } from '../models/subjects';
import { SubjectCategory, MathSubject } from '../models/types';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

/**
 * Props for the {@link SubjectPicker} component.
 */
export interface SubjectPickerProps {
  /** ID of the currently selected subject (or undefined if none selected) */
  selectedSubjectId?: string;
  /** Callback triggered when a subject is selected or cleared */
  onSubjectChange: (subjectId: string | undefined) => void;
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
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedSubject = selectedSubjectId ? getSubjectById(selectedSubjectId) : undefined;
  const subjectsByCategory = getSubjectsByCategory();

  const handleSelect = (subjectId: string | undefined) => {
    onSubjectChange(subjectId);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* Selector Trigger Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        style={[
          styles.triggerButton,
          selectedSubject && styles.triggerButtonActive,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Select Math Subject"
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
                {(Object.keys(subjectsByCategory) as SubjectCategory[]).map((category) => {
                  const subjects = subjectsByCategory[category];
                  if (!subjects || subjects.length === 0) return null;

                  return (
                    <View key={category} style={styles.categoryGroup}>
                      <Text style={styles.categoryHeader}>{category}</Text>
                      {subjects.map((subj: MathSubject) => {
                        const isSelected = subj.id === selectedSubjectId;

                        return (
                          <TouchableOpacity
                            key={subj.id}
                            activeOpacity={0.7}
                            onPress={() => handleSelect(subj.id)}
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
                            {isSelected && <Text style={styles.checkmark}>✓</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
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
  categoryHeader: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primaryLight,
    letterSpacing: 1.1,
    marginBottom: SPACING.xs,
    textTransform: 'uppercase',
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
});

export default SubjectPicker;
