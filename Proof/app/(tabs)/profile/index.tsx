import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ProfileScreen() {
  // Dummy user data (replace with real Supabase/Clerk session data later)
  const user = {
    firstName: 'Maaz',
    lastName: 'Dhalech',
    username: 'maazcodes',
    profilePic: 'https://i.pravatar.cc/150?img=8',
    streak: 12,
    totalProofs: 37,
    goalsCreated: 5,
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image source={{ uri: user.profilePic }} style={styles.avatar} />

      <Text style={styles.name}>{user.firstName} {user.lastName}</Text>
      <Text style={styles.username}>@{user.username}</Text>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{user.streak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{user.totalProofs}</Text>
          <Text style={styles.statLabel}>Proofs Logged</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{user.goalsCreated}</Text>
          <Text style={styles.statLabel}>Goals Created</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111',
  },
  username: {
    fontSize: 16,
    color: '#555',
    marginBottom: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007aff',
  },
  statLabel: {
    fontSize: 14,
    color: '#777',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
