import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type User = {
  id: string;
  name: string;
  username: string;
  hasPendingRequest: boolean;
};

export default function ExploreFriendsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) await fetchUsersNotFriends(uid);
    };

    init();
  }, []);

  const fetchUsersNotFriends = async (uid: string) => {
    // Fetch existing friendships (accepted friends)
    const { data: existingRelations, error } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', uid)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friendships:', error);
      return;
    }

    // Fetch pending friend requests that I sent
    const { data: pendingRequests, error: pendingError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', uid)
      .eq('status', 'pending');

    if (pendingError) {
      console.error('Error fetching pending requests:', pendingError);
      return;
    }

    const friendIds = existingRelations?.map((f) => f.friend_id) || [];
    const pendingIds = pendingRequests?.map((f) => f.friend_id) || [];
    
    // Only exclude actual friends (accepted), not pending requests
    const excludedIds = [...friendIds, uid];
    const formattedList = `(${excludedIds.map((id) => `"${id}"`).join(',')})`;

    const { data: profiles, error: userError } = await supabase
      .from('profile')
      .select('id, username, first_name, last_name')
      .not('id', 'in', formattedList);

    if (userError) {
      console.error('Error fetching profiles:', userError);
      return;
    }

    const formatted = profiles.map((user) => ({
      id: user.id,
      username: user.username,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
      hasPendingRequest: pendingIds.includes(user.id),
    }));

    setAllUsers(formatted);
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase.from('friendships').insert([
      {
        user_id: currentUserId,
        friend_id: friendId,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error sending friend request:', error);
    } else {
      // Update the user's status to show pending request
      setAllUsers((prev) => 
        prev.map((user) => 
          user.id === friendId 
            ? { ...user, hasPendingRequest: true }
            : user
        )
      );
    }
  };

  const getInitials = (name: string) => {
    if (!name || name.trim() === '') return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const filteredUsers = allUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchText.toLowerCase()) ||
      user.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <View style={styles.userInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name || item.username)}</Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.username}>@{item.username}</Text>
          {item.hasPendingRequest && (
            <Text style={styles.pendingStatus}>Friend request sent</Text>
          )}
        </View>
      </View>
      <TouchableOpacity
        style={[
          styles.button,
          item.hasPendingRequest && styles.disabledButton
        ]}
        onPress={() => !item.hasPendingRequest && sendFriendRequest(item.id)}
        disabled={item.hasPendingRequest}
      >
        <Text style={[
          styles.buttonText,
          item.hasPendingRequest && styles.disabledButtonText
        ]}>
          {item.hasPendingRequest ? 'Request Pending' : 'Send Friend Request'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => router.push('/friends')}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.heading}>Explore New Friends</Text>
      <Text style={styles.subheading}>
        Discover and connect with new people
      </Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search by name or username..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No users found</Text>
            <Text style={styles.emptySubtext}>
              {searchText ? 'Try adjusting your search' : 'Check back later for new users'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
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
    marginBottom: 8,
    color: '#111',
  },
  subheading: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  searchInput: {
    height: 48,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  username: {
    fontSize: 15,
    color: '#666',
    marginBottom: 4,
  },
  pendingStatus: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '600',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});