import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import { listBlocks, type BlockSummary } from '../../lib/db';

export default function StartScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      listBlocks()
        .then(setBlocks)
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть блоки');
        })
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <Screen loading={loading}>
      <Stack.Screen options={{ title: 'Выбор тренировки' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {blocks.length === 0 ? (
        <Text style={[styles.empty, { color: theme.muted }]}>Сначала создайте блок в разделе «Блок упражнений»</Text>
      ) : null}
      {blocks.map((block) => (
        <Pressable key={block.id} style={[styles.card, { borderColor: theme.border }]} onPress={() => router.push(`/start/${block.id}`)}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{block.name}</Text>
          <Text style={[styles.cardMeta, { color: theme.muted }]}>Упражнений: {block.exerciseCount}</Text>
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
  },
  cardTitle: {
    fontSize: 16,
  },
  cardMeta: {
    marginTop: 4,
  },
  error: {
    marginBottom: 8,
  },
});
