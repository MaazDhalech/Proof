// app/goals/[goalId]/index.tsx
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function GoalDetailsScreen() {
  const { goalId } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Goal ID: {goalId}</Text>
      {/* Replace with actual goal detail logic */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});
