import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Screen } from '../../components/Screen';
import { useTheme } from '../../components/Theme';

export default function HistoryHubScreen() {
  const router = useRouter();
  const { theme } = useTheme();

  return (
    <Screen>
      <Stack.Screen options={{ title: 'История' }} />
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/history/workouts')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>История тренировок</Text>
      </Pressable>
      <Pressable style={[styles.secondary, { borderColor: theme.accent }]} onPress={() => router.push('/weights')}>
        <Text style={[styles.secondaryLabel, { color: theme.text }]}>Успешные веса</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
