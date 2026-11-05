import { Stack, useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '../components/Theme';
import { isDarkBackground } from '../lib/theme';
import {
  handleWorkoutNotificationResponse,
  registerWorkoutNotificationTask,
  syncActiveWorkoutNotification,
} from '../lib/workoutNotification';

export const unstable_settings = {
  initialRouteName: 'index',
};

const ANDROID_HEADER_CONTENT_HEIGHT = 52;

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedStack />
    </ThemeProvider>
  );
}

function ThemedStack() {
  const router = useRouter();
  const { theme } = useTheme();
  const rootBackground = theme.gradientColors?.[0] ?? theme.background;

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(rootBackground);
  }, [rootBackground]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    void registerWorkoutNotificationTask();
    void syncActiveWorkoutNotification();

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleWorkoutNotificationResponse(response).then((href) => {
        if (href) {
          router.push(href as Href);
        }
      });
    });

    return () => subscription.remove();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: rootBackground }}>
      <StatusBar style={isDarkBackground(theme.background) ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: rootBackground,
          },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: rootBackground },
          ...(Platform.OS === 'android'
            ? {
                header: ({ navigation, options, route, back }) => (
                  <AndroidHeader
                    backgroundColor={rootBackground}
                    textColor={theme.text}
                    title={
                      typeof options.headerTitle === 'string'
                        ? options.headerTitle
                        : options.title ?? route.name
                    }
                    canGoBack={Boolean(back)}
                    onBack={navigation.goBack}
                  />
                ),
              }
            : {}),
        }}
      />
    </View>
  );
}

function AndroidHeader({
  backgroundColor,
  textColor,
  title,
  canGoBack,
  onBack,
}: {
  backgroundColor: string;
  textColor: string;
  title: string;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.androidHeader,
        {
          backgroundColor,
          paddingTop: insets.top,
          height: ANDROID_HEADER_CONTENT_HEIGHT + insets.top,
        },
      ]}
    >
      {canGoBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={8}
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={[styles.backIcon, { color: textColor }]}>←</Text>
        </Pressable>
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          styles.androidHeaderTitle,
          { color: textColor },
          !canGoBack && styles.androidRootTitle,
        ]}
      >
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  androidHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 64,
    height: ANDROID_HEADER_CONTENT_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 30,
    lineHeight: 34,
  },
  androidHeaderTitle: {
    flex: 1,
    paddingRight: 20,
    fontSize: 20,
    fontWeight: '600',
  },
  androidRootTitle: {
    paddingLeft: 20,
  },
});
