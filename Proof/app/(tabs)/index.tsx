import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';

interface Post {
  id: string;
  user_id: string;
  caption: string;
  created_at: string;
  picture_url: string;
  likes: number;
  profile: {
    username: string;
    profile_picture: string;
  };
  challenges: {
    name: string;
  };
  userHasLiked?: boolean;
}

export default function HomeFeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set());

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
          picture_url,
          likes,
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

      // Check which posts the current user has liked
      const postIds = postData?.map(post => post.id) || [];
      const { data: userLikes, error: likesError } = await supabase
        .from('user_likes')
        .select('proof_id')
        .eq('user_id', currentUserId)
        .in('proof_id', postIds);

      if (likesError) {
        console.warn('Could not fetch user likes:', likesError);
      }

      const likedPostIds = new Set(userLikes?.map(like => like.proof_id) || []);

      const postsWithLikeStatus = postData?.map(post => ({
        ...post,
        userHasLiked: likedPostIds.has(post.id)
      })) || [];

      setPosts(postsWithLikeStatus);
    } catch (err) {
      console.error('Feed load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string, currentLikes: number, userHasLiked: boolean) => {
    if (!userId || likingPosts.has(postId)) return;

    setLikingPosts(prev => new Set(prev).add(postId));

    try {
      if (userHasLiked) {
        // Unlike the post
        const { error: unlikeError } = await supabase
          .from('user_likes')
          .delete()
          .eq('user_id', userId)
          .eq('proof_id', postId);

        if (unlikeError) throw unlikeError;

        const { error: decrementError } = await supabase
          .from('proof')
          .update({ likes: Math.max(0, currentLikes - 1) })
          .eq('id', postId);

        if (decrementError) throw decrementError;

        // Update local state
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, likes: Math.max(0, post.likes - 1), userHasLiked: false }
              : post
          )
        );
      } else {
        // Like the post
        const { error: likeError } = await supabase
          .from('user_likes')
          .insert({ user_id: userId, proof_id: postId });

        if (likeError) throw likeError;

        const { error: incrementError } = await supabase
          .from('proof')
          .update({ likes: currentLikes + 1 })
          .eq('id', postId);

        if (incrementError) throw incrementError;

        // Update local state
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, likes: post.likes + 1, userHasLiked: true }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like. Please try again.');
    } finally {
      setLikingPosts(prev => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
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

      <Image source={{ uri: `data:image/jpeg;base64,${item.picture_url}` }} style={styles.image} />
      {item.caption && <Text style={styles.caption}>{item.caption}</Text>}
      
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.likeButton, item.userHasLiked && styles.likeButtonActive]}
          onPress={() => handleLike(item.id, item.likes, item.userHasLiked || false)}
          disabled={likingPosts.has(item.id)}
        >
          <Text style={[styles.likeButtonText, item.userHasLiked && styles.likeButtonTextActive]}>
            {likingPosts.has(item.id) ? '...' : item.userHasLiked ? '❤️' : '🤍'} {item.likes || 0}
          </Text>
        </TouchableOpacity>
      </View>

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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  likeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e8e8e8',
  },
  likeButtonActive: {
    backgroundColor: '#ffe8e8',
  },
  likeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  likeButtonTextActive: {
    color: '#e91e63',
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