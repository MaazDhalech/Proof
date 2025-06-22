import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Goal = {
  id: number;
  title: string;
  category: string;
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGoals = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession(); 
      const uid = session?.user.id;
      if (!uid) return;

      const { data, error } = await supabase
        .from('challenges')
        .select('id, name, description')
        .eq('user_id', uid);

      if (error) {
        console.error('Error fetching goals:', error);
      } else {
        const formatted = data?.map((item) => ({
          id: item.id,
          title: item.name,
          category: item.description,
        }));
        setGoals(formatted || []);
      }

      setLoading(false);
    };

    fetchGoals();
  }, []);

  const renderGoal = ({ item }: { item: Goal }) => (
    <View style={styles.goalCard}>
      <Text style={styles.goalTitle}>{item.title}</Text>
      <Text style={styles.category}>{item.category}</Text>
      <TouchableOpacity
        style={styles.checkInButton}
        onPress={() => router.push(`/goals/${item.id}/check-in`)}
      >
        <Text style={styles.checkInText}>Check In</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Your Goals</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGoal}
          contentContainerStyle={styles.goalList}
          ListEmptyComponent={<Text>No goals yet. Create one below!</Text>}
        />
      )}

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
