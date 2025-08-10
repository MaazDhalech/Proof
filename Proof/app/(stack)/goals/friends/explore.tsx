import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type User = {
  id: string;
  name: string;
  username: string;
};

export default function ExploreFriendsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) await fetchUsersNotFriends(uid);
    };

    init();
  }, []);

  const fetchUsersNotFriends = async (uid: string) => {
    const { data: existingRelations, error } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', uid);

    if (error) {
      console.error('Error fetching friendships:', error);
      return;
    }

    const friendIds = existingRelations?.map((f) => f.friend_id) || [];
    const excludedIds = [...friendIds, uid];

    const formattedList = `(${excludedIds.map((id) => `"${id}"`).join(',')})`;

    const { data: profiles, error: userError } = await supabase
      .from('profile')
      .select('id, username, first_name, last_name')
      .not('id', 'in', formattedList);

    if (userError) {
      console.error('Error fetching profiles:', userError);
      return;
    }

    const formatted = profiles.map((user) => ({
      id: user.id,
      username: user.username,
      name: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
    }));

    setAllUsers(formatted);
  };

  const sendFriendRequest = async (friendId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase.from('friendships').insert([
      {
        user_id: currentUserId,
        friend_id: friendId,
        status: 'pending',
      },
    ]);

    if (error) {
      console.error('Error sending friend request:', error);
    } else {
      setAllUsers((prev) => prev.filter((u) => u.id !== friendId));
    }
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

  // Replace your filter with this:
  const filteredUsers = searchText.trim() === '' ? [] // If the search text is empty, return an empty list
    : allUsers
      .map(user => ({
        ...user,
        score: Math.max(
          fuzzyScore(user.name, searchText),
          fuzzyScore(user.username, searchText)
        )
      }))
      .filter(user => user.score > 0)
      .sort((a, b) => b.score - a.score);

  const renderUser = ({ item }: { item: User }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.username}>@{item.username}</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => sendFriendRequest(item.id)}
      >
        <Text style={styles.buttonText}>Send Friend Request</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
  {/* Back Button with spacing */}
  <View style={styles.backButtonWrapper}>
    <TouchableOpacity onPress={() => router.push('/friends')} style={styles.backButton}>
      <Text style={styles.backText}>← Back</Text>
    </TouchableOpacity>
  </View>

  <Text style={styles.heading}>Explore New Friends</Text>

  <TextInput
    style={styles.searchInput}
    placeholder="Search users..."
    value={searchText}
    onChangeText={setSearchText}
  />

  <FlatList
    data={filteredUsers}
    keyExtractor={(item) => item.id}
    renderItem={renderUser}
    contentContainerStyle={{ paddingBottom: 100 }}
  />
</View>
  );
}

const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: 60,
      paddingHorizontal: 20,
      backgroundColor: '#fff',
    },
    backButtonWrapper: {
      marginBottom: 10,
      marginTop: 10,
    },
    backButton: {
      padding: 8,
      alignSelf: 'flex-start',
    },
    backText: {
      color: '#007aff',
      fontSize: 16,
      fontWeight: '600',
    },
    heading: {
      fontSize: 28,
      fontWeight: 'bold',
      marginBottom: 20,
      color: '#111',
    },
    searchInput: {
      height: 40,
      borderColor: '#ccc',
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 16,
      backgroundColor: '#f9f9f9',
    },
    card: {
      backgroundColor: '#f1f1f1',
      padding: 16,
      borderRadius: 10,
      marginBottom: 12,
    },
    name: {
      fontSize: 18,
      fontWeight: '600',
      color: '#111',
    },
    username: {
      fontSize: 14,
      color: '#666',
      marginTop: 4,
    },
    button: {
      marginTop: 8,
      backgroundColor: '#007aff',
      padding: 10,
      borderRadius: 6,
      alignItems: 'center',
    },
    buttonText: {
      color: '#fff',
      fontWeight: '600',
    },
  });
