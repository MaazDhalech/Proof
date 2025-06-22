import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type UserRequest = {
  id: string;
  name: string;
  username: string;
  requestId: number; // primary key in friendships table
};

export default function FriendRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) await fetchFriendRequests(uid);
    };

    init();
  }, []);

  const fetchFriendRequests = async (uid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .select('id, user_id, profile: user_id (first_name, last_name, username)')
      .eq('friend_id', uid)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching friend requests:', error);
      return;
    }

    const formatted: UserRequest[] = data.map((req) => ({
      id: req.user_id,
      name: `${req.profile?.first_name ?? ''} ${req.profile?.last_name ?? ''}`.trim(),
      username: req.profile?.username ?? '',
      requestId: req.id,
    }));

    setRequests(formatted);
    setLoading(false);
  };

  const handleResponse = async (requestId: number, accept: boolean) => {
    if (accept) {
      await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);
    } else {
      await supabase
        .from('friendships')
        .delete()
        .eq('id', requestId);
    }

    setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
  };

  const renderRequest = ({ item }: { item: UserRequest }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.username}>@{item.username}</Text>
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.accept]}
          onPress={() => handleResponse(item.requestId, true)}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.decline]}
          onPress={() => handleResponse(item.requestId, false)}
        >
          <Text style={styles.buttonText}>Decline</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.push('/friends')} style={styles.backButton}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Friend Requests</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#007aff" />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          ListEmptyComponent={<Text>No pending requests.</Text>}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  backText: {
    color: '#007aff',
    fontSize: 16,
    fontWeight: '600',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111',
  },
  card: {
    backgroundColor: '#f1f1f1',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  button: {
    padding: 10,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  accept: {
    backgroundColor: '#28a745',
  },
  decline: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
