import { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { SUPPORTED_LANGUAGE_CODES, type SupportedLanguage } from '../features/settings/language';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { premiumTheme } from '../theme/premium';

type LanguageSliderProps = {
  value: SupportedLanguage;
  onChange: (language: SupportedLanguage) => void;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRACK_PADDING = 4;
const TRACK_SIDE_PADDING_LEFT = 4;
const TRACK_SIDE_PADDING_RIGHT = 5;
const TRACK_GAP = 4;
const COMPACT_LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'EN',
  he: 'עב',
};
const REGULAR_LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  he: 'עברית',
};

export function LanguageSlider({ value, onChange, disabled = false, compact = false, style }: LanguageSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(value === 'en' ? 0 : 1)).current;
  const { copy } = useAppLanguage();

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value === 'en' ? 0 : 1,
      useNativeDriver: true,
      tension: 210,
      friction: 20,
    }).start();
  }, [progress, value]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;

    if (nextWidth !== trackWidth) {
      setTrackWidth(nextWidth);
    }
  }

  const innerWidth = Math.max(trackWidth - TRACK_SIDE_PADDING_LEFT - TRACK_SIDE_PADDING_RIGHT, 0);
  const thumbWidth = Math.max((innerWidth - TRACK_GAP) / 2, 0);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, thumbWidth + TRACK_GAP],
  });

  const compactTrackStyle = compact ? styles.trackCompact : null;
  const compactThumbStyle = compact ? styles.thumbCompact : null;
  const compactOptionStyle = compact ? styles.optionCompact : null;
  const compactTextStyle = compact ? styles.optionTextCompact : null;

  return (
    <View style={[styles.wrapper, style]} onLayout={handleLayout}>
      <View style={[styles.track, compactTrackStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.thumb,
            compactThumbStyle,
            {
              width: thumbWidth,
              opacity: trackWidth > 0 ? 1 : 0,
              transform: [{ translateX }],
            },
          ]}
        />
        {SUPPORTED_LANGUAGE_CODES.map((language) => {
          const isSelected = value === language;
          const accessibilityLabel = language === 'en' ? copy.language.switchToEnglish : copy.language.switchToHebrew;

          return (
            <Pressable
              key={language}
              accessibilityRole="button"
              accessibilityLabel={accessibilityLabel}
              accessibilityState={{ selected: isSelected, disabled }}
              disabled={disabled}
              onPress={() => onChange(language)}
              style={({ pressed }) => [styles.option, compactOptionStyle, pressed && !disabled ? styles.optionPressed : null]}
            >
              <Text style={[styles.optionText, compactTextStyle, isSelected ? styles.optionTextActive : null]}>
                {compact ? COMPACT_LANGUAGE_LABELS[language] : REGULAR_LANGUAGE_LABELS[language]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  track: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    direction: 'ltr',
    minHeight: 56,
    paddingVertical: TRACK_PADDING,
    paddingLeft: TRACK_SIDE_PADDING_LEFT,
    paddingRight: TRACK_SIDE_PADDING_RIGHT,
    borderRadius: 18,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    overflow: 'hidden',
  },
  trackCompact: {
    minHeight: 44,
    borderRadius: 16,
  },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_SIDE_PADDING_LEFT,
    borderRadius: 14,
    backgroundColor: premiumTheme.colors.accentSoft,
    borderWidth: 1,
    borderColor: premiumTheme.colors.accentStrong,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  thumbCompact: {
    borderRadius: 12,
  },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  optionCompact: {
    minHeight: 36,
  },
  optionPressed: {
    opacity: 0.84,
  },
  optionText: {
    color: premiumTheme.colors.mutedStrong,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  optionTextCompact: {
    fontSize: 12,
  },
  optionTextActive: {
    color: premiumTheme.colors.accentStrong,
  },
});
