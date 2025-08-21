import { supabase } from "@/services/supabase";
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
  ScrollView,
  Pressable
} from "react-native";

interface Post {
  id: string;
  user_id: string;
  caption: string;
  created_at: string;
  picture_url: string;
  likes: number;
  challenges: {
    name: string;
    id: string;
  };
}

interface Goal {
  id: string;
  name: string;
}

export default function ProofsScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    loadUserAndData();
  }, []);

  useEffect(() => {
    if (userId) {
      fetchPosts();
    }
  }, [selectedGoal]);

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
      await Promise.all([
        fetchGoals(currentUserId),
        fetchPosts(currentUserId)
      ]);
    } else {
      console.warn("No authenticated user found.");
    }
    setLoading(false);
  };

  const fetchGoals = async (currentUserId: string) => {
    try {
      const { data, error } = await supabase
        .from("challenges")
        .select("id, name")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (err) {
      console.error("Error fetching goals:", err);
      Alert.alert("Error", "Failed to load goals. Please try again.");
    }
  };

  const fetchPosts = async (currentUserId?: string | null) => {
    try {
      const uid = currentUserId || userId;
      if (!uid) return;

      let query = supabase
        .from("proof")
        .select(`
          id,
          user_id,
          caption,
          created_at,
          picture_url,
          likes,
          challenges:challenge_id (
            id,
            name
          )
        `)
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (selectedGoal !== 'all') {
        query = query.eq("challenge_id", selectedGoal);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error("Error fetching posts:", err);
      Alert.alert("Error", "Failed to load proofs. Please try again.");
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPosts();
    setRefreshing(false);
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
      <View style={styles.challengeBadge}>
        <Text style={styles.challengeText}>{item.challenges?.name}</Text>
      </View>

      {item.caption && <Text style={styles.caption}>{item.caption}</Text>}

      <Image
        source={{ uri: `data:image/jpeg;base64,${item.picture_url}` }}
        style={styles.postImage}
        resizeMode="cover"
      />

      <View style={styles.postFooter}>
        <View style={styles.likeInfo}>
          <Text style={styles.likeCount}>❤️ {item.likes || 0} likes</Text>
        </View>
        <Text style={styles.timestamp}>{formatDate(item.created_at)}</Text>
      </View>
    </View>
  );

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  const selectGoal = (goalId: string) => {
    setSelectedGoal(goalId);
    closeDropdown();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.heading}>Your Proofs</Text>
          <View style={styles.dropdownContainer}>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <Text style={styles.filterButtonText}>
                {selectedGoal === 'all' ? 'Filter' : goals.find(g => g.id === selectedGoal)?.name || 'Filter'}
              </Text>
            </TouchableOpacity>
            
            {isDropdownOpen && (
              <>
                <Pressable 
                  style={styles.dropdownOverlay} 
                  onPress={closeDropdown}
                />
                <View style={styles.dropdown}>
                  <ScrollView bounces={false} style={styles.dropdownScroll}>
                    <TouchableOpacity 
                      style={[
                        styles.dropdownItem,
                        selectedGoal === 'all' && styles.dropdownItemSelected
                      ]}
                      onPress={() => selectGoal('all')}
                    >
                      <Text style={[
                        styles.dropdownItemText,
                        selectedGoal === 'all' && styles.dropdownItemTextSelected
                      ]}>All Goals</Text>
                    </TouchableOpacity>
                    {goals.map((goal) => (
                      <TouchableOpacity
                        key={goal.id}
                        style={[
                          styles.dropdownItem,
                          selectedGoal === goal.id && styles.dropdownItemSelected
                        ]}
                        onPress={() => selectGoal(goal.id)}
                      >
                        <Text style={[
                          styles.dropdownItemText,
                          selectedGoal === goal.id && styles.dropdownItemTextSelected
                        ]}>{goal.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007aff" />
          <Text style={styles.loadingText}>Loading your proofs...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No proofs yet!</Text>
              <Text style={styles.emptySubtitle}>
                Complete your daily goals to add proofs here
              </Text>
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
  header: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 70,
    marginBottom: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  filterButton: {
    backgroundColor: '#007aff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    width: 200,
    maxHeight: 300,
    zIndex: 1000,
  },
  dropdownScroll: {
    borderRadius: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  dropdownItemTextSelected: {
    color: '#007aff',
    fontWeight: '500',
  },
  modalView: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
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
  likeInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  likeCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
  },
});