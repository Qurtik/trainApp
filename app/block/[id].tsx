import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import { getBlock, type BlockDetails } from '../../lib/db';
import { formatWeightLabel, isBodyweight } from '../../lib/format';

export default function BlockScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const blockId = Number(id);
  const [block, setBlock] = useState<BlockDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getBlock(blockId)
        .then(setBlock)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть блок');
        })
        .finally(() => setLoading(false));
    }, [blockId]),
  );

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: block?.name ?? 'Блок' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {block?.slots.length === 0 ? <Text style={[styles.empty, { color: theme.muted }]}>В блоке нет упражнений</Text> : null}
      {block?.slots.map((slot) => (
        <View key={slot.slotId} style={styles.slot}>
          {slot.variants.map((exercise, index) => (
            <Text
              key={exercise.id}
              style={[styles.exercise, { color: index > 0 ? theme.muted : theme.text }]}
            >
              {index > 0 ? 'или ' : ''}
              {exercise.name}: {exercise.sets}×{exercise.reps}
              {isBodyweight(exercise.startingWeight)
                ? ', свой вес'
                : `, шаг ${formatWeightLabel(exercise.weightStep)}, старт ${formatWeightLabel(exercise.startingWeight)}`}
            </Text>
          ))}
        </View>
      ))}
      {block ? (
        <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push(`/block/edit/${block.id}`)}>
          <Text style={[styles.secondaryLabel, { color: theme.text }]}>Редактировать</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  slot: {
    marginBottom: 12,
  },
  exercise: {
    fontSize: 16,
    marginBottom: 4,
  },
  empty: {},
  error: {
    marginBottom: 8,
  },
  secondary: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryLabel: {
    fontSize: 16,
  },
});
