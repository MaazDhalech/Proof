import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

type Goal = {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  frequency: number;
  current_streak: number;
  total_checkins: number;
  last_day: string | null;
  created_at: string;
};

type Friend = {
  id: string;
  name: string;
  username: string;
  friendshipId: string;
  challenges: Goal[];
};

export default function GoalsPage() {
  const router = useRouter();
  const { expoPushToken, notification } = usePushNotifications();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"your" | "friends">("your");
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getCurrentUser();

    if (tab === "your") {
      fetchGoals();
    } else if (tab === "friends") {
      fetchFriendsWithGoals();
    }
  }, [tab]);

  const fetchGoals = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user.id;

    if (!uid) {
      console.log("No user session found");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching goals:", error);
        setLoading(false);
        return;
      }

      setGoals(data || []);
    } catch (err) {
      console.error("Error in fetchGoals:", err);
    }

    setLoading(false);
  };

  const fetchFriendsWithGoals = async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user.id;

    if (!uid) {
      console.log("No user session found");
      setLoading(false);
      return;
    }

    try {
      // First, fetch friends
      const { data: friendsData, error: friendsError } = await supabase
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
        .or(`user_id.eq.${uid},friend_id.eq.${uid}`)
        .eq('status', 'accepted');

      if (friendsError) {
        console.error('Error fetching friends:', friendsError);
        setLoading(false);
        return;
      }

      // Get friend IDs
      const friendIds = friendsData.map((item: any) => {
        const isUserSender = item.user_id === uid;
        const profile = isUserSender ? item.receiver : item.sender;
        return profile.id;
      });

      // Fetch challenges for all friends
      let challengesData: any[] = [];
      if (friendIds.length > 0) {
        const { data, error: challengesError } = await supabase
          .from('challenges')
          .select('*')
          .in('user_id', friendIds);

        if (challengesError) {
          console.error('Error fetching challenges:', challengesError);
        } else {
          challengesData = data || [];
        }
      }

      // Combine friends with their challenges
      const formatted: Friend[] = friendsData.map((item: any) => {
        const isUserSender = item.user_id === uid;
        const profile = isUserSender ? item.receiver : item.sender;
        
        const friendChallenges = challengesData.filter(
          (challenge) => challenge.user_id === profile.id
        );

        return {
          id: profile.id,
          name: `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
          username: profile?.username ?? '',
          friendshipId: item.id,
          challenges: friendChallenges,
        };
      });

      setFriends(formatted);
    } catch (err) {
      console.error("Error in fetchFriendsWithGoals:", err);
    }

    setLoading(false);
  };

  const calculateProgress = (goal: Goal) => {
    const startDate = new Date(goal.start_date);
    const endDate = new Date(goal.end_date);
    const today = new Date();

    // Calculate total days in the challenge
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Use total_checkins as actual days completed (checked in)
    const daysCompleted = goal.total_checkins || 0;

    // Calculate progress percentage based on actual check-ins
    const progressPercentage = Math.min(100, (daysCompleted / totalDays) * 100);

    // Check if challenge period has ended
    const isComplete = today > endDate;

    return {
      daysCompleted,
      totalDays,
      progressPercentage,
      isComplete,
    };
  };

  const getCheckInStatus = (goal: Goal) => {
    if (!goal.last_day) {
      return {
        canCheckIn: true,
        status: "available",
        message: "Check In",
        shouldResetStreak: false,
      };
    }

    // Get current local date in YYYY-MM-DD format
    const getLocalDate = () => {
      const date = new Date();
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().split("T")[0];
    };

    const today = getLocalDate();
    const lastCheckIn = goal.last_day.split("T")[0];

    if (today === lastCheckIn) {
      return {
        canCheckIn: false,
        status: "locked",
        message: "Locked",
        shouldResetStreak: false,
      };
    }

    const todayDate = new Date(today);
    const lastCheckInDate = new Date(lastCheckIn);
    const daysDifference = Math.floor(
      (todayDate.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDifference === 1) {
      return {
        canCheckIn: true,
        status: "available",
        message: "Check In",
        shouldResetStreak: false,
      };
    } else if (daysDifference > 1) {
      return {
        canCheckIn: true,
        status: "streak-reset",
        message: "Check In (Reset Streak)",
        shouldResetStreak: true, // <-- Will reset to 0
      };
    }

    return {
      canCheckIn: false,
      status: "locked",
      message: "Locked",
      shouldResetStreak: false,
    };
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getStreakEmoji = (streak: number) => {
    if (streak >= 30) return '🔥';
    if (streak >= 14) return '⚡';
    if (streak >= 7) return '💪';
    if (streak >= 3) return '🌟';
    return '✨';
  };

  const renderGoal = ({ item }: { item: Goal }) => {
    const progress = calculateProgress(item);
    const checkInStatus = getCheckInStatus(item);

    return (
      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <View style={styles.goalInfo}>
            <Text style={styles.goalTitle}>{item.name}</Text>
            <Text style={styles.goalDescription}>
              {item.description || "No description provided"}
            </Text>
            <Text style={styles.goalFrequency}>
              Frequency: {item.frequency} times per period
            </Text>
          </View>
          {progress.isComplete && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓</Text>
            </View>
          )}
        </View>

        <View style={styles.dateSection}>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Start:</Text>
            <Text style={styles.dateValue}>{formatDate(item.start_date)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>End:</Text>
            <Text style={styles.dateValue}>{formatDate(item.end_date)}</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressStats}>
              {progress.daysCompleted}/{progress.totalDays} days (
              {Math.round(progress.progressPercentage)}%)
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progress.progressPercentage}%`,
                  backgroundColor: progress.isComplete ? "#4CAF50" : "#007aff",
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.streakSection}>
          <Text style={styles.streakText}>
            Current streak: {item.current_streak} days
          </Text>
          {item.last_day && (
            <Text style={styles.lastDayText}>
              Last check-in: {formatDate(item.last_day)}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.checkInButton,
            (!checkInStatus.canCheckIn || progress.isComplete) &&
              styles.disabledButton,
            checkInStatus.status === "streak-reset" && styles.warningButton,
          ]}
          onPress={() => {
            if (checkInStatus.canCheckIn && !progress.isComplete) {
              router.push({
                pathname: "/goals/[goalID]/check-in",
                params: {
                  goalID: item.id,
                  challengeName: item.name,
                  challengeDescription: item.description,
                  id: item.id,
                  streakReset: checkInStatus.shouldResetStreak
                    ? "true"
                    : "false",
                },
              });
            }
          }}
          disabled={!checkInStatus.canCheckIn || progress.isComplete}
        >
          <Text
            style={[
              styles.checkInText,
              (!checkInStatus.canCheckIn || progress.isComplete) &&
                styles.disabledButtonText,
            ]}
          >
            {progress.isComplete ? "Goal Completed" : checkInStatus.message}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendGoal = (goal: Goal, friendName: string) => {
    const progress = calculateProgress(goal);

    return (
      <View key={goal.id} style={styles.friendGoalCard}>
        <View style={styles.friendGoalHeader}>
          <Text style={styles.friendGoalTitle}>{goal.name}</Text>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>{getStreakEmoji(goal.current_streak)}</Text>
            <Text style={styles.streakBadgeText}>{goal.current_streak}</Text>
          </View>
        </View>
        
        <Text style={styles.friendGoalOwner}>by {friendName}</Text>
        
        {goal.description && (
          <Text style={styles.friendGoalDescription}>{goal.description}</Text>
        )}

        <View style={styles.friendGoalStats}>
          <Text style={styles.friendStatText}>
            Check-ins: {goal.total_checkins}
          </Text>
          <Text style={styles.friendStatText}>
            Frequency: {goal.frequency}x/week
          </Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressStats}>
              {progress.daysCompleted}/{progress.totalDays} days (
              {Math.round(progress.progressPercentage)}%)
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${progress.progressPercentage}%`,
                  backgroundColor: progress.isComplete ? "#4CAF50" : "#007aff",
                },
              ]}
            />
          </View>
        </View>

        {goal.end_date && (
          <Text style={styles.friendGoalDate}>
            Ends: {formatDate(goal.end_date)}
          </Text>
        )}
      </View>
    );
  };

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
        <Text style={styles.goalCount}>
          {item.challenges.length} goal{item.challenges.length !== 1 ? 's' : ''}
        </Text>
      </View>
      
      {item.challenges.length > 0 ? (
        <View style={styles.friendGoalsContainer}>
          {item.challenges.map((goal) => renderFriendGoal(goal, item.name))}
        </View>
      ) : (
        <Text style={styles.noGoalsText}>No active goals</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === "your" && styles.activeTab]}
          onPress={() => setTab("your")}
        >
          <Text
            style={[styles.tabText, tab === "your" && styles.activeTabText]}
          >
            Your Goals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "friends" && styles.activeTab]}
          onPress={() => setTab("friends")}
        >
          <Text
            style={[styles.tabText, tab === "friends" && styles.activeTabText]}
          >
            Friends Goals
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007aff" />
          <Text style={styles.loadingText}>
            {tab === "your" ? "Loading your goals..." : "Loading friends goals..."}
          </Text>
        </View>
      ) : tab === "your" ? (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          renderItem={renderGoal}
          contentContainerStyle={styles.goalList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No goals yet!</Text>
              <Text style={styles.emptySubtitle}>
                Create your first goal to get started
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.friendshipId}
          renderItem={renderFriend}
          contentContainerStyle={styles.goalList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No friends yet!</Text>
              <Text style={styles.emptySubtitle}>
                Add friends to see their goals here
              </Text>
            </View>
          }
        />
      )}

      {tab === "your" && (
        <View style={styles.createButtonContainer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push("/goals/create")}
          >
            <Text style={styles.createButtonText}>+ Create New Goal</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
    paddingHorizontal: 20,
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
  goalList: {
    paddingBottom: 120, // Increased padding to account for button container
    paddingTop: 12,
  },
  goalCard: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 6,
  },
  goalDescription: {
    fontSize: 15,
    color: "#666",
    lineHeight: 20,
    marginBottom: 4,
  },
  goalFrequency: {
    fontSize: 13,
    color: "#999",
    fontWeight: "500",
  },
  completedBadge: {
    backgroundColor: "#4CAF50",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  completedText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  dateSection: {
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dateLabel: {
    fontWeight: "600",
    color: "#555",
    width: 60,
  },
  dateValue: {
    color: "#333",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  progressStats: {
    fontSize: 13,
    color: "#666",
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  streakSection: {
    marginBottom: 16,
  },
  streakText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  lastDayText: {
    fontSize: 13,
    color: "#777",
  },
  checkInButton: {
    backgroundColor: "#007aff",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#007aff",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  checkInText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  completedButtonText: {
    color: "#666",
  },
  disabledButton: {
    backgroundColor: "#ccc",
    shadowOpacity: 0,
    elevation: 0,
  },
  disabledButtonText: {
    color: "#888",
  },
  warningButton: {
    backgroundColor: "#ff9500",
  },
  createButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#f8f9fa", // Same as container background
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    // Add gradient-like shadow effect
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButton: {
    backgroundColor: "#007aff",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#007aff",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 12,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: -20,
    marginTop: 0,
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderColor: "transparent",
  },
  activeTab: {
    borderColor: "#007aff",
  },
  tabText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  activeTabText: {
    color: "#007aff",
    fontWeight: "700",
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
  },
  // Friends' goals styles
  friendCard: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginVertical: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  friendInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },
  friendUsername: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  goalCount: {
    fontSize: 14,
    color: "#007aff",
    fontWeight: "600",
  },
  friendGoalsContainer: {
    gap: 12,
  },
  friendGoalCard: {
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  friendGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  friendGoalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
    flex: 1,
    marginRight: 8,
  },
  friendGoalOwner: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
    fontStyle: "italic",
  },
  friendGoalDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    lineHeight: 18,
  },
  friendGoalStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  friendStatText: {
    fontSize: 12,
    color: "#888",
  },
  friendGoalDate: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
    marginTop: 8,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ff6b35",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakEmoji: {
    fontSize: 12,
    marginRight: 2,
  },
  streakBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  noGoalsText: {
    fontSize: 14,
    color: "#999",
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 12,
  },
});