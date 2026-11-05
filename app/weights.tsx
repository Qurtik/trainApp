import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { useTheme } from '../components/Theme';
import { listLatestSuccessfulWeights, type LatestSuccessfulWeight } from '../lib/db';
import { formatWeightLabel } from '../lib/format';

type BlockGroup = {
  blockName: string;
  exercises: LatestSuccessfulWeight[];
};

function groupByBlock(rows: LatestSuccessfulWeight[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.blockName === row.blockName) {
      last.exercises.push(row);
    } else {
      groups.push({ blockName: row.blockName, exercises: [row] });
    }
  }
  return groups;
}

export default function WeightsScreen() {
  const [rows, setRows] = useState<LatestSuccessfulWeight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const groups = groupByBlock(rows);

  useFocusEffect(
    useCallback(() => {
      listLatestSuccessfulWeights()
        .then(setRows)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось загрузить веса');
        })
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: 'Успешные веса' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {!error && rows.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>Упражнений ещё нет</Text>
      ) : null}
      {groups.map((group) => (
        <View key={group.blockName} style={styles.group}>
          <Text style={[styles.blockTitle, { color: theme.muted }]}>{group.blockName}</Text>
          {group.exercises.map((row) => (
            <View key={row.exerciseId} style={[styles.line, { borderTopColor: theme.border }]}>
              <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                {row.name}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {row.sets}×{row.reps}
              </Text>
              <Text style={[styles.meta, { color: theme.muted }]}>
                {row.succeededAt ? row.succeededAt.slice(0, 10) : '—'}
              </Text>
              <Text style={[styles.weight, { color: theme.text }]}>
                {row.weight === null && row.succeededAt === null
                  ? 'нет'
                  : formatWeightLabel(row.weightStep <= 0 ? 0 : row.weight)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    gap: 10,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
  meta: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  weight: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 64,
    textAlign: 'right',
  },
  empty: {},
  error: {
    marginBottom: 8,
  },
});
