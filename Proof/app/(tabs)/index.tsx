import { supabase } from "@/services/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
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

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  longest_streak?: number;
  goals_completed?: number;
  total_goals?: number;
  goal_completion_rate?: number;
};

type UserStats = {
  goalsCompleted: number;
  longestStreak: number;
  completionRate: number;
  totalGoals: number;
};

type ViewProfilePopupProps = {
  userId: string;
  visible: boolean;
  onClose: () => void;
};

interface ReportData {
  reason: string;
  details?: string;
}

const reportReasons = [
  "Inappropriate content",
  "Spam",
  "Harassment",
  "Misinformation",
  "Other",
];

const ViewProfilePopup = ({
  userId,
  visible,
  onClose,
}: ViewProfilePopupProps) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    goalsCompleted: 0,
    longestStreak: 0,
    completionRate: 0,
    totalGoals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportData, setReportData] = useState<ReportData>({
    reason: "",
    details: "",
  });
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!visible || !userId) return;
      setLoading(true);
      try {
        // Fetch current user's blocked_users list
        const { data: currentUserData, error: currentUserError } =
          await supabase
            .from("profile")
            .select("blocked_users")
            .eq("id", (await supabase.auth.getSession()).data.session?.user.id)
            .single();

        if (currentUserError) throw currentUserError;

        const blockedUsers = currentUserData?.blocked_users || [];
        setIsBlocked(blockedUsers.includes(userId));

        const { data: profileData, error: profileError } = await supabase
          .from("profile")
          .select(
            "id, first_name, last_name, username, longest_streak, goals_completed, goal_completion_rate"
          )
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;

        const { count: totalChallenges, error: challengesError } =
          await supabase
            .from("challenges")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId);

        if (challengesError) throw challengesError;

        const totalGoals = totalChallenges || 0;
        const goalsCompleted = profileData.goals_completed || 0;
        const completionRate =
          totalGoals > 0 ? Math.round((goalsCompleted / totalGoals) * 100) : 0;

        setUser(profileData);
        setStats({
          goalsCompleted,
          longestStreak: profileData.longest_streak || 0,
          completionRate,
          totalGoals,
        });
      } catch (error) {
        console.error("Error fetching user profile:", error);
        Alert.alert("Error", "Failed to load user profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboardOffset(event.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardOffset(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [userId, visible]);

  const handleReport = async () => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to report a profile.");
      return;
    }

    if (!reportData.reason) {
      Alert.alert("Error", "Please select a reason for reporting.");
      return;
    }

    try {
      const { error } = await supabase.from("reports").insert({
        type: "PROFILE",
        reported_profile_id: userId,
        reported_by: (await supabase.auth.getSession()).data.session?.user.id,
        reason: reportData.reason,
        details: reportData.details || null,
        status: "pending",
      });

      if (error) throw error;
      Alert.alert("Success", "Profile reported successfully.");
    } catch (error) {
      console.error("Error reporting profile:", error);
      Alert.alert("Error", "Failed to report profile. Please try again.");
    } finally {
      setMenuVisible(false);
      setReportData({ reason: "", details: "" });
      setIsReporting(false);
    }
  };

  const handleBlock = async () => {
    const currentUserId = (await supabase.auth.getSession()).data.session?.user
      .id;
    if (!currentUserId) {
      Alert.alert("Error", "You must be logged in to block a user.");
      return;
    }

    if (currentUserId === userId) {
      Alert.alert("Error", "You cannot block yourself.");
      return;
    }

    try {
      // Fetch current blocked_users array
      const { data: userData, error: fetchError } = await supabase
        .from("profile")
        .select("blocked_users")
        .eq("id", currentUserId)
        .single();

      if (fetchError) throw fetchError;

      let blockedUsers = userData?.blocked_users || [];

      if (isBlocked) {
        // Unblock: Remove userId from blocked_users
        blockedUsers = blockedUsers.filter((id: string) => id !== userId);
        Alert.alert(
          "Unblock User",
          `Are you sure you want to unblock ${user?.username}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Unblock",
              style: "destructive",
              onPress: async () => {
                const { error: updateError } = await supabase
                  .from("profile")
                  .update({ blocked_users: blockedUsers })
                  .eq("id", currentUserId);

                if (updateError) throw updateError;

                setIsBlocked(false);
                Alert.alert("Success", `${user?.username} has been unblocked.`);
                setMenuVisible(false);
              },
            },
          ]
        );
      } else {
        // Block: Add userId to blocked_users if not already present
        if (!blockedUsers.includes(userId)) {
          blockedUsers.push(userId);
        }

        // Determine the correct order for user1_id and user2_id
        const user1 = currentUserId < userId ? currentUserId : userId;
        const user2 = currentUserId < userId ? userId : currentUserId;

        // Check if a friendship exists and delete it
        const { error: deleteFriendshipError } = await supabase
          .from("friends")
          .delete()
          .eq("user1_id", user1)
          .eq("user2_id", user2);

        if (deleteFriendshipError) throw deleteFriendshipError;

        // Update blocked_users
        const { error: updateError } = await supabase
          .from("profile")
          .update({ blocked_users: blockedUsers })
          .eq("id", currentUserId);

        if (updateError) throw updateError;

        setIsBlocked(true);
        Alert.alert("Success", `${user?.username} has been blocked.`);
        setMenuVisible(false);
      }
    } catch (error) {
      console.error("Error handling block/unblock:", error);
      Alert.alert("Error", "Failed to update block status. Please try again.");
    }
  };

  if (!user && !loading) return null;

  const initials =
    `${user?.first_name?.[0] || ""}${user?.last_name?.[0] || ""}`.toUpperCase();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : (
            <>
              <View style={styles.profileHeader}>
                <View style={styles.popupAvatarContainer}>
                  <Text style={styles.popupAvatarText}>{initials}</Text>
                </View>
                <Text style={styles.name}>
                  {user?.first_name} {user?.last_name}
                </Text>
                <Text style={styles.popupUsername}>@{user?.username}</Text>
                {isBlocked && <Text style={styles.blockedBadge}>Blocked</Text>}
                <TouchableOpacity
                  style={styles.actionMenuButton}
                  onPress={() => setMenuVisible(true)}
                >
                  <Ionicons name="ellipsis-horizontal" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.statsContainer}>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.longestStreak}</Text>
                    <Text style={styles.statLabel}>Longest Streak</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                      {stats.completionRate}%
                    </Text>
                    <Text style={styles.statLabel}>Completion Rate</Text>
                  </View>
                </View>
                <View style={styles.statRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>
                      {stats.goalsCompleted}
                    </Text>
                    <Text style={styles.statLabel}>Goals Completed</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>{stats.totalGoals}</Text>
                    <Text style={styles.statLabel}>Total Goals</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Modal
          visible={menuVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => {
            setMenuVisible(false);
            setReportData({ reason: "", details: "" });
            setIsReporting(false);
            Keyboard.dismiss();
          }}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => {
              Keyboard.dismiss();
            }}
            activeOpacity={1}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? -375 : 0}
              style={styles.keyboardAvoidingContainer}
            >
              <View
                style={[
                  styles.menuContainer,
                  { transform: [{ translateY: -keyboardOffset }] },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={(e) => {
                    e.stopPropagation();
                    Keyboard.dismiss();
                  }}
                >
                  <Text style={styles.menuTitle}>
                    {isReporting ? "Report Profile" : "Profile Actions"}
                  </Text>

                  {!isReporting ? (
                    <>
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={() => {
                          setIsReporting(true);
                          setReportData({
                            ...reportData,
                            reason: reportReasons[0],
                          });
                        }}
                      >
                        <Text style={styles.actionMenuItemText}>
                          Report Profile
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionMenuItem}
                        onPress={handleBlock}
                      >
                        <Text style={styles.actionMenuItemText}>
                          {isBlocked ? "Unblock User" : "Block User"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.menuSubtitle}>
                        Reason for reporting
                      </Text>
                      <View style={styles.reasonContainer}>
                        {reportReasons.map((reason) => (
                          <TouchableOpacity
                            key={reason}
                            style={[
                              styles.reasonButton,
                              reportData.reason === reason &&
                                styles.reasonButtonSelected,
                            ]}
                            onPress={() =>
                              setReportData({ ...reportData, reason })
                            }
                          >
                            <Text
                              style={[
                                styles.reasonButtonText,
                                reportData.reason === reason &&
                                  styles.reasonButtonTextSelected,
                              ]}
                            >
                              {reason}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.menuSubtitle}>
                        Additional details (optional)
                      </Text>
                      <TextInput
                        style={styles.detailsInput}
                        placeholder="Enter details..."
                        value={reportData.details}
                        onChangeText={(text) =>
                          setReportData({ ...reportData, details: text })
                        }
                        multiline
                        textAlignVertical="top"
                      />
                    </>
                  )}

                  <View style={styles.buttonContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => {
                        setMenuVisible(false);
                        setReportData({ reason: "", details: "" });
                        setIsReporting(false);
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    {isReporting && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.submitButton]}
                        onPress={handleReport}
                      >
                        <Text style={styles.actionButtonText}>
                          Submit Report
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

export default function HomeFeedScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [likingPosts, setLikingPosts] = useState<Set<string>>(new Set());
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [profilePopupVisible, setProfilePopupVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadUserAndData();

    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setKeyboardOffset(event.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardOffset(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
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
      // Fetch current user's blocked_users list
      const { data: userData, error: userError } = await supabase
        .from("profile")
        .select("blocked_users")
        .eq("id", currentUserId)
        .single();

      if (userError) throw userError;

      const blockedUsers = userData?.blocked_users || [];

      const { data: friendData, error: friendError } = await supabase
        .from("friends")
        .select("user1_id, user2_id")
        .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`)
        .eq("status", "accepted");

      if (friendError) throw friendError;

      const friendIds =
        friendData?.reduce((acc: string[], entry) => {
          if (entry.user1_id === currentUserId) {
            acc.push(entry.user2_id);
          } else if (entry.user2_id === currentUserId) {
            acc.push(entry.user1_id);
          }
          return acc;
        }, []) || [];

      // Filter out blocked users from friendIds
      const filteredFriendIds = friendIds.filter(
        (id) => !blockedUsers.includes(id)
      );

      if (!filteredFriendIds.length) {
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
        .in("user_id", filteredFriendIds)
        .order("created_at", { ascending: false });

      if (postError) throw postError;

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
        const { error: likeError } = await supabase
          .from("user_likes")
          .insert({ user_id: userId, proof_id: postId });

        if (likeError) throw likeError;

        const { error: incrementError } = await supabase
          .from("proof")
          .update({ likes: currentLikes + 1 })
          .eq("id", postId);

        if (incrementError) throw incrementError;

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

  const handleReport = async (postId: string) => {
    if (!userId) {
      Alert.alert("Error", "You must be logged in to report a post.");
      return;
    }

    if (!reportReason) {
      Alert.alert("Error", "Please select a reason for reporting.");
      return;
    }

    const selectedPost = posts.find((post) => post.id === postId);
    if (!selectedPost) {
      Alert.alert("Error", "Post not found.");
      return;
    }

    const reportData = {
      type: "POST",
      post_id: postId,
      reported_by: userId,
      reported_profile_id: selectedPost.user_id,
      reason: reportReason,
      details: reportDetails || null,
      status: "pending",
    };

    try {
      const { error } = await supabase.from("reports").insert(reportData);
      if (error) throw error;
      Alert.alert("Success", "Post reported successfully.");
    } catch (error) {
      console.error("Error reporting post:", error);
      Alert.alert("Error", "Failed to report post. Please try again.");
    } finally {
      setMenuVisible(false);
      setSelectedPostId(null);
      setReportReason("");
      setReportDetails("");
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

  const handleProfileClick = (userId: string) => {
    setSelectedUserId(userId);
    setProfilePopupVisible(true);
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <TouchableOpacity
          onPress={() => handleProfileClick(item.user_id)}
          style={styles.avatarContainer}
        >
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
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleProfileClick(item.user_id)}
          style={styles.userInfo}
        >
          <Text style={styles.userName}>
            {item.profile?.first_name || ""} {item.profile?.last_name || ""}
          </Text>
          <Text style={styles.username}>@{item.profile?.username}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setSelectedPostId(item.id);
            setMenuVisible(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#666" />
        </TouchableOpacity>
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
        <>
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
          <Modal
            visible={menuVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => {
              setMenuVisible(false);
              setReportReason("");
              setReportDetails("");
              Keyboard.dismiss();
            }}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              onPress={() => {
                Keyboard.dismiss();
              }}
              activeOpacity={1}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? -375 : 0}
                style={styles.keyboardAvoidingContainer}
              >
                <View
                  style={[
                    styles.menuContainer,
                    { transform: [{ translateY: -keyboardOffset }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => {
                      e.stopPropagation();
                      Keyboard.dismiss();
                    }}
                  >
                    <Text style={styles.menuTitle}>Report Post</Text>
                    <Text style={styles.menuSubtitle}>
                      Reason for reporting
                    </Text>
                    <View style={styles.reasonContainer}>
                      {reportReasons.map((reason) => (
                        <TouchableOpacity
                          key={reason}
                          style={[
                            styles.reasonButton,
                            reportReason === reason &&
                              styles.reasonButtonSelected,
                          ]}
                          onPress={() => setReportReason(reason)}
                        >
                          <Text
                            style={[
                              styles.reasonButtonText,
                              reportReason === reason &&
                                styles.reasonButtonTextSelected,
                            ]}
                          >
                            {reason}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.menuSubtitle}>
                      Additional details (optional)
                    </Text>
                    <TextInput
                      style={styles.detailsInput}
                      placeholder="Enter details..."
                      value={reportDetails}
                      onChangeText={setReportDetails}
                      multiline
                      textAlignVertical="top"
                    />
                    <View style={styles.buttonContainer}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => {
                          setMenuVisible(false);
                          setReportReason("");
                          setReportDetails("");
                          Keyboard.dismiss();
                        }}
                      >
                        <Text style={styles.actionButtonText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.actionButton,
                          styles.submitButton,
                          !reportReason && styles.submitButtonDisabled,
                        ]}
                        onPress={() =>
                          selectedPostId && handleReport(selectedPostId)
                        }
                        disabled={!reportReason}
                      >
                        <Text style={styles.actionButtonText}>
                          Submit Report
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </TouchableOpacity>
          </Modal>
          <ViewProfilePopup
            userId={selectedUserId || ""}
            visible={profilePopupVisible}
            onClose={() => {
              setProfilePopupVisible(false);
              setSelectedUserId(null);
            }}
          />
        </>
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
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    marginBottom: 0,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  menuSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
  },
  reasonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 16,
  },
  reasonButton: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  reasonButtonSelected: {
    backgroundColor: "#007aff",
  },
  reasonButtonText: {
    fontSize: 14,
    color: "#333",
  },
  reasonButtonTextSelected: {
    color: "#ffffff",
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginBottom: 16,
    minHeight: 80,
    textAlignVertical: "top",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  submitButton: {
    backgroundColor: "#007aff",
  },
  submitButtonDisabled: {
    backgroundColor: "#cccccc",
  },
  actionButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 40,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  popupAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  popupAvatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#fff",
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  popupUsername: {
    fontSize: 16,
    color: "#64748b",
    marginBottom: 8,
  },
  blockedBadge: {
    backgroundColor: "#dc2626", // Red background for visibility
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statsContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "700",
    color: "#3b82f6",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  closeButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  actionMenuButton: {
    position: "absolute",
    right: 0,
    top: 0,
    padding: 8,
  },
  actionMenuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  actionMenuItemText: {
    fontSize: 16,
    color: "#1a1a1a",
  },
});
