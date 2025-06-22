import { router } from 'expo-router';
import React from 'react';
import {
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const mockGoals = [
  {
    id: '1',
    title: 'Read 10 pages daily',
    category: 'Academics',
    emoji: '📚',
  },
  {
    id: '2',
    title: 'Workout 5x a week',
    category: 'Fitness',
    emoji: '💪',
  },
  {
    id: '3',
    title: 'Sleep by 11 PM',
    category: 'Health',
    emoji: '😴',
  },
];

export default function GoalsPage() {
  const renderGoal = ({ item }: { item: typeof mockGoals[0] }) => (
    <View style={styles.goalCard}>
      <Text style={styles.goalTitle}>{item.emoji} {item.title}</Text>
      <Text style={styles.category}>{item.category}</Text>
      <TouchableOpacity
        style={styles.checkInButton}
        onPress={() => router.push({ pathname: `/goals/${item.id}/checkin` })}

      >
        <Text style={styles.checkInText}>Check In</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Your Goals</Text>

      <FlatList
        data={mockGoals}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        contentContainerStyle={styles.goalList}
      />

      <TouchableOpacity
        style={styles.createButton}
        onPress={() => router.push('/goals/create')}
      >
        <Text style={styles.createButtonText}>+ Create New Goal</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginTop: 20,
    marginBottom: 12,
  },
  goalList: {
    paddingBottom: 80,
  },
  goalCard: {
    backgroundColor: '#f2f2f2',
    padding: 16,
    borderRadius: 10,
    marginVertical: 8,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
  },
  category: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  checkInButton: {
    marginTop: 10,
    backgroundColor: '#007aff',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  checkInText: {
    color: '#fff',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 10,
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
