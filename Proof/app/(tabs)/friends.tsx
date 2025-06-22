import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
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
  const router = useRouter();

  useEffect(() => {
    loadUserAndData();
  }, []);

  const loadUserAndData = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Error fetching session:', error.message);
      return;
    }

    const currentUserId = session?.user?.id ?? null;
    setUserId(currentUserId);

    if (currentUserId) {
      await fetchFriendsWithGoals(currentUserId);
    } else {
      console.warn('No authenticated user found.');
    }
  };

  const fetchFriendsWithGoals = async (userId: string) => {
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

    if (friendsError) {
      console.error('Error fetching friends:', friendsError);
      return;
    }

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

      if (challengesError) {
        console.error('Error fetching challenges:', challengesError);
      } else {
        challengesData = data || [];
      }
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
    return new Date(dateString).toLocaleDateString();
  };

  const getStreakEmoji = (streak: number) => {
    if (streak >= 30) return '🔥';
    if (streak >= 14) return '⚡';
    if (streak >= 7) return '💪';
    if (streak >= 3) return '🌟';
    return '✨';
  };

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchText.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderChallenge = (challenge: Challenge) => (
    <View key={challenge.id} style={styles.challengeCard}>
      <View style={styles.challengeHeader}>
        <Text style={styles.challengeName}>{challenge.name}</Text>
        <View style={styles.streakBadge}>
          <Text style={styles.streakEmoji}>{getStreakEmoji(challenge.current_streak)}</Text>
          <Text style={styles.streakText}>{challenge.current_streak}</Text>
        </View>
      </View>
      {challenge.description && (
        <Text style={styles.challengeDescription}>{challenge.description}</Text>
      )}
      <View style={styles.challengeStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Check-ins</Text>
          <Text style={styles.statValue}>{challenge.total_checkins}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Frequency</Text>
          <Text style={styles.statValue}>{challenge.frequency}x/week</Text>
        </View>
      </View>
      {challenge.end_date && (
        <Text style={styles.dateText}>
          Ends {formatDate(challenge.end_date)}
        </Text>
      )}
    </View>
  );

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
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.challengesScroll}
            contentContainerStyle={styles.challengesContent}
          >
            {item.challenges.map(renderChallenge)}
          </ScrollView>
        ) : (
          <View style={styles.noGoalsContainer}>
            <Text style={styles.noGoalsEmoji}>🎯</Text>
            <Text style={styles.noGoalsText}>No active goals yet</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.heading}>Your Friends</Text>
              <View style={styles.searchContainer}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search friends..."
                  placeholderTextColor="#94a3b8"
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>
            </View>
          }
          data={filteredFriends}
          keyExtractor={(item) => item.friendshipId}
          renderItem={renderFriend}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
    backgroundColor: '#f8fafc' 
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  heading: { 
    fontSize: 32, 
    fontWeight: '700', 
    marginBottom: 20, 
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#1e293b',
  },
  listContent: {
    paddingBottom: 140,
  },
  friendCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: { 
    fontSize: 20, 
    fontWeight: '600', 
    color: '#1e293b',
    marginBottom: 2,
  },
  friendUsername: { 
    fontSize: 15, 
    color: '#64748b',
    fontWeight: '500',
  },
  unfriendButton: {
    backgroundColor: '#fee2e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  unfriendText: { 
    color: '#dc2626', 
    fontWeight: '600',
    fontSize: 14,
  },
  goalsSection: {
    marginTop: 4,
  },
  goalsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  goalsCountBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  goalsCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  challengesScroll: {
    marginHorizontal: -20,
  },
  challengesContent: {
    paddingHorizontal: 20,
  },
  challengeCard: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 16,
    marginRight: 12,
    minWidth: 220,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
    lineHeight: 20,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  streakEmoji: {
    fontSize: 12,
    marginRight: 4,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  challengeDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    lineHeight: 18,
  },
  challengeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
  },
  noGoalsContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  noGoalsEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  noGoalsText: {
    fontSize: 16,
    color: '#64748b',
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
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: { 
    color: '#ffffff', 
    fontWeight: '600', 
    fontSize: 17,
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: { 
    color: '#64748b', 
    fontWeight: '600', 
    fontSize: 17,
  },
});