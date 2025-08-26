import { supabase } from "@/services/supabase";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

type Goal = {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string | null; // ongoing goals allowed
  frequency: number; // quantity per increment
  current_streak: number;
  total_checkins: number;
  last_day: string | null;
  created_at: string;
  increment: string; // "daily", "weekly", or "arbitrary"
};

type WeeklyGoal = {
  id: string;
  prevWeekPosts: number;
}

type Mode = "current" | "archived";

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("current");
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>([]);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      setUserId(currentUserId);
      if (currentUserId) {
        await fetchGoals(currentUserId);
      } else {
        console.warn("No authenticated user found.");
      }
      setLoading(false);
    };
    init();
  }, []);

  const fetchGoals = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals((data || []) as Goal[]);
    } catch (err) {
      console.error("Error fetching goals:", err);
    }
  };

  const onRefresh = async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchGoals(userId);
    await getPostsInPreviousWeek(userId)
    setRefreshing(false);
  };

  const deleteGoal = async (goalId: string) => {
    try {
      setDeletingId(goalId);
      const { error } = await supabase.from("challenges").delete().eq("id", goalId);
      if (error) throw error;
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
    } catch (e) {
      console.error("Delete failed:", e);
      Alert.alert("Delete failed", "Could not delete the goal. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (goalId: string, name: string) => {
    Alert.alert("Delete goal?", `This will permanently delete "${name}".`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoal(goalId) },
    ]);
  };

  const getLocalDateYYYYMMDD = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 10);
  };

  const isArchived = (g: Goal) => {
    if (!g.end_date) return false; // ongoing never auto-archives
    return getLocalDateYYYYMMDD() > g.end_date;
  };

  const getCurrentIncrementStart = (goal: Goal) => {
    const today = new Date(getLocalDateYYYYMMDD());
    
    if (goal.increment === "daily") {
      return today.toISOString().slice(0, 10);
    } else if (goal.increment === "weekly") {
      // Calculate current week based on goal start date
      const goalStartDate = new Date(goal.start_date);
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysSinceStart = Math.floor((today.getTime() - goalStartDate.getTime()) / msPerDay);
      
      if (daysSinceStart < 0) {
        // If today is before goal start, return goal start date
        return goal.start_date;
      }
      
      // Calculate which week we're in (0-based) and get that week's start date
      const weekNumber = Math.floor(daysSinceStart / 7);
      const currentWeekStart = new Date(goalStartDate);
      currentWeekStart.setDate(goalStartDate.getDate() + (weekNumber * 7));
      
      return currentWeekStart.toISOString().slice(0, 10);
    }
    
    // For arbitrary, return goal start date
    return goal.start_date;
  };

  // Get posts count from the previous week (only needed for weekly goals streak logic)
  const getPostsInPreviousWeek = async (uid: string) => {
    
    goals.forEach(async (g) => {
      if (g.increment === "weekly") {
        try {
          const currentWeekStart = getCurrentIncrementStart(g);
          const currentWeekStartDate = new Date(currentWeekStart);
          
          // Calculate previous week's start and end
          const previousWeekStart = new Date(currentWeekStartDate);
          previousWeekStart.setDate(currentWeekStartDate.getDate() - 7);
          
          const previousWeekEnd = new Date(previousWeekStart);
          previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
          
          const previousWeekStartStr = previousWeekStart.toISOString().slice(0, 10);
          const previousWeekEndStr = previousWeekEnd.toISOString().slice(0, 10);

          const { data, error } = await supabase
            .from("proof")
            .select("id")
            .eq("user_id", uid)
            .eq("challenge_id", g.id)
            .gte("created_at", previousWeekStartStr)
            .lte("created_at", previousWeekEndStr + "T23:59:59.999Z");

          if (error) throw error;
          const payload: WeeklyGoal = { id: g.id, prevWeekPosts: data?.length || 0 };
          setWeeklyGoals([...weeklyGoals, payload]);
        } catch (error) {
          console.error("Error fetching posts in previous week:", error);
        }
      }
    });
    
  };

  const calculateProgress = (goal: Goal) => {
    const startDate = new Date(goal.start_date);
    const today = new Date(getLocalDateYYYYMMDD());

    if (!goal.end_date) {
      // Ongoing goal - show total posts vs total possible based on time elapsed
      if (goal.increment === "arbitrary") {
        return {
          daysCompleted: goal.total_checkins || 0,
          totalDays: 0,
          progressPercentage: 0,
          isComplete: false,
          isIndefinite: true as const,
        };
      }
      
      // For ongoing daily/weekly goals, calculate based on time elapsed
      const msPerDay = 1000 * 60 * 60 * 24;
      const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1;
      
      let totalPossiblePosts = 0;
      if (goal.increment === "daily") {
        // Daily goals: 1 post per day possible
        totalPossiblePosts = daysElapsed;
      } else if (goal.increment === "weekly") {
        // Weekly goals: frequency posts per week
        const weeksElapsed = Math.ceil(daysElapsed / 7);
        totalPossiblePosts = weeksElapsed * goal.frequency;
      }
      
      const progressPercentage = totalPossiblePosts > 0 
        ? Math.min(100, ((goal.total_checkins || 0) / totalPossiblePosts) * 100)
        : 0;
      
      return {
        daysCompleted: goal.total_checkins || 0,
        totalDays: totalPossiblePosts,
        progressPercentage,
        isComplete: false,
        isIndefinite: false as const,
      };
    }

    const endDate = new Date(goal.end_date);
    const isComplete = today > endDate;

    if (goal.increment === "arbitrary") {
      // Arbitrary: Number of posts / target quantity
      const progressPercentage = Math.min(100, ((goal.total_checkins || 0) / goal.frequency) * 100);
      return {
        daysCompleted: goal.total_checkins || 0,
        totalDays: goal.frequency,
        progressPercentage,
        isComplete,
        isIndefinite: false as const,
      };
    }

    // Normal (daily/weekly): Calculate total possible posts for the timespan
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay);
    
    let totalPossiblePosts = 0;
    if (goal.increment === "daily") {
      // Daily goals: 1 post per day for the duration
      totalPossiblePosts = totalDays;
    } else if (goal.increment === "weekly") {
      // Weekly goals: frequency posts per week for the duration
      const totalWeeks = Math.ceil(totalDays / 7);
      totalPossiblePosts = totalWeeks * goal.frequency;
    }
    
    const progressPercentage = totalPossiblePosts > 0 
      ? Math.min(100, ((goal.total_checkins || 0) / totalPossiblePosts) * 100)
      : 0;

    return {
      daysCompleted: goal.total_checkins || 0,
      totalDays: totalPossiblePosts,
      progressPercentage,
      isComplete,
      isIndefinite: false as const,
    };
  };

  const getCheckInStatus = (goal: Goal) => {
    const today = getLocalDateYYYYMMDD();
    
    // Check if user already posted today (applies to all goal types)
    if (goal.last_day) {
      const lastCheckIn = goal.last_day.split("T")[0];
      if (today === lastCheckIn) {
        return { 
          canCheckIn: false, 
          status: "locked", 
          message: "Already Posted Today", 
          shouldResetStreak: false 
        };
      }
    }

    // For arbitrary goals, check if goal is completed
    if (goal.increment === "arbitrary") {
      if (goal.total_checkins >= goal.frequency) {
        return { 
          canCheckIn: false, 
          status: "completed", 
          message: "Goal Completed", 
          shouldResetStreak: false 
        };
      }
      return { 
        canCheckIn: true, 
        status: "available", 
        message: "Add Post", 
        shouldResetStreak: false 
      };
    }

    // For daily/weekly goals, check streak logic
    if (!goal.last_day) {
      return { 
        canCheckIn: true, 
        status: "available", 
        message: "Add Post", 
        shouldResetStreak: false 
      };
    }

    const lastCheckIn = goal.last_day.split("T")[0];
    const todayDate = new Date(today);
    const lastCheckInDate = new Date(lastCheckIn);
    const daysDifference = Math.floor(
      (todayDate.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (goal.increment === "daily") {
      // For daily goals (frequency always 1), missing a day breaks the streak
      if (daysDifference === 1) {
        return { 
          canCheckIn: true, 
          status: "available", 
          message: "Add Post", 
          shouldResetStreak: false 
        };
      } else if (daysDifference > 1) {
        return { 
          canCheckIn: true, 
          status: "streak-reset", 
          message: "Add Post (Streak Reset)", 
          shouldResetStreak: true 
        };
      }
    }
    
    if (goal.increment === "weekly") {
      if (goal.last_day < getCurrentIncrementStart(goal) && goal.start_date != getCurrentIncrementStart(goal)) {
        // Last check-in was before current week
        // await getPostsInPreviousWeek(userId, goal)
        const prevWeekPosts = weeklyGoals.find((wg) => wg.id === goal.id)?.prevWeekPosts || 0;
        if (prevWeekPosts < goal.frequency) {
          return {
            canCheckIn: true, 
            status: "streak-reset", 
            message: "Add Post (Streak Reset)", 
            shouldResetStreak: true 
          };
        }
      }
      
      return { 
        canCheckIn: true, 
        status: "available", 
        message: "Add Post", 
        shouldResetStreak: false 
      };
    }
    
    return { 
      canCheckIn: false, 
      status: "locked", 
      message: "Locked", 
      shouldResetStreak: false 
    };
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Ongoing";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getStreakEmoji = (streak: number) => {
    if (streak >= 30) return "🔥";
    if (streak >= 14) return "⚡";
    if (streak >= 7) return "💪";
    if (streak >= 3) return "🌟";
    return "✨";
  };

  const getIncrementDisplayText = (increment: string, frequency: number) => {
    if (increment === "arbitrary") {
      return `${frequency} total`;
    } else if (increment === "daily") {
      return "Daily";
    } else if (increment === "weekly") {
      return `${frequency}x weekly`;
    }
    return `${frequency}x ${increment}`;
  };

  // Split goals into current and archived (memoized)
  const { currentGoals, archivedGoals } = useMemo(() => {
    const current: Goal[] = [];
    const archived: Goal[] = [];
    goals.forEach((g) => (isArchived(g) ? archived.push(g) : current.push(g)));
    return { currentGoals: current, archivedGoals: archived };
  }, [goals]);

  const dataForMode = mode === "current" ? currentGoals : archivedGoals;

  const renderGoal = ({ item }: { item: Goal }) => {
    const progress = calculateProgress(item);
    const checkInStatus = getCheckInStatus(item);
    const archived = isArchived(item);

    return (
      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalName}>{item.name}</Text>

          <View style={styles.headerRight}>
            {archived && (
              <View style={styles.completedBadge}>
                <Text style={styles.completedText}>✓</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.deletePill}
              onPress={() => confirmDelete(item.id, item.name)}
              disabled={deletingId === item.id}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deletePillText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {!!item.description && <Text style={styles.goalDescription}>{item.description}</Text>}

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
            {progress.isIndefinite ? (
              <Text style={styles.progressStats}>{progress.daysCompleted} posts</Text>
            ) : (
              <Text style={styles.progressStats}>
                {progress.daysCompleted}/{progress.totalDays} posts ({Math.round(progress.progressPercentage)}%)
              </Text>
            )}
          </View>

          {!progress.isIndefinite && (
            <View style={styles.progressBarContainer}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${progress.progressPercentage}%`,
                    backgroundColor: archived ? "#4CAF50" : "#007aff",
                  },
                ]}
              />
            </View>
          )}
        </View>

        <View style={styles.goalStats}>
          {item.increment !== "arbitrary" && item.current_streak >= 3 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>{getStreakEmoji(item.current_streak)}</Text>
              <Text style={styles.streakText}>Streak: {item.current_streak}</Text>
            </View>
          )}

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Target</Text>
            <Text style={styles.statValue}>{getIncrementDisplayText(item.increment, item.frequency)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.checkInFull,
            (!checkInStatus.canCheckIn || archived) && styles.disabledButton,
            checkInStatus.status === "streak-reset" && !archived && styles.warningButton,
          ]}
          onPress={() => {
            if (checkInStatus.canCheckIn && !archived) {
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
          disabled={!checkInStatus.canCheckIn || archived}
        >
          <Text
            style={[
              styles.checkInText,
              (!checkInStatus.canCheckIn || archived) && styles.disabledButtonText,
            ]}
          >
            {archived ? "Completed" : checkInStatus.message}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007aff" />
        <Text style={styles.loadingText}>
          {mode === "current" ? "Loading current goals..." : "Loading archived goals..."}
        </Text>
      </View>
    );
  }

  const listPaddingBottom = mode === "current" ? 140 : 32;

  return (
    <View style={styles.container}>
      {/* Header aligned like Home; title + pill on one row */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{mode === "current" ? "Current" : "Archives"}</Text>
          <TouchableOpacity
            style={styles.headerAction}
            onPress={() => setMode(mode === "current" ? "archived" : "current")}
          >
            <Text style={styles.headerActionText}>
              {mode === "current"
                ? `View Archives (${archivedGoals.length})`
                : `View Current (${currentGoals.length})`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={dataForMode}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: listPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {mode === "current" ? "No active goals!" : "No archived goals"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {mode === "current"
                ? "Create your first goal to get started"
                : "Completed goals will show up here automatically"}
            </Text>
          </View>
        }
      />

      {mode === "current" && (
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/goals/create")}>
            <Text style={styles.primaryButtonText}>Create New Goal</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },

  /* HEADER — aligns with Home */
  header: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",       // aligns pill with title baseline
    marginTop: 70,              // match Home top spacing
    marginBottom: 16,           // match Home bottom spacing
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  headerAction: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  headerActionText: { color: "#2563eb", fontWeight: "700", fontSize: 15 },

  listContent: { padding: 16 },

  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#333", marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: "#666", textAlign: "center" },

  goalCard: {
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
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  goalName: { fontSize: 18, fontWeight: "600", color: "#1a1a1a", flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", marginLeft: 8 },

  completedBadge: {
    backgroundColor: "#4CAF50",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  completedText: { color: "#fff", fontSize: 12, fontWeight: "bold" },

  deletePill: {
    backgroundColor: "#dc3545",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  deletePillText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  goalDescription: { fontSize: 14, color: "#666", marginBottom: 12, lineHeight: 20 },

  dateSection: { marginBottom: 12 },
  dateRow: { flexDirection: "row", marginBottom: 4 },
  dateLabel: { fontSize: 14, color: "#666", width: 60, fontWeight: "500" },
  dateValue: { fontSize: 14, color: "#333", fontWeight: "500" },

  progressSection: { marginBottom: 12 },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 14, fontWeight: "600", color: "#333" },
  progressStats: { fontSize: 13, color: "#666" },
  progressBarContainer: {
    height: 8,
    backgroundColor: "#e9ecef",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBar: { height: "100%", borderRadius: 4 },

  goalStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  streakEmoji: { fontSize: 12, marginRight: 6 },
  streakText: { fontSize: 13, fontWeight: "600", color: "#ffffff" },
  statItem: { alignItems: "flex-end" },
  statLabel: { fontSize: 12, color: "#666", fontWeight: "500" },
  statValue: { fontSize: 14, color: "#1a1a1a", fontWeight: "600" },

  checkInFull: {
    backgroundColor: "#007aff",
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  checkInText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  disabledButton: { backgroundColor: "#e9ecef" },
  disabledButtonText: { color: "#999" },
  warningButton: { backgroundColor: "#ff9500" },

  buttonGroup: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  },
  primaryButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
});