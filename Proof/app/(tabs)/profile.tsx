import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  avatar_url?: string;
  dob?: string;
  state?: string;
  longest_streak?: number;
  goals_completed?: number;
  total_goals?: number;
};

type UserStats = {
  goalsCompleted: number;
  longestStreak: number;
  completionRate: number;
  totalGoals: number;
};

export default function ProfileScreen() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    goalsCompleted: 0,
    longestStreak: 0,
    completionRate: 0,
    totalGoals: 0
  });
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tempData, setTempData] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    dob: '',
    state: ''
  });

  const scrollViewRef = useRef<ScrollView>(null);

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (str: string) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Helper function to format date for display without timezone issues
  const formatDateForDisplay = (dateString: string | undefined) => {
    if (!dateString) return 'Not set';
    
    // If it's already in MM/DD/YYYY format, return as is
    if (dateString.includes('/')) {
      return dateString;
    }
    
    // If it's in ISO format (YYYY-MM-DD), parse it without timezone conversion
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
  };

  // Format DOB with slashes while typing
  const formatDOB = (input: string) => {
    const numbersOnly = input.replace(/\D/g, '');
    if (numbersOnly.length <= 2) return numbersOnly;
    if (numbersOnly.length <= 4) return `${numbersOnly.slice(0, 2)}/${numbersOnly.slice(2)}`;
    if (numbersOnly.length <= 6) return `${numbersOnly.slice(0, 2)}/${numbersOnly.slice(2, 4)}/${numbersOnly.slice(4)}`;
    return `${numbersOnly.slice(0, 2)}/${numbersOnly.slice(2, 4)}/${numbersOnly.slice(4, 8)}`;
  };

  const handleDOBChange = (text: string) => {
    if (text.length > 10) return;
    const formatted = formatDOB(text);
    setTempData({...tempData, dob: formatted});
  };

  // Handle first name change with capitalization
  const handleFirstNameChange = (text: string) => {
    const capitalized = capitalizeFirstLetter(text);
    setTempData({...tempData, first_name: capitalized});
  };

  // Handle last name change with capitalization
  const handleLastNameChange = (text: string) => {
    const capitalized = capitalizeFirstLetter(text);
    setTempData({...tempData, last_name: capitalized});
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) throw authError || new Error('No user logged in');

        const { data: profileData, error: profileError } = await supabase
          .from('profile')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profileError) throw profileError;

        // Count total challenges for this user
        const { count: totalChallenges, error: challengesError } = await supabase
          .from('challenges')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', authUser.id);

        if (challengesError) {
          throw challengesError;
        }

        const userData = {
          ...profileData,
          email: authUser.email
        };

        // Use the count from the query
        const totalGoals = totalChallenges || 0;
        
        // For now, we'll use the goals_completed from profile if it exists
        // Otherwise default to 0
        const goalsCompleted = profileData.goals_completed || 0;
        
        const completionRate = totalGoals > 0 ? 
          Math.round((goalsCompleted / totalGoals) * 100) : 0;

        setUser(userData);
        setTempData({
          first_name: userData.first_name,
          last_name: userData.last_name,
          username: userData.username,
          email: userData.email,
          dob: formatDateForDisplay(userData.dob),
          state: userData.state || ''
        });

        setStats({
          goalsCompleted: goalsCompleted,
          longestStreak: profileData.longest_streak || 0,
          completionRate,
          totalGoals: totalGoals
        });

      } catch (error) {
        console.error('Error fetching user data:', error);
        await supabase.auth.signOut(); // Force logout
        router.replace('/(auth)/signin'); // Redirect to login
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const openEditModal = () => {
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    if (user) {
      setTempData({
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        email: user.email,
        dob: formatDateForDisplay(user.dob),
        state: user.state || ''
      });
    }
    setEditModalVisible(false);
  };

  const handleSave = async () => {
    try {
      if (!tempData.first_name || !tempData.last_name || !tempData.username) {
        Alert.alert('Validation Error', 'Please fill all required fields');
        return;
      }

      const { error: profileError } = await supabase
        .from('profile')
        .update({
          first_name: tempData.first_name,
          last_name: tempData.last_name,
          username: tempData.username,
          dob: tempData.dob,
          state: tempData.state,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update auth email if changed
      if (tempData.email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: tempData.email
        });
        if (emailError) throw emailError;
      }

      const updatedUser = {
        ...user!,
        first_name: tempData.first_name,
        last_name: tempData.last_name,
        username: tempData.username,
        email: tempData.email,
        dob: tempData.dob,
        state: tempData.state
      };

      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully');

    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (loading || !user) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        
        <Text style={styles.name}>{user.first_name} {user.last_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
      </View>

      {/* Stats Section */}
      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.longestStreak}</Text>
            <Text style={styles.statLabel}>Longest Streak</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.completionRate}%</Text>
            <Text style={styles.statLabel}>Completion Rate</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.goalsCompleted}</Text>
            <Text style={styles.statLabel}>Goals Completed</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalGoals}</Text>
            <Text style={styles.statLabel}>Total Goals</Text>
          </View>
        </View>
      </View>

      {/* User Details */}
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text style={styles.detailValue}>{user.email}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Birthday</Text>
          <Text style={styles.detailValue}>
            {formatDateForDisplay(user.dob)}
          </Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Location</Text>
          <Text style={styles.detailValue}>{user.state || 'Not set'}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
          <Text style={styles.buttonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>First Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.first_name}
                  onChangeText={handleFirstNameChange}
                  placeholder="First Name"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Last Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.last_name}
                  onChangeText={handleLastNameChange}
                  placeholder="Last Name"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Username</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.username}
                  onChangeText={(text) => setTempData({...tempData, username: text})}
                  placeholder="Username"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.email}
                  onChangeText={(text) => setTempData({...tempData, email: text})}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Birthday (MM/DD/YYYY)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.dob}
                  onChangeText={handleDOBChange}
                  placeholder="MM/DD/YYYY"
                  keyboardType="number-pad"
                  maxLength={10}
                  returnKeyType="next"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Location</Text>
                <TextInput
                  style={styles.modalInput}
                  value={tempData.state}
                  onChangeText={(text) => setTempData({...tempData, state: text})}
                  placeholder="State/Region"
                  returnKeyType="done"
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={closeEditModal}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalSaveButton} onPress={handleSave}>
                  <Text style={styles.modalButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 8,
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  buttonsContainer: {
    gap: 12,
  },
  editButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutText: {
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 16,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginVertical: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1e293b',
  },
  modalInputGroup: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '500',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalSaveButton: {
    backgroundColor: '#6366f1',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});