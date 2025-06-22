import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';

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
      // ✅ Corrected: Get list of friend_ids from 'friendships' table
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

      // ✅ Get recent posts from friends
      const { data: postData, error: postError } = await supabase
        .from('proof')
        .select(`
          id,
          user_id,
          picture,
          caption,
          created_at,
          profile (
            username,
            profile
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
      <Image source={{ uri: item.picture }} style={styles.image} />
      <Text style={styles.username}>{item.profile?.username}</Text>
      <Text style={styles.goal}>Goal: {item.challenges?.name}</Text>
      {item.caption && <Text style={styles.caption}>{item.caption}</Text>}
      <Text style={styles.timestamp}>
        {new Date(item.created_at).toLocaleString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading ? (
        <Text>Loading feed...</Text>
      ) : posts.length ? (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPost}
        />
      ) : (
        <Text>No posts from your friends yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  post: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
  },
  image: {
    width: '100%',
    height: 240,
    borderRadius: 10,
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 8,
  },
  goal: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  caption: {
    fontSize: 14,
    marginTop: 6,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
});
