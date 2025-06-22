import React, { useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const dummyFriends = [
  { id: '1', name: 'Ayaan Khan', username: 'ayaan_k' },
  { id: '2', name: 'Sarah Malik', username: 'sarah.codes' },
  { id: '3', name: 'Zayd Patel', username: 'zaydp' },
];

export default function FriendsScreen() {
  const [searchText, setSearchText] = useState('');
  const [friends, setFriends] = useState(dummyFriends);

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(searchText.toLowerCase()) ||
    friend.username.toLowerCase().includes(searchText.toLowerCase())
  );

  const renderFriend = ({ item }: { item: typeof dummyFriends[0] }) => (
    <View style={styles.friendCard}>
      <Text style={styles.friendName}>{item.name}</Text>
      <Text style={styles.friendUsername}>@{item.username}</Text>
      <TouchableOpacity style={styles.unfriendButton}>
        <Text style={styles.unfriendText}>Unfriend</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.heading}>Your Friends</Text>

      <TextInput
        style={styles.searchInput}
        placeholder="Search friends..."
        value={searchText}
        onChangeText={setSearchText}
      />

      <FlatList
        data={filteredFriends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <TouchableOpacity style={styles.requestButton}>
        <Text style={styles.requestText}>+ Send Friend Request</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff' },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#111' },
  searchInput: {
    height: 40,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
  },
  friendCard: {
    backgroundColor: '#f1f1f1',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  friendName: { fontSize: 18, fontWeight: '600', color: '#111' },
  friendUsername: { fontSize: 14, color: '#666', marginTop: 4 },
  unfriendButton: {
    marginTop: 8,
    backgroundColor: '#dc3545',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  unfriendText: { color: '#fff', fontWeight: '600' },
  requestButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  requestText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
