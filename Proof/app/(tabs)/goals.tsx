import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"your" | "friends">("your");
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getCurrentUser();
    loadUserAndData();
  }, [tab]);

  const loadUserAndData = async () => {
    setLoading(true);
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Error fetching session:', error.message);
      setLoading(false);
      return;
    }

    const currentUserId = session?.user?.id ?? undefined;
    setUserId(currentUserId);

    if (currentUserId) {
      if (tab === "your") {
        await fetchGoals(currentUserId);
      } else {
        await fetchFriendsWithGoals(currentUserId);
      }
    } else {
      console.warn('No authenticated user found.');
    }
    setLoading(false);
  };

  const fetchGoals = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error("Error fetching goals:", err);
    }
  };

  const fetchFriendsWithGoals = async (uid: string) => {
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

      if (friendsError) throw friendsError;

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

        if (challengesError) throw challengesError;
        challengesData = data || [];
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
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    if (tab === "your") {
      await fetchGoals(userId);
    } else {
      await fetchFriendsWithGoals(userId);
    }
    setRefreshing(false);
  };

  const calculateProgress = (goal: Goal) => {
    const startDate = new Date(goal.start_date);
    const endDate = new Date(goal.end_date);
    const today = new Date();

    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysCompleted = goal.total_checkins || 0;
    const progressPercentage = Math.min(100, (daysCompleted / totalDays) * 100);
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
        message: "Checked In Today",
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
        shouldResetStreak: true,
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

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || '';
    const last = lastName?.charAt(0) || '';
    return `${first}${last}`.toUpperCase();
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
          <Text style={styles.goalName}>{item.name}</Text>
          {progress.isComplete && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓</Text>
            </View>
          )}
        </View>
        
        {item.description && (
          <Text style={styles.goalDescription}>{item.description}</Text>
        )}

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

        <View style={styles.goalStats}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>{getStreakEmoji(item.current_streak)}</Text>
            <Text style={styles.streakText}>Streak: {item.current_streak}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statValue}>{item.frequency}x</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.checkInButton,
            (!checkInStatus.canCheckIn || progress.isComplete) && styles.disabledButton,
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
                  streakReset: checkInStatus.shouldResetStreak ? "true" : "false",
                },
              });
            }
          }}
          disabled={!checkInStatus.canCheckIn || progress.isComplete}
        >
          <Text style={[
            styles.checkInText,
            (!checkInStatus.canCheckIn || progress.isComplete) && styles.disabledButtonText
          ]}>
            {progress.isComplete ? "Completed" : checkInStatus.message}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFriendGoal = ({ item }: { item: Goal }, friendName: string) => {
    const progress = calculateProgress(item);
    
    return (
      <View style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeName}>{item.name}</Text>
          {progress.isComplete && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓</Text>
            </View>
          )}
        </View>
        
        
        {item.description && (
          <Text style={styles.challengeDescription}>{item.description}</Text>
        )}

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

        <View style={styles.challengeStats}>
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>{getStreakEmoji(item.current_streak)}</Text>
            <Text style={styles.streakText}>Streak: {item.current_streak}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statValue}>{item.frequency}x</Text>
          </View>
        </View>

        {item.end_date && (
          <Text style={styles.dateText}>
            Ends {formatDate(item.end_date)}
          </Text>
        )}
      </View>
    );
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendCard}>
      <View style={styles.friendInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.name.split(' ')[0], item.name.split(' ')[1])}</Text>
        </View>
        <View style={styles.friendDetails}>
          <Text style={styles.friendName}>{item.name}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
      </View>
      
      <View style={styles.goalsSection}>
        <View style={styles.goalsSectionHeader}>
          <Text style={styles.goalsSectionTitle}>Active Goals</Text>
          <View style={styles.goalsCountBadge}>
            <Text style={styles.goalsCountText}>{item.challenges.length}</Text>
          </View>
        </View>
        
        {item.challenges.length > 0 ? (
          <FlatList
            horizontal
            data={item.challenges}
            renderItem={({ item }) => renderFriendGoal({ item }, item.name)}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.challengesContent}
          />
        ) : (
          <View style={styles.noGoalsContainer}>
            <Text style={styles.noGoalsText}>No active goals yet</Text>
          </View>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>
          {tab === "your" ? "Loading your goals..." : "Loading friends goals..."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Goals</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, tab === "your" && styles.activeTab]}
            onPress={() => setTab("your")}
          >
            <Text style={[styles.tabText, tab === "your" && styles.activeTabText]}>
              Your Goals
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === "friends" && styles.activeTab]}
            onPress={() => setTab("friends")}
          >
            <Text style={[styles.tabText, tab === "friends" && styles.activeTabText]}>
              Friends
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "your" ? (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id}
          renderItem={renderGoal}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
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
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/goals/create")}
          >
            <Text style={styles.primaryButtonText}>Create New Goal</Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 70,
    marginBottom: 16,
    color: '#1a1a1a',
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#f0f4f8',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#007aff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 140,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  goalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  goalName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  goalDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  dateSection: {
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
    fontWeight: '500',
  },
  dateValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  progressStats: {
    fontSize: 13,
    color: '#666',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e9ecef',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  goalStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  streakEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  statItem: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  checkInButton: {
    backgroundColor: '#007aff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  checkInText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#e9ecef',
  },
  disabledButtonText: {
    color: '#999',
  },
  warningButton: {
    backgroundColor: '#ff9500',
  },
  completedBadge: {
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  completedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  buttonGroup: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Friend card styles
  friendCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
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
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: '#666',
  },
  goalsSection: {
    marginTop: 8,
  },
  goalsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  goalsCountBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goalsCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  challengesContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  challengeCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 280,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  challengeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  challengeOwner: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  challengeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  noGoalsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderStyle: 'dashed',
  },
  noGoalsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
});