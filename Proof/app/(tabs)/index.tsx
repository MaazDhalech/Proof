import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Post {
  id: string;
  user_id: string;
  caption: string;
  created_at: string;
  picture_url: string;
  likes: number;
  profile: {
    username: string;
    first_name: string | null;
    last_name: string | null;
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
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("Error fetching session:", error.message);
      setLoading(false);
      return;
    }

    const currentUserId = session?.user?.id ?? null;
    setUserId(currentUserId);

    if (currentUserId) {
      await fetchFeed(currentUserId);
    } else {
      console.warn("No authenticated user found.");
    }
    setLoading(false);
  };

const fetchFeed = async (currentUserId: string) => {
  try {
    // Fix: Select both user_id and friend_id to handle bidirectional friendships
    const { data: friendData, error: friendError } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
      .eq("status", "accepted");

    if (friendError) throw friendError;

    // Fix: Extract friend IDs from both directions of the relationship
    const friendIds = friendData?.reduce((acc: string[], entry) => {
      if (entry.user_id === currentUserId) {
        acc.push(entry.friend_id);
      } else if (entry.friend_id === currentUserId) {
        acc.push(entry.user_id);
      }
      return acc;
    }, []) || [];

    if (!friendIds.length) {
      setPosts([]);
      return;
    }

    const { data: postData, error: postError } = await supabase
      .from("proof")
      .select(
        `
        id,
        user_id,
        caption,
        created_at,
        picture_url,
        likes,
        profile:user_id (
          username,
          first_name,
          last_name,
          profile_picture
        ),
        challenges:challenge_id (
          name
        )
      `
      )
      .in("user_id", friendIds)
      .order("created_at", { ascending: false });

    if (postError) throw postError;

    // Check which posts the current user has liked
    const postIds = postData?.map((post) => post.id) || [];
    const { data: userLikes, error: likesError } = await supabase
      .from("user_likes")
      .select("proof_id")
      .eq("user_id", currentUserId)
      .in("proof_id", postIds);

    if (likesError) {
      console.warn("Could not fetch user likes:", likesError);
    }

    const likedPostIds = new Set(
      userLikes?.map((like) => like.proof_id) || []
    );

    const postsWithLikeStatus =
      postData?.map((post) => ({
        ...post,
        profile: Array.isArray(post.profile) ? post.profile[0] : post.profile,
        challenges: Array.isArray(post.challenges)
          ? post.challenges[0]
          : post.challenges,
        userHasLiked: likedPostIds.has(post.id),
      })) || [];

    setPosts(postsWithLikeStatus);
  } catch (err) {
    console.error("Feed load error:", err);
    Alert.alert("Error", "Failed to load feed. Please try again.");
  }
};

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchFeed(userId);
    setRefreshing(false);
  };

  const handleLike = async (
    postId: string,
    currentLikes: number,
    userHasLiked: boolean
  ) => {
    if (!userId || likingPosts.has(postId)) return;

    setLikingPosts((prev) => new Set(prev).add(postId));

    try {
      if (userHasLiked) {
        // Unlike the post
        const { error: unlikeError } = await supabase
          .from("user_likes")
          .delete()
          .eq("user_id", userId)
          .eq("proof_id", postId);

        if (unlikeError) throw unlikeError;

        const { error: decrementError } = await supabase
          .from("proof")
          .update({ likes: Math.max(0, currentLikes - 1) })
          .eq("id", postId);

        if (decrementError) throw decrementError;

        // Update local state
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  likes: Math.max(0, post.likes - 1),
                  userHasLiked: false,
                }
              : post
          )
        );
      } else {
        // Like the post
        const { error: likeError } = await supabase
          .from("user_likes")
          .insert({ user_id: userId, proof_id: postId });

        if (likeError) throw likeError;

        const { error: incrementError } = await supabase
          .from("proof")
          .update({ likes: currentLikes + 1 })
          .eq("id", postId);

        if (incrementError) throw incrementError;

        // Update local state
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? { ...post, likes: post.likes + 1, userHasLiked: true }
              : post
          )
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      Alert.alert("Error", "Failed to update like. Please try again.");
    } finally {
      setLikingPosts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(postId);
        return newSet;
      });
    }
  };

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return `${first}${last}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        {item.profile?.profile_picture ? (
          <Image
            source={{ uri: item.profile.profile_picture }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {getInitials(item.profile?.first_name, item.profile?.last_name)}
            </Text>
          </View>
        )}

        <View style={styles.userInfo}>
          <Text style={styles.userName}>
            {item.profile?.first_name || ""} {item.profile?.last_name || ""}
          </Text>
          <Text style={styles.username}>@{item.profile?.username}</Text>
        </View>
      </View>

      <View style={styles.challengeBadge}>
        <Text style={styles.challengeText}>{item.challenges?.name}</Text>
      </View>

      {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

      <Image
        source={{ uri: `data:image/jpeg;base64,${item.picture_url}` }}
        style={styles.postImage}
        resizeMode="cover"
        onError={(error) => console.log("Image load error:", error)}
        onLoad={() => console.log("Image loaded successfully")}
      />

      <View style={styles.postFooter}>
        <TouchableOpacity
          style={styles.likeButton}
          onPress={() =>
            handleLike(item.id, item.likes, item.userHasLiked || false)
          }
          disabled={likingPosts.has(item.id)}
        >
          <Text
            style={[
              styles.likeButtonText,
              item.userHasLiked && styles.likeButtonActive,
            ]}
          >
            {likingPosts.has(item.id)
              ? "..."
              : item.userHasLiked
                ? "❤️ Liked"
                : "🤍 Like"}{" "}
            • {item.likes || 0}
          </Text>
        </TouchableOpacity>

        <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Proofs</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007aff" />
          <Text style={styles.loadingText}>Loading proofs...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#007aff"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No proofs yet!</Text>
              <Text style={styles.emptySubtitle}>
                When your friends post proofs, they'll appear here
              </Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(stack)/goals/friends/explore")}
              >
                <Text style={styles.primaryButtonText}>Find Friends</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 70,
    marginBottom: 16,
    color: "#1a1a1a",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    maxWidth: 300,
  },
  postCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: "#666",
  },
  challengeBadge: {
    backgroundColor: "#dbeafe",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 12,
  },
  challengeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  caption: {
    fontSize: 15,
    color: "#333",
    marginBottom: 12,
    lineHeight: 22,
  },
  postImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  likeButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  likeButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  likeButtonActive: {
    color: "#e91e63",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
  },
  primaryButton: {
    backgroundColor: "#007aff",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#007aff",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    width: "100%",
    maxWidth: 200,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});
