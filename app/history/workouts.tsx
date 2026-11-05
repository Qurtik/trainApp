import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import { listHistory, type SessionSummary } from '../../lib/db';

export default function HistoryWorkoutsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listHistory()
        .then(setSessions)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть историю');
        })
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: 'История тренировок' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {sessions.length === 0 && !error ? <Text style={[styles.empty, { color: theme.muted }]}>Завершённых тренировок ещё нет</Text> : null}
      {sessions.map((session) => (
        <Pressable key={session.id} style={[styles.card, { borderColor: theme.border }]} onPress={() => router.push(`/session/${session.id}`)}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{session.blockName}</Text>
          <Text style={[styles.cardMeta, { color: theme.muted }]}>{session.plannedDate}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {},
  card: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
  },
  cardMeta: {
    flexShrink: 0,
    fontSize: 18,
  },
  error: {
    marginBottom: 8,
  },
});
