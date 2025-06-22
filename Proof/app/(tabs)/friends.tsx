import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
  friendshipId: string;
};

export default function FriendsScreen() {
  const [searchText, setSearchText] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Error fetching session:', error.message);
      return;
    }

    const currentUserId = session?.user?.id ?? null;
    setUserId(currentUserId);

    if (currentUserId) {
      await fetchFriends(currentUserId);
    } else {
      console.warn('No authenticated user found.');
    }
  };

  const fetchFriends = async (userId: string) => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id,
        user_id,
        friend_id,
        sender:profile!friendships_user_id_fkey (
          id,
          username,
          first_name,
          last_name
        ),
        receiver:profile!friendships_friend_id_fkey (
          id,
          username,
          first_name,
          last_name
        )
      `)
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }

    const formatted: Friend[] = data.map((item: any) => {
      const isUserSender = item.user_id === userId;
      const profile = isUserSender ? item.receiver : item.sender;

      return {
        id: profile.id,
        name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        username: profile?.username ?? '',
        friendshipId: item.id,
      };
    });

    setFriends(formatted);
  };

  const handleUnfriend = async (friendId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      );

    if (error) {
      console.error('Error unfriending:', error);
    } else {
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    }
  };

  const onRefresh = async () => {
    if (userId) {
      setRefreshing(true);
      await fetchFriends(userId);
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchText.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.unfriendButton}
        onPress={() => handleUnfriend(item.id)}
      >
        <Text style={styles.unfriendText}>Unfriend</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ListHeaderComponent={
          <>
            <Text style={styles.heading}>Your Friends</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              value={searchText}
              onChangeText={setSearchText}
            />
          </>
        }
        data={filteredFriends}
        keyExtractor={(item) => item.friendshipId}
        renderItem={renderFriend}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(stack)/goals/friends/requests')}
        >
          <Text style={styles.buttonText}>Friend Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(stack)/goals/friends/explore')}
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
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  friendDetails: {
    flex: 1,
  },
  friendName: { fontSize: 18, fontWeight: '600', color: '#111' },
  friendUsername: { fontSize: 14, color: '#666', marginTop: 2 },
  unfriendButton: {
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
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
