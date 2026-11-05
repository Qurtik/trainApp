import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../components/Screen';
import { useTheme } from '../components/Theme';
import { getActiveSession, type SessionSummary } from '../lib/db';

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [active, setActive] = useState<SessionSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      getActiveSession()
        .then(setActive)
        .catch(() => setActive(null));
    }, []),
  );

  return (
    <Screen centered>
      <Stack.Screen options={{ title: 'Добрыня' }} />
      <Pressable
        style={[styles.start, { backgroundColor: theme.accent }]}
        onPress={() => router.push(active ? `/session/${active.id}` : '/start')}
      >
        <Text style={[styles.startLabel, { color: theme.accentText }]}>
          {active ? 'Вернуться\nк тренировке' : 'Начать\nтренировку'}
        </Text>
      </Pressable>
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/workouts')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Блок упражнений</Text>
      </Pressable>
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/last')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Прошлая тренировка</Text>
      </Pressable>
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/history')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>История</Text>
      </Pressable>
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/settings')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Настройки</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  start: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  startLabel: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryLabel: {
    fontSize: 16,
  },
});
