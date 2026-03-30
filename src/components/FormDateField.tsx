import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppLanguage } from '../hooks/useAppLanguage';
import { premiumTheme } from '../theme/premium';

type FormDateFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
};

type DateParts = {
  year: string;
  month: string;
  day: string;
};

type DatePartKey = keyof DateParts;

type PickerOption = {
  value: string;
  label: string;
};

function toIsoDate(parts: DateParts): string {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseIsoDate(value: string): DateParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);

  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
    return null;
  }

  return {
    year: yearText,
    month: monthText,
    day: dayText,
  };
}

function isValidDateParts(parts: DateParts): boolean {
  return parseIsoDate(toIsoDate(parts)) !== null;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatPart(value: string, size: number): string {
  if (!value) {
    return '';
  }

  return value.padStart(size, '0');
}

function clampDay(day: string, year: string, month: string): string {
  if (!day || year.length !== 4 || month.length !== 2) {
    return day;
  }

  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);

  if (!Number.isInteger(yearNumber) || !Number.isInteger(monthNumber) || !Number.isInteger(dayNumber)) {
    return day;
  }

  if (monthNumber < 1 || monthNumber > 12) {
    return day;
  }

  const maxDay = getDaysInMonth(yearNumber, monthNumber);
  const boundedDay = Math.min(Math.max(dayNumber, 1), maxDay);
  return String(boundedDay).padStart(2, '0');
}

