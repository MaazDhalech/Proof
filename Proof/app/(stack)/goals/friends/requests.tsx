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
  requestId: number;
};

type Profile = {
  first_name: string;
  last_name: string;
  username: string;
};

type FriendshipRecord = {
  id: number;
  user_id: string;
  profile: Profile | Profile[] | null;
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
      .select(`
        id,
        user_id,
        profile: user_id (
          first_name,
          last_name,
          username
        )
      `)
      .eq('friend_id', uid)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching friend requests:', error);
      return;
    }

    const formatted: UserRequest[] = (data as FriendshipRecord[]).map((req) => {
      const profile = Array.isArray(req.profile) ? req.profile[0] : req.profile;
      return {
        id: req.user_id,
        name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        username: profile?.username ?? '',
        requestId: req.id,
      };
    });

    setRequests(formatted);
    setLoading(false);
  };

  const handleResponse = async (requestId: number, accept: boolean) => {
    if (accept) {
      await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
    } else {
      await supabase.from('friendships').delete().eq('id', requestId);
    }

    setRequests((prev) => prev.filter((r) => r.requestId !== requestId));
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    const words = name.trim().split(' ');
    return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase();
  };

  const renderRequest = ({ item }: { item: UserRequest }) => (
    <View style={styles.card}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </View>
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
        <Text style={styles.backButtonText}>← Back</Text>
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
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e1e3e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    color: '#0066ff',
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
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
