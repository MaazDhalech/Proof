import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Friend = {
  id: string;
  name: string;
  username: string;
};

export default function FriendsScreen() {
  const [searchText, setSearchText] = useState<string>('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUserAndData = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      const currentUserId = session?.user?.id ?? null;
      setUserId(currentUserId);

      if (currentUserId) {
        await fetchFriends(currentUserId);
      } else {
        console.warn('No authenticated user found.');
      }
    };

    loadUserAndData();
  }, []);

  const fetchFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from('friendships')
      .select('friend_id, profile:friend_id (username, first_name, last_name)')
      .eq('user_id', userId)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
    } else if (data) {
      const formatted: Friend[] = data.map((item: any) => ({
        id: item.friend_id,
        name: `${item.profile?.first_name ?? ''} ${item.profile?.last_name ?? ''}`.trim(),
        username: item.profile?.username ?? '',
      }));
      setFriends(formatted);
    }
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchText.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendCard}>
      <Text style={styles.friendName}>{item.name}</Text>
      <Text style={styles.friendUsername}>@{item.username}</Text>
      <TouchableOpacity style={styles.unfriendButton}>
        <Text style={styles.unfriendText}>Unfriend</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.heading}>Your Friends</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search friends..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Buttons */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/friends/requests')} // 👈 adjust route if needed
        >
          <Text style={styles.buttonText}>Friend Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/friends/explore')} // 👈 adjust route if needed
        >
          <Text style={styles.buttonText}>Add New Friends</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff' },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#111' },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  friendCard: {
    backgroundColor: '#f1f1f1',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  friendName: { fontSize: 18, fontWeight: '600', color: '#111' },
  friendUsername: { fontSize: 14, color: '#666', marginTop: 4 },
  unfriendButton: {
    marginTop: 8,
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  unfriendText: { color: '#fff', fontWeight: '600' },
  buttonGroup: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#888',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