export const FormDateField = memo(function FormDateField({
  label,
  value,
  onChangeText,
  error,
}: FormDateFieldProps) {
  const { isRtl } = useAppLanguage();
  const [parts, setParts] = useState<DateParts>(() => {
    const parsed = parseIsoDate(value);

    if (parsed) {
      return parsed;
    }

    return {
      year: '',
      month: '',
      day: '',
    };
  });
  const [activePart, setActivePart] = useState<DatePartKey | null>(null);

  useEffect(() => {
    const parsed = parseIsoDate(value);

    if (parsed) {
      if (parsed.year !== parts.year || parsed.month !== parts.month || parsed.day !== parts.day) {
        setParts(parsed);
      }

      return;
    }

    if (value === '' && (parts.year || parts.month || parts.day)) {
      setParts({ year: '', month: '', day: '' });
    }
  }, [parts.day, parts.month, parts.year, value]);

  const pickerOptions = useMemo<PickerOption[]>(() => {
    if (!activePart) {
      return [];
    }

    if (activePart === 'year') {
      const startYear = 2026;
      const endYear = 2100;
      const options: PickerOption[] = [{ value: '', label: '--' }];

      for (let year = startYear; year <= endYear; year += 1) {
        options.push({ value: String(year), label: String(year) });
      }

      if (parts.year.length === 4) {
        const hasSelectedYear = options.some((option) => option.value === parts.year);

        if (!hasSelectedYear) {
          options.push({ value: parts.year, label: parts.year });
          options.sort((left, right) => {
            if (left.value === '') {
              return -1;
            }

            if (right.value === '') {
              return 1;
            }

            return Number(left.value) - Number(right.value);
          });
        }
      }

      return options;
    }

    if (activePart === 'month') {
      const options: PickerOption[] = [{ value: '', label: '--' }];

      for (let month = 1; month <= 12; month += 1) {
        const valueText = String(month).padStart(2, '0');
        options.push({ value: valueText, label: valueText });
      }

      return options;
    }

    const options: PickerOption[] = [{ value: '', label: '--' }];
    const yearNumber = Number(parts.year);
    const monthNumber = Number(parts.month);

    const maxDays = Number.isInteger(yearNumber) && Number.isInteger(monthNumber) && parts.year.length === 4 && parts.month.length === 2
      ? getDaysInMonth(yearNumber, monthNumber)
      : 31;

    for (let day = 1; day <= maxDays; day += 1) {
      const valueText = String(day).padStart(2, '0');
      options.push({ value: valueText, label: valueText });
    }

    return options;
  }, [activePart, parts.month, parts.year]);

  function emitValue(nextParts: DateParts) {
    if (!nextParts.year && !nextParts.month && !nextParts.day) {
      onChangeText('');
      return;
    }

    if (
      nextParts.year.length === 4
      && nextParts.month.length === 2
      && nextParts.day.length === 2
      && isValidDateParts(nextParts)
    ) {
      onChangeText(toIsoDate(nextParts));
      return;
    }

    onChangeText(`${nextParts.year}-${nextParts.month}-${nextParts.day}`);
  }

  function updatePart(partKey: DatePartKey, nextValue: string) {
    const normalizedValue = partKey === 'year' ? formatPart(nextValue, 4) : formatPart(nextValue, 2);

    const merged: DateParts = {
      ...parts,
      [partKey]: normalizedValue,
    };

    merged.day = clampDay(merged.day, merged.year, merged.month);

    setParts(merged);
    emitValue(merged);
  }

  function closePicker() {
    setActivePart(null);
  }

  function openPicker(partKey: DatePartKey) {
    setActivePart((current) => (current === partKey ? null : partKey));
  }

  const isPickerOpen = activePart !== null;

  function renderPartDropdown(partKey: DatePartKey) {
    if (activePart !== partKey) {
      return null;
    }

    return (
      <View style={styles.partDropdown}>
        <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent} nestedScrollEnabled>
          {pickerOptions.map((option) => {
            const selected = parts[partKey] === option.value;

            return (
              <Pressable
                key={`${partKey}-${option.value || 'empty'}`}
                style={[styles.pickerOption, selected ? styles.pickerOptionSelected : null]}
                onPress={() => {
                  updatePart(partKey, option.value);
                  closePicker();
                }}
              >
                <Text style={[styles.pickerOptionText, selected ? styles.pickerOptionTextSelected : null]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.fieldGroup, isPickerOpen ? styles.fieldGroupOpen : null]}>
      <Text style={[styles.label, isRtl ? styles.labelRtl : null]}>{label}</Text>
      {isPickerOpen ? <Pressable style={styles.backgroundDismissLayer} onPress={closePicker} /> : null}
      <View style={[styles.inputShell, isPickerOpen ? styles.inputShellOpen : null, error ? styles.inputShellError : null]}>
        <View style={styles.partsRow}>
          <View style={[styles.partSlot, styles.partSlotYear, activePart === 'year' ? styles.partSlotActive : null]}>
            <Pressable style={styles.partButton} onPress={() => openPicker('year')}>
              <Text style={[styles.partButtonText, parts.year ? null : styles.partButtonPlaceholder]}>{parts.year || 'YYYY'}</Text>
            </Pressable>
            {renderPartDropdown('year')}
          </View>
          <Text style={styles.separator}>/</Text>
          <View style={[styles.partSlot, activePart === 'month' ? styles.partSlotActive : null]}>
            <Pressable style={styles.partButton} onPress={() => openPicker('month')}>
              <Text style={[styles.partButtonText, parts.month ? null : styles.partButtonPlaceholder]}>{parts.month || 'MM'}</Text>
            </Pressable>
            {renderPartDropdown('month')}
          </View>
          <Text style={styles.separator}>/</Text>
          <View style={[styles.partSlot, activePart === 'day' ? styles.partSlotActive : null]}>
            <Pressable style={styles.partButton} onPress={() => openPicker('day')}>
              <Text style={[styles.partButtonText, parts.day ? null : styles.partButtonPlaceholder]}>{parts.day || 'DD'}</Text>
            </Pressable>
            {renderPartDropdown('day')}
          </View>
        </View>
      </View>
      {error ? <Text style={[styles.error, isRtl ? styles.errorRtl : null]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 8,
    position: 'relative',
  },
  fieldGroupOpen: {
    zIndex: 80,
    elevation: 80,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: premiumTheme.colors.mutedStrong,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  labelRtl: {
    textTransform: 'none',
    letterSpacing: 0,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  inputShell: {
    minHeight: 52,
    borderRadius: premiumTheme.radius.md,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  inputShellOpen: {
    position: 'relative',
    zIndex: 115,
    elevation: 115,
  },
  inputShellError: {
    borderColor: premiumTheme.colors.danger,
    backgroundColor: premiumTheme.colors.dangerSoft,
  },
  backgroundDismissLayer: {
    position: 'absolute',
    top: -2000,
    right: -2000,
    bottom: -2000,
    left: -2000,
    zIndex: 105,
  },
  partsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    overflow: 'visible',
  },
  partSlot: {
    flex: 1,
    position: 'relative',
  },
  partSlotYear: {
    flex: 1.3,
  },
  partSlotActive: {
    zIndex: 130,
    elevation: 130,
  },
  partButton: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  partButtonText: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  partButtonPlaceholder: {
    color: premiumTheme.colors.muted,
    fontWeight: '600',
  },
  separator: {
    color: premiumTheme.colors.muted,
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: premiumTheme.colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  errorRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  partDropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 44,
    maxHeight: 190,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surfaceStrong,
    padding: 8,
    gap: 8,
    zIndex: 120,
    elevation: 120,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
  },
  pickerList: {
    flexGrow: 0,
  },
  pickerListContent: {
    gap: 6,
  },
  pickerOption: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    backgroundColor: premiumTheme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOptionSelected: {
    borderColor: premiumTheme.colors.accentStrong,
    backgroundColor: premiumTheme.colors.accentSoft,
  },
  pickerOptionText: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  pickerOptionTextSelected: {
    color: premiumTheme.colors.accentStrong,
  },
});
