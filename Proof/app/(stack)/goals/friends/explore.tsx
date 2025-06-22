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

  const filteredUsers = allUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchText.toLowerCase()) ||
      user.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.username}>@{item.username}</Text>
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
  {/* Back Button with spacing */}
  <View style={styles.backButtonWrapper}>
    <TouchableOpacity onPress={() => router.push('/friends')} style={styles.backButton}>
      <Text style={styles.backText}>← Back</Text>
    </TouchableOpacity>
  </View>

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
    backButtonWrapper: {
      marginBottom: 10,
      marginTop: 10,
    },
    backButton: {
      padding: 8,
      alignSelf: 'flex-start',
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
  