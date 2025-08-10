import Fuse from "fuse.js"
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Challenge = {
  id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  current_streak: number;
  frequency: number;
  total_checkins: number;
  last_day: string | null;
};

type Friend = {
  id: string;
  name: string;
  username: string;
  friendshipId: string;
  challenges: Challenge[];
};

export default function FriendsScreen() {
  const [searchText, setSearchText] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
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
      console.error('Error fetching session:', error.message);
      setLoading(false);
      return;
    }

    const currentUserId = session?.user?.id ?? null;
    setUserId(currentUserId);

    if (currentUserId) {
      await fetchFriendsWithGoals(currentUserId);
    } else {
      console.warn('No authenticated user found.');
    }
    setLoading(false);
  };

  const fetchFriendsWithGoals = async (userId: string) => {
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
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (friendsError) throw friendsError;

      // Get friend IDs
      const friendIds = friendsData.map((item: any) => {
        const isUserSender = item.user_id === userId;
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
        const isUserSender = item.user_id === userId;
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
    } catch (error) {
      console.error('Error in fetchFriendsWithGoals:', error);
    }
  };

  const handleUnfriend = async (friendId: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`
      );

    if (error) {
      console.error('Error unfriending:', error);
    } else {
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    }
  };

  const onRefresh = async () => {
    if (userId) {
      setRefreshing(true);
      await fetchFriendsWithGoals(userId);
      setRefreshing(false);
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStreakEmoji = (streak: number) => {
    if (streak >= 30) return '🔥';
    if (streak >= 14) return '⚡';
    if (streak >= 7) return '💪';
    if (streak >= 3) return '🌟';
    return '✨';
  };

  const calculateProgress = (goal: Challenge) => {
    if (!goal.start_date || !goal.end_date) return { progressPercentage: 0 };
    
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

  // Robust fuzzy search with multi-word support
  function fuzzyScore(text, search) {
    if (!search) return 1;
    if (!text) return 0;
    
    const textLower = text.toLowerCase();
    const searchLower = search.toLowerCase();
    const cleanText = textLower.replace(/[\s\-_.]+/g, '');
    const cleanSearch = searchLower.replace(/[\s\-_.]+/g, '');
    
    // Split search into multiple words
    const searchWords = searchLower.trim().split(/[\s]+/).filter(word => word.length > 0);
    
    // Handle multi-word searches
    if (searchWords.length > 1) {
      let totalScore = 0;
      let wordsMatched = 0;
      
      for (const searchWord of searchWords) {
        const wordScore = fuzzyScore(text, searchWord); // Recursive call for each word
        if (wordScore > 0) {
          totalScore += wordScore;
          wordsMatched++;
        }
      }
      
      // Only return a score if most words matched
      if (wordsMatched >= Math.ceil(searchWords.length * 0.7)) {
        return totalScore / searchWords.length; // Average score
      } else {
        return 0;
      }
    }
    
    // Single word search (original logic)
    const singleSearch = searchWords[0] || searchLower;
    
    // Exact matches (highest priority)
    if (textLower === singleSearch || cleanText === singleSearch.replace(/[\s\-_.]+/g, '')) return 100;
    
    // Substring matches (high priority)
    if (textLower.includes(singleSearch)) return 90;
    if (cleanText.includes(singleSearch.replace(/[\s\-_.]+/g, ''))) return 85;
    
    // Word boundary matches
    const words = textLower.split(/[\s\-_.]+/);
    for (const word of words) {
      if (word.startsWith(singleSearch)) return 75;
      if (word.includes(singleSearch)) return 60;
    }
    
    // Simple edit distance for typo tolerance
    function editDistance(str1, str2) {
      if (Math.abs(str1.length - str2.length) > 3) return Infinity;
      
      const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
      for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
      
      for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,
            matrix[j - 1][i] + 1,
            matrix[j - 1][i - 1] + cost
          );
        }
      }
      return matrix[str2.length][str1.length];
    }
    
    // Check for typos in words
    if (singleSearch.length >= 3) {
      for (const word of words) {
        const distance = editDistance(word, singleSearch);
        const maxAllowed = Math.floor(singleSearch.length / 3);
        if (distance <= maxAllowed) {
          return 50 - (distance * 10);
        }
      }
    }
    
    // Character sequence matching
    let searchIndex = 0;
    let score = 0;
    let consecutiveBonus = 1;
    const cleanSingleSearch = singleSearch.replace(/[\s\-_.]+/g, '');
    
    for (let i = 0; i < cleanText.length && searchIndex < cleanSingleSearch.length; i++) {
      if (cleanText[i] === cleanSingleSearch[searchIndex]) {
        score += consecutiveBonus;
        consecutiveBonus = Math.min(consecutiveBonus + 1, 5); // Max bonus of 5
        searchIndex++;
      } else {
        consecutiveBonus = 1;
      }
    }
    
    if (searchIndex === cleanSingleSearch.length) {
      return Math.min(score, 40); // Cap at 40 for sequence matches
    }
    
    return 0;
  }

  const filteredFriends = friends
    .map(friend => ({
      ...friend,
      score: Math.max(
        fuzzyScore(friend.name, searchText),
        fuzzyScore(friend.username, searchText)
      )
    }))
    .filter(friend => friend.score > 0)
    .sort((a, b) => b.score - a.score);

  const renderChallenge = (challenge: Challenge) => {
    const progress = calculateProgress(challenge);
    
    return (
      <View key={challenge.id} style={styles.challengeCard}>
        <View style={styles.challengeHeader}>
          <Text style={styles.challengeName}>{challenge.name}</Text>
          {progress.isComplete && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedText}>✓</Text>
            </View>
          )}
        </View>
        
        {challenge.description && (
          <Text style={styles.challengeDescription}>{challenge.description}</Text>
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
            <Text style={styles.streakEmoji}>{getStreakEmoji(challenge.current_streak)}</Text>
            <Text style={styles.streakText}>Streak: {challenge.current_streak}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statValue}>{challenge.frequency}x</Text>
          </View>
        </View>

        {challenge.end_date && (
          <Text style={styles.dateText}>
            Ends {formatDate(challenge.end_date)}
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
        <TouchableOpacity
          style={styles.unfriendButton}
          onPress={() => handleUnfriend(item.id)}
        >
          <Text style={styles.unfriendText}>Remove</Text>
        </TouchableOpacity>
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
            renderItem={({ item }) => renderChallenge(item)}
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
        <Text style={styles.loadingText}>Loading your friends...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.heading}>Friends</Text>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor="#94a3b8"
              value={searchText}
              onChangeText={setSearchText}
            />
          </View>
        </View>

        <FlatList
          data={filteredFriends}
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

        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(stack)/goals/friends/requests')}
          >
            <Text style={styles.secondaryButtonText}>Friend Requests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(stack)/goals/friends/explore')}
          >
            <Text style={styles.primaryButtonText}>Add New Friends</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  searchContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
  },
  listContent: {
    paddingBottom: 140,
    paddingTop: 8,
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
  friendCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
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
    marginBottom: 16,
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
    fontSize: 18, 
    fontWeight: '600', 
    color: '#1a1a1a',
    marginBottom: 2,
  },
  friendUsername: { 
    fontSize: 14, 
    color: '#666',
  },
  unfriendButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  unfriendText: { 
    color: '#dc2626', 
    fontWeight: '600',
    fontSize: 14,
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
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
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
  challengeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  dateText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  completedBadge: {
    backgroundColor: "#4CAF50",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  completedText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
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
  noGoalsEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  noGoalsText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
    gap: 12,
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
  secondaryButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  secondaryButtonText: { 
    color: '#666', 
    fontWeight: '600', 
    fontSize: 16,
  },
});