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
  end_date: string | null; // <= allow ongoing goals
  frequency: number;
  current_streak: number;
  total_checkins: number;
  last_day: string | null;
  created_at: string;
};

type TabKey = "current" | "archived";

export default function GoalsPage() {
  const router = useRouter();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("current");

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
      Alert.alert("Delete failed", "Couldn’t delete the goal. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (goalId: string, name: string) => {
    Alert.alert("Delete goal?", `This will permanently delete “${name}”.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteGoal(goalId) },
    ]);
  };

  const calculateProgress = (goal: Goal) => {
    const startDate = new Date(goal.start_date);

    // Ongoing goal: no end_date
    if (!goal.end_date) {
      return {
        daysCompleted: goal.total_checkins || 0,
        totalDays: 0,
        progressPercentage: 0,
        isComplete: false,
        isIndefinite: true as const,
      };
    }

    const endDate = new Date(goal.end_date);
    const today = new Date();

    const totalDays = Math.max(
      1,
      Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const daysCompleted = goal.total_checkins || 0;
    const progressPercentage = Math.min(100, (daysCompleted / totalDays) * 100);
    const isComplete = today > endDate;

    return { daysCompleted, totalDays, progressPercentage, isComplete, isIndefinite: false as const };
  };

  const getLocalDateYYYYMMDD = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const local = new Date(now.getTime() - offset);
    return local.toISOString().slice(0, 10);
  };

  const isArchived = (g: Goal) => {
    // Ongoing goals never get archived automatically
    if (!g.end_date) return false;
    return getLocalDateYYYYMMDD() > g.end_date;
  };

  const getCheckInStatus = (goal: Goal) => {
    if (!goal.last_day) {
      return { canCheckIn: true, status: "available", message: "Check In", shouldResetStreak: false };
    }
    const today = getLocalDateYYYYMMDD();
    const lastCheckIn = goal.last_day.split("T")[0];

    if (today === lastCheckIn) {
      return { canCheckIn: false, status: "locked", message: "Checked In Today", shouldResetStreak: false };
    }

    const todayDate = new Date(today);
    const lastCheckInDate = new Date(lastCheckIn);
    const daysDifference = Math.floor((todayDate.getTime() - lastCheckInDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDifference === 1) {
      return { canCheckIn: true, status: "available", message: "Check In", shouldResetStreak: false };
    } else if (daysDifference > 1) {
      return { canCheckIn: true, status: "streak-reset", message: "Check In (Reset Streak)", shouldResetStreak: true };
    }
    return { canCheckIn: false, status: "locked", message: "Locked", shouldResetStreak: false };
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

  // Split goals into current and archived
  const { currentGoals, archivedGoals } = useMemo(() => {
    const current: Goal[] = [];
    const archived: Goal[] = [];
    goals.forEach((g) => (isArchived(g) ? archived.push(g) : current.push(g)));
    return { currentGoals: current, archivedGoals: archived };
  }, [goals]);

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
              <Text style={styles.progressStats}>{progress.daysCompleted} check-ins</Text>
            ) : (
              <Text style={styles.progressStats}>
                {progress.daysCompleted}/{progress.totalDays} days ({Math.round(progress.progressPercentage)}%)
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
          {tab === "current" ? "Loading current goals..." : "Loading archived goals..."}
        </Text>
      </View>
    );
  }

  const dataForTab = tab === "current" ? currentGoals : archivedGoals;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Goals</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, tab === "current" && styles.activeTab]}
            onPress={() => setTab("current")}
          >
            <Text style={[styles.tabText, tab === "current" && styles.activeTabText]}>Current</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{currentGoals.length}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, tab === "archived" && styles.activeTab]}
            onPress={() => setTab("archived")}
          >
            <Text style={[styles.tabText, tab === "archived" && styles.activeTabText]}>Archived</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{archivedGoals.length}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={dataForTab}
        keyExtractor={(item) => item.id}
        renderItem={renderGoal}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {tab === "current" ? "No active goals!" : "No archived goals"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === "current"
                ? "Create your first goal to get started"
                : "Completed goals will show up here automatically"}
            </Text>
          </View>
        }
      />

      {tab === "current" && (
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
    marginBottom: 12,
    color: "#1a1a1a",
  },

  /* Tabs */
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#f0f4f8",
    borderRadius: 12,
    padding: 4,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: { fontSize: 16, fontWeight: "500", color: "#666", marginRight: 6 },
  activeTabText: { color: "#007aff", fontWeight: "700" },
  countPill: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countPillText: { color: "#1d4ed8", fontWeight: "700", fontSize: 12 },

  listContent: { padding: 16, paddingBottom: 140 },

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
