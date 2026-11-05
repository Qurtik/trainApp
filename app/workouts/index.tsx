import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';
import { listBlocks, type BlockSummary } from '../../lib/db';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBlocks(await listBlocks());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh()
        .catch((cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Не удалось открыть блоки');
        })
        .finally(() => setLoading(false));
    }, [refresh]),
  );

  return (
    <Screen
      loading={loading}
      footer={(
        <Pressable style={[styles.primary, { backgroundColor: theme.accent }]} onPress={() => router.push('/block/new')}>
          <Text style={[styles.primaryLabel, { color: theme.accentText }]}>Новый блок</Text>
        </Pressable>
      )}
    >
      <Stack.Screen options={{ title: 'Блок упражнений' }} />
      {error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
      {blocks.length === 0 ? <Text style={[styles.empty, { color: theme.muted }]}>Пока нет блоков</Text> : null}
      {blocks.map((block) => (
        <Pressable key={block.id} style={[styles.card, { borderColor: theme.border }]} onPress={() => router.push(`/block/${block.id}`)}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>{block.name}</Text>
          <Text style={[styles.cardMeta, { color: theme.muted }]}>Упражнений: {block.exerciseCount}</Text>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  primary: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: {
    fontSize: 16,
  },
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
