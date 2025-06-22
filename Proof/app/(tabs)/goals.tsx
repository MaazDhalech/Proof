import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CheckinStatus = {
  date: string;
  is_missed: boolean;
  checkin_id?: number;
};

type Goal = {
  id: number;
  name: string;
  description: string;
  start_date: string;
  target_date: string;
  goal_type: 'manual' | 'scheduled';
  checkin_freq: 'daily' | 'weekly' | 'monthly' | null;
  completed: boolean;
  weekly_target: number;
  current_week_start: string;
  current_week_checkins: CheckinStatus[];
  successful_checkins: number;
  missed_checkins: number;
  total_checkins_this_week: number;
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'your' | 'friends'>('your');

  useEffect(() => {
    if (tab === 'your') fetchGoals();
    // future: fetch friends' goals if tab === 'friends'
  }, [tab]);

  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    return new Date(d.setDate(diff));
  };

  const getCurrentWeekDates = (weekStart: Date, target: number) => {
    const dates = [];
    for (let i = 0; i < target; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  };

const fetchGoals = async () => {
  setLoading(true);

  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user.id;
  
  if (!uid) {
    console.log('No user session found');
    setLoading(false);
    return;
  }

  console.log('Fetching goals for user:', uid);

  try {
    // First, update any missed check-ins by calling our database function
    await supabase.rpc('mark_missed_checkins');

    // Try to fetch from the view first, but with correct column name
    const { data: viewData, error: viewError } = await supabase
      .from('current_week_progress')
      .select('*')
      .eq('user_id', uid); // Changed from 'challenge_id' to 'user_id'

    console.log('View query result:', { viewData, viewError });

    if (viewError || !viewData) {
      console.log('View failed, falling back to manual query');
      
      // Fallback to manual query
      const { data: goalsData, error: goalsError } = await supabase
        .from('challenges')
        .select(`
          id,
          name,
          description,
          start_date,
          target_date,
          goal_type,
          checkin_freq,
          completed,
          weekly_target,
          current_week_start
        `)
        .eq('user_id', uid)
        .eq('completed', false);

      console.log('Manual query result:', { goalsData, goalsError });

      if (goalsError) {
        console.error('Error fetching goals:', goalsError);
        setLoading(false);
        return;
      }

      if (!goalsData || goalsData.length === 0) {
        console.log('No goals found for user');
        setGoals([]);
        setLoading(false);
        return;
      }

      // Get current week start
      const currentWeekStart = getWeekStart(new Date());
      console.log('Current week start:', currentWeekStart);
      
      // Fetch check-ins for current week for each goal
      const goalsWithProgress = await Promise.all(
        goalsData.map(async (goal) => {
          console.log('Processing goal:', goal.name);
          
          const { data: checkins, error: checkinsError } = await supabase
            .from('challenge_checkins')
            .select('id, checkin_time, is_missed')
            .eq('challenge_id', goal.id)
            .gte('checkin_time', currentWeekStart.toISOString())
            .lt('checkin_time', new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('checkin_time');

          console.log(`Checkins for goal ${goal.name}:`, { checkins, checkinsError });

          if (checkinsError) {
            console.error('Error fetching check-ins:', checkinsError);
          }

          const currentWeekCheckins = (checkins || []).map(checkin => ({
            date: checkin.checkin_time.split('T')[0],
            is_missed: checkin.is_missed || false,
            checkin_id: checkin.id
          }));

          const processedGoal = {
            ...goal,
            current_week_start: currentWeekStart.toISOString().split('T')[0],
            current_week_checkins: currentWeekCheckins,
            successful_checkins: currentWeekCheckins.filter(c => !c.is_missed).length,
            missed_checkins: currentWeekCheckins.filter(c => c.is_missed).length,
            total_checkins_this_week: currentWeekCheckins.length,
            weekly_target: goal.weekly_target || (goal.checkin_freq === 'daily' ? 7 : 1),
            description: goal.description || 'No description provided'
          };

          console.log('Processed goal:', processedGoal);
          return processedGoal;
        })
      );

      console.log('Final goals with progress:', goalsWithProgress);
      setGoals(goalsWithProgress);
    } else {
      // Process data from the view
      console.log('Using view data');
      const formatted = viewData.map((item) => ({
        id: item.challenge_id || item.id,
        name: item.name,
        description: item.description || 'No description provided',
        start_date: item.start_date || '',
        target_date: item.target_date || '',
        goal_type: item.goal_type,
        checkin_freq: item.checkin_freq,
        completed: false,
        weekly_target: item.weekly_target,
        current_week_start: item.current_week_start,
        current_week_checkins: item.week_checkins || [],
        successful_checkins: item.successful_checkins_this_week,
        missed_checkins: item.missed_checkins_this_week,
        total_checkins_this_week: item.total_checkins_this_week,
      }));
      
      console.log('Formatted view data:', formatted);
      setGoals(formatted || []);
    }
  } catch (err) {
    console.error('Error in fetchGoals:', err);
  }

  setLoading(false);
};

  const getCircleStatus = (goal: Goal, index: number) => {
    const weekStart = new Date(goal.current_week_start);
    const targetDate = new Date(weekStart);
    targetDate.setDate(weekStart.getDate() + index);
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    const checkin = goal.current_week_checkins.find(c => c.date === targetDateStr);
    
    if (checkin) {
      return checkin.is_missed ? 'missed' : 'completed';
    }
    
    // Check if this date is in the future
    const today = new Date().toISOString().split('T')[0];
    if (targetDateStr > today) {
      return 'future';
    }
    
    // If it's today or past and no checkin exists, it's pending/missed
    return 'pending';
  };

  const renderCircle = (status: string, index: number) => {
    let backgroundColor = '#e9ecef';
    let borderColor = '#dee2e6';
    let content = '';
    let textColor = '#666';

    switch (status) {
      case 'completed':
        backgroundColor = '#4CAF50';
        borderColor = '#4CAF50';
        content = '✓';
        textColor = '#fff';
        break;
      case 'missed':
        backgroundColor = '#F44336';
        borderColor = '#F44336';
        content = '✗';
        textColor = '#fff';
        break;
      case 'pending':
        backgroundColor = '#FFC107';
        borderColor = '#FFC107';
        content = '!';
        textColor = '#fff';
        break;
      case 'future':
        backgroundColor = '#e9ecef';
        borderColor = '#dee2e6';
        content = '';
        textColor = '#666';
        break;
    }

    return (
      <View
        key={index}
        style={[
          styles.circle,
          { backgroundColor, borderColor }
        ]}
      >
        <Text style={[styles.circleText, { color: textColor }]}>
          {content}
        </Text>
      </View>
    );
  };

  const formatFrequency = (type: string, freq: string | null) => {
    if (type === 'manual') return 'Manual Check-ins';
    if (!freq) return 'Scheduled';
    return `${freq.charAt(0).toUpperCase() + freq.slice(1)} Check-ins`;
  };

  const getWeeklyDisplayText = (goal: Goal) => {
    if (goal.checkin_freq === 'monthly') {
      return `${goal.successful_checkins}/1 this month`;
    } else if (goal.checkin_freq === 'weekly') {
      return `${goal.successful_checkins}/1 this week`;
    } else {
      return `${goal.successful_checkins}/${goal.weekly_target} this week`;
    }
  };

  const renderGoal = ({ item }: { item: Goal }) => (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.goalInfo}>
          <Text style={styles.goalTitle}>{item.name}</Text>
          <Text style={styles.goalDescription}>{item.description}</Text>
          <Text style={styles.goalFrequency}>
            {formatFrequency(item.goal_type, item.checkin_freq)}
          </Text>
        </View>
        {item.completed && (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>✓</Text>
          </View>
        )}
      </View>

      {/* Progress Section with Circles */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>This Week's Progress</Text>
          <Text style={styles.progressStats}>
            {getWeeklyDisplayText(item)}
          </Text>
        </View>
        
        <View style={styles.circlesContainer}>
          {Array.from({ length: item.weekly_target }, (_, index) => {
            const status = getCircleStatus(item, index);
            return renderCircle(status, index);
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendCircle, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>Done</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendCircle, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>Missed</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendCircle, { backgroundColor: '#FFC107' }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.checkInButton}
        onPress={() => router.push({
          pathname: `/goals/${item.id}/check-in`,
          params: {
            challengeName: item.title,
            challengeDescription: item.description,
            id: item.id
          }
        })}
      >
        <Text style={[styles.checkInText, item.completed && styles.completedButtonText]}>
          {item.completed ? 'Goal Completed' : 'Check In'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, tab === 'your' && styles.activeTab]}
          onPress={() => setTab('your')}
        >
          <Text style={[styles.tabText, tab === 'your' && styles.activeTabText]}>Your Goals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'friends' && styles.activeTab]}
          onPress={() => setTab('friends')}
        >
          <Text style={[styles.tabText, tab === 'friends' && styles.activeTabText]}>Friends' Goals</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007aff" />
          <Text style={styles.loadingText}>Loading your goals...</Text>
        </View>
      ) : tab === 'your' ? (
        <FlatList
          data={goals}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderGoal}
          contentContainerStyle={styles.goalList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No goals yet!</Text>
              <Text style={styles.emptySubtitle}>Create your first goal to get started</Text>
            </View>
          }
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Friends' goals view coming soon.</Text>
        </View>
      )}

      {tab === 'your' && (
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => router.push('/goals/create')}
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
    backgroundColor: '#f8f9fa', 
    paddingHorizontal: 20 
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
  goalList: { 
    paddingBottom: 100,
    paddingTop: 12,
  },
  goalCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    marginBottom: 16,
  },
  goalInfo: {
    flex: 1,
  },
  goalTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1a1a1a',
    marginBottom: 6,
  },
  goalDescription: { 
    fontSize: 15, 
    color: '#666', 
    lineHeight: 20,
    marginBottom: 4,
  },
  goalFrequency: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  completedBadge: {
    backgroundColor: '#4CAF50',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  circlesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  circleText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  checkInButton: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  completedButton: {
    backgroundColor: '#e9ecef',
    shadowOpacity: 0,
    elevation: 0,
  },
  checkInText: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16,
  },
  completedButtonText: {
    color: '#666',
  },
  createButton: {
    backgroundColor: '#007aff',
    padding: 18,
    borderRadius: 12,
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: -20,
    marginTop: 0,
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 3,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#007aff',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#007aff',
    fontWeight: '700',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#888',
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
});