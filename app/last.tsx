import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { useTheme } from '../components/Theme';
import { getLastSession, type SessionDetails } from '../lib/db';
import { formatDuration, formatWeightLabel } from '../lib/format';

export default function LastWorkoutScreen() {
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useFocusEffect(
    useCallback(() => {
      getLastSession()
        .then(setSession)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть тренировку');
        })
        .finally(() => setLoading(false));
    }, []),
  );

  const duration = session?.startedAt && session.finishedAt
    ? formatDuration(session.startedAt, new Date(session.finishedAt).getTime())
    : null;

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: 'Прошлая тренировка' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {!session && !error ? <Text style={[styles.empty, { color: theme.muted }]}>Завершённых тренировок ещё нет</Text> : null}
      {session ? (
        <View>
          <Text style={[styles.title, { color: theme.text }]}>{session.blockName}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>{session.plannedDate}</Text>
          <Text style={[styles.meta, { color: theme.muted }]}>Длительность: {duration ?? 'не записана'}</Text>
          {session.lines.map((line) => (
            <View
              key={line.id}
              style={[
                styles.line,
                { borderTopColor: theme.border },
                line.completed === true ? { backgroundColor: theme.success } : null,
                line.completed === false ? { backgroundColor: theme.fail } : null,
              ]}
            >
              <View style={styles.lineText}>
                <Text style={[styles.name, { color: theme.text }]}>{line.name}</Text>
                <Text style={[styles.lineMeta, { color: theme.muted }]}>
                  {formatWeightLabel(line.weightStep <= 0 ? 0 : line.weight)}, {line.sets}×{line.reps}
                </Text>
                {line.comment ? <Text style={[styles.lineMeta, { color: theme.muted }]}>{line.comment}</Text> : null}
              </View>
              <Text style={[styles.result, { color: theme.text }]}>
                {line.completed === true ? 'Получилось' : line.completed === false ? 'Не получилось' : 'Отметки не было'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  meta: {
    marginTop: 4,
    textAlign: 'center',
  },
  line: {
    marginTop: 14,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lineText: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    textAlign: 'left',
  },
  lineMeta: {
    marginTop: 4,
    textAlign: 'left',
  },
  result: {
    fontWeight: '600',
  },
  empty: {},
  error: {},
});
