import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const dummyGoals = [
  {
    id: '1',
    title: 'Read 10 pages a day',
    category: 'academics',
  },
  {
    id: '2',
    title: 'Workout 4 times a week',
    category: 'fitness',
  },
];

export default function GoalsScreen() {
  const [goals, setGoals] = useState(dummyGoals);
  const router = useRouter();

  const handleCheckIn = (goalId: string) => {
    router.push({
      pathname: '/goals/[goalId]/checkin',
      params: { goalId },
    });
  };

  const handleCreateGoal = () => {
    router.push('/(tabs)/goals/create');
  };

  const renderGoal = ({ item }: { item: (typeof dummyGoals)[0] }) => (
    <View style={styles.goalCard}>
      <Text style={styles.goalTitle}>{item.title}</Text>
      <Text style={styles.goalCategory}>{item.category}</Text>
      <TouchableOpacity style={styles.checkInButton} onPress={() => handleCheckIn(item.id)}>
        <Text style={styles.checkInText}>Check In</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Your Goals</Text>

        <FlatList
          data={goals}
          renderItem={renderGoal}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />

        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateGoal}
        >
          <Text style={styles.createText}>+ Create a New Goal</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 60, paddingHorizontal: 20 },
  heading: { fontSize: 28, fontWeight: 'bold', color: '#111', marginBottom: 24 },
  goalCard: {
    backgroundColor: '#f1f1f1',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
  },
  goalTitle: { fontSize: 18, fontWeight: '600', color: '#111' },
  goalCategory: { fontSize: 14, color: '#555', marginTop: 4 },
  checkInButton: {
    marginTop: 10,
    backgroundColor: '#007aff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  checkInText: { color: '#fff', fontWeight: '600' },
  createButton: {
    backgroundColor: '#28a745',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  createText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
