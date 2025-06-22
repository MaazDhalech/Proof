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
    const { data: existingRelations, error } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', uid);

    if (error) {
      console.error('Error fetching friendships:', error);
      return;
    }

    const friendIds = existingRelations?.map((f) => f.friend_id) || [];
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
      setAllUsers((prev) => prev.filter((u) => u.id !== friendId));
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
        </View>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={() => sendFriendRequest(item.id)}
      >
        <Text style={styles.buttonText}>Send Friend Request</Text>
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

      <TextInput
        style={styles.searchInput}
        placeholder="Search users..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
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
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
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
    marginBottom: 8,
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
  button: {
    marginTop: 8,
    backgroundColor: '#007aff',
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
