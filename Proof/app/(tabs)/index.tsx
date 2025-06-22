import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function HomeFeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      const currentUserId = session?.user?.id ?? null;
      setUserId(currentUserId);

      if (currentUserId) {
        fetchFeed(currentUserId);
      }
    };

    getCurrentUser();
  }, []);

  const fetchFeed = async (currentUserId: string) => {
    try {
      const { data: friendData, error: friendError } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', currentUserId)
        .eq('status', 'accepted');

      if (friendError) throw friendError;

      const friendIds = friendData?.map((entry) => entry.friend_id) || [];

      if (!friendIds.length) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const { data: postData, error: postError } = await supabase
        .from('proof')
        .select(`
          id,
          user_id,
          caption,
          created_at,
          profile (
            username,
            profile_picture
          ),
          challenges (
            name
          )
        `)
        .in('user_id', friendIds)
        .order('created_at', { ascending: false });

      if (postError) throw postError;

      setPosts(postData);
    } catch (err) {
      console.error('Feed load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderPost = ({ item }: { item: any }) => (
    <View style={styles.post}>
      <View style={styles.userRow}>
        <Image
          source={{ uri: item.profile?.profile_picture || 'https://placehold.co/48x48' }}
          style={styles.avatar}
        />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.username}>@{item.profile?.username}</Text>
          <Text style={styles.goal}>{item.challenges?.name}</Text>
        </View>
      </View>

      <Image source={{ uri: item.picture }} style={styles.image} />
      {item.caption && <Text style={styles.caption}>{item.caption}</Text>}
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Proofs</Text>

        {loading ? (
          <ActivityIndicator size="large" color="#007aff" />
        ) : posts.length ? (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPost}
            contentContainerStyle={styles.feedContainer}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Text style={styles.emptyText}>No posts from your friends yet.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 16,
  },
  feedContainer: {
    paddingBottom: 100,
  },
  post: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ddd',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#111',
  },
  goal: {
    fontSize: 13,
    color: '#555',
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 10,
    marginTop: 10,
  },
  caption: {
    fontSize: 14,
    marginTop: 8,
    color: '#333',
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#666',
    fontSize: 16,
  },
});
