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
  View,
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

export default function GoalsPage() {
  const router = useRouter();
  const { expoPushToken, notification } = usePushNotifications();

  const [goals, setGoals] = useState<Goal[]>([]);
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

    if (tab === "your") fetchGoals();
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
                pathname: `/goals/${item.id}/check-in`,
                params: {
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
            Friends' Goals
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007aff" />
          <Text style={styles.loadingText}>Loading your goals...</Text>
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
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            Friends' goals view coming soon.
          </Text>
        </View>
      )}

      {tab === "your" && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push("/goals/create")}
        >
          <Text style={styles.createButtonText}>+ Create New Goal</Text>
        </TouchableOpacity>
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
    paddingBottom: 100,
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
  createButton: {
    backgroundColor: "#007aff",
    padding: 18,
    borderRadius: 12,
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
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
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 16,
    color: "#888",
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
});
