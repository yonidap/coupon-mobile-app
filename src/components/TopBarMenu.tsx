import { useEffect, useRef, useState } from 'react';
import { Animated, Alert, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { type SupportedLanguage } from '../features/settings/language';
import { useAppLanguage } from '../hooks/useAppLanguage';
import { LanguageSlider } from './LanguageSlider';
import { premiumTheme } from '../theme/premium';

type TopBarMenuProps = {
  currentLanguage: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => Promise<void> | void;
  onHome: () => void;
  onSettings: () => void;
  onSignOut: () => Promise<void> | void;
  showSettings?: boolean;
};

export function TopBarMenu({ currentLanguage, onLanguageChange, onHome, onSettings, onSignOut, showSettings = true }: TopBarMenuProps) {
  const [isVisible, setVisible] = useState(false);
  const [isMounted, setMounted] = useState(false);
  const [isSavingLanguage, setSavingLanguage] = useState(false);
  const { copy, isRtl } = useAppLanguage();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.82));
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
      }
    });
  }, [isVisible, progress]);

  function openMenu() {
    setVisible(true);
  }

  function closeMenu() {
    setVisible(false);
  }

  async function handleLanguageSelect(language: SupportedLanguage) {
    if (language === currentLanguage) {
      return;
    }

    try {
      setSavingLanguage(true);
      await onLanguageChange(language);
    } catch (error) {
      console.error('[TopBarMenu] Language change failed:', error);
      Alert.alert(copy.menu.languageUpdateFailedTitle, copy.menu.languageUpdateFailedMessage);
    } finally {
      setSavingLanguage(false);
    }
  }

  async function handleSignOut() {
    try {
      closeMenu();
      await onSignOut();
    } catch (error) {
      console.error('[TopBarMenu] Sign out failed:', error);
      Alert.alert(copy.menu.signOutFailedTitle, copy.menu.signOutFailedMessage);
    }
  }

  return (
    <>
      <Pressable
        accessibilityLabel={copy.menu.openMenu}
        accessibilityRole="button"
        onPress={openMenu}
        style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}
        hitSlop={10}
      >
        <View style={styles.iconStack}>
          <View style={styles.iconLine} />
          <View style={[styles.iconLine, styles.iconLineShort]} />
          <View style={styles.iconLine} />
        </View>
      </Pressable>

      <Modal visible={isMounted} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.backdrop}>
          <Animated.View
            style={[
              styles.backdropDimmer,
              {
                opacity: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 1],
                }),
              },
            ]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          <Animated.View
            style={[
              styles.card,
              {
                width: panelWidth,
                opacity: progress,
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [panelWidth + 24, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.grip} />
            <Pressable
              style={styles.item}
              onPress={() => {
                closeMenu();
                onHome();
              }}
            >
              <Text style={[styles.itemText, isRtl ? styles.itemTextRtl : null]}>{copy.menu.overview}</Text>
            </Pressable>
            {showSettings ? (
              <Pressable
                style={styles.item}
                onPress={() => {
                  closeMenu();
                  onSettings();
                }}
              >
                <Text style={[styles.itemText, isRtl ? styles.itemTextRtl : null]}>{copy.menu.settings}</Text>
              </Pressable>
            ) : null}

            <View style={[styles.languageItem, isRtl ? styles.languageItemRtl : null]}>
              <Text style={[styles.languageLabel, isRtl ? styles.languageLabelRtl : null]}>{copy.language.label}</Text>
              <LanguageSlider
                value={currentLanguage}
                compact
                onChange={(language) => void handleLanguageSelect(language)}
                disabled={isSavingLanguage}
                style={styles.languageSlider}
              />
            </View>

            <Pressable
              style={[styles.item, styles.dangerItem]}
              onPress={() => void handleSignOut()}
            >
              <Text style={[styles.itemText, isRtl ? styles.itemTextRtl : null, styles.dangerText]}>{copy.menu.signOut}</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: premiumTheme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  triggerPressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: premiumTheme.colors.surfaceTint,
  },
  iconStack: {
    width: 18,
    gap: 3,
  },
  iconLine: {
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: premiumTheme.colors.text,
  },
  iconLineShort: {
    width: 12,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  backdropDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 27, 42, 0.42)',
  },
  card: {
    height: '100%',
    borderRadius: premiumTheme.radius.xl,
    backgroundColor: premiumTheme.colors.surface,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 20,
    shadowColor: premiumTheme.colors.shadowStrong,
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    gap: 8,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: premiumTheme.colors.border,
    marginBottom: 8,
  },
  item: {
    minHeight: 48,
    borderRadius: premiumTheme.radius.md,
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginBottom: 8,
  },
  itemText: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  itemTextRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  dangerItem: {
    backgroundColor: premiumTheme.colors.dangerSoft,
  },
  dangerText: {
    color: premiumTheme.colors.danger,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
    borderRadius: premiumTheme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: premiumTheme.colors.surfaceTint,
    borderWidth: 1,
    borderColor: premiumTheme.colors.border,
    marginBottom: 8,
  },
  languageItemRtl: {
    flexDirection: 'row-reverse',
  },
  languageLabel: {
    color: premiumTheme.colors.text,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 72,
  },
  languageLabelRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  languageSlider: {
    flex: 1,
  },
});
