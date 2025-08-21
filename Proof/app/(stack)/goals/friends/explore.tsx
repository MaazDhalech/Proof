import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type PendingKind = 'outgoing' | 'incoming' | null;

type User = {
  id: string;
  name: string;
  username: string;
  pending: PendingKind; // you->them or them->you
};

export default function ExploreFriendsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null); // disable button while mutating

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) await fetchUsersNotFriendsOrPending(uid);
    };
    init();
  }, []);

  // Include users who are NOT accepted friends.
  // People with pending (either direction) are INCLUDED and tagged.
  const fetchUsersNotFriendsOrPending = async (uid: string) => {
    // ACCEPTED (to EXCLUDE later)
    const { data: acceptedRels, error: accErr } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(
        `and(user_id.eq.${uid},status.eq.accepted),and(friend_id.eq.${uid},status.eq.accepted)`
      );
    if (accErr) {
      console.error('ACCEPTED fetch error:', accErr);
      return;
    }
    const acceptedSet = new Set<string>(
      (acceptedRels ?? []).map(r => (r.user_id === uid ? r.friend_id : r.user_id))
    );

    // PENDING (to TAG)
    const { data: pendingRels, error: pendErr } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(
        `and(user_id.eq.${uid},status.eq.pending),and(friend_id.eq.${uid},status.eq.pending)`
      );
    if (pendErr) {
      console.error('PENDING fetch error:', pendErr);
      return;
    }
    const pendingMap = new Map<string, PendingKind>();
    for (const r of pendingRels ?? []) {
      const other = r.user_id === uid ? r.friend_id : r.user_id;
      const dir: PendingKind = r.user_id === uid ? 'outgoing' : 'incoming';
      pendingMap.set(other, dir);
    }

    // PROFILES (filter client-side to keep pending)
    const { data: profiles, error: profErr } = await supabase
      .from('profile') // singular in your schema
      .select('id, username, first_name, last_name')
      .neq('id', uid);
    if (profErr) {
      console.error('PROFILES fetch error:', profErr);
      return;
    }

    const formatted: User[] = (profiles ?? [])
      .filter(u => !acceptedSet.has(u.id)) // hide accepted
      .map(u => ({
        id: u.id as string,
        username: u.username as string,
        name: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        pending: pendingMap.get(u.id) ?? null,
      }));

    setAllUsers(formatted);
  };

  // Toggle: send if none, open "Respond" if incoming, cancel if outgoing
  const toggleRequest = async (otherId: string) => {
    if (!currentUserId) return;
    const row = allUsers.find(u => u.id === otherId);
    if (!row) return;

    try {
      setWorkingId(otherId);

      if (row.pending === 'incoming') {
        // They requested you → take them to requests screen (or accept inline if you prefer)
        router.push('/friends/requests');
        return;
      }

      if (row.pending === 'outgoing') {
        // CANCEL your pending request
        // Optimistic UI: clear pending immediately
        setAllUsers(prev => prev.map(u => (u.id === otherId ? { ...u, pending: null } : u)));

        const { error } = await supabase
          .from('friendships')
          .delete()
          .eq('user_id', currentUserId)
          .eq('friend_id', otherId)
          .eq('status', 'pending');

        if (error) {
          // revert on failure
          setAllUsers(prev => prev.map(u => (u.id === otherId ? { ...u, pending: 'outgoing' } : u)));
          console.error('Cancel request error:', error);
          Alert.alert('Could not cancel request', error.message ?? 'Unknown error');
        }
        return;
      }

      // No relation → SEND request
      setAllUsers(prev => prev.map(u => (u.id === otherId ? { ...u, pending: 'outgoing' } : u)));

      const { error } = await supabase.from('friendships').insert([
        { user_id: currentUserId, friend_id: otherId, status: 'pending' },
      ]);

      if (error) {
        // Unique violation or other error → revert
        setAllUsers(prev => prev.map(u => (u.id === otherId ? { ...u, pending: null } : u)));
        console.error('Send request error:', error);
        Alert.alert('Could not send request', error.message ?? 'Unknown error');
      }
    } finally {
      setWorkingId(null);
    }
  };

  // --- Fuzzy search (unchanged) ---
  function fuzzyScore(text: string, search: string) {
    if (!search) return 1;
    if (!text) return 0;

    const textLower = text.toLowerCase();
    const searchLower = search.toLowerCase();
    const cleanText = textLower.replace(/[\s\-_.]+/g, '');
    const searchWords = searchLower.trim().split(/[\s]+/).filter(Boolean);

    if (searchWords.length > 1) {
      let totalScore = 0;
      let wordsMatched = 0;
      for (const w of searchWords) {
        const s = fuzzyScore(text, w);
        if (s > 0) {
          totalScore += s;
          wordsMatched++;
        }
      }
      return wordsMatched >= Math.ceil(searchWords.length * 0.7)
        ? totalScore / searchWords.length
        : 0;
    }

    const single = searchWords[0] || searchLower;
    const cleanSingle = single.replace(/[\s\-_.]+/g, '');

    if (textLower === single || cleanText === cleanSingle) return 100;
    if (textLower.includes(single)) return 90;
    if (cleanText.includes(cleanSingle)) return 85;

    const words = textLower.split(/[\s\-_.]+/);
    for (const w of words) {
      if (w.startsWith(single)) return 75;
      if (w.includes(single)) return 60;
    }

    function editDistance(a: string, b: string) {
      if (Math.abs(a.length - b.length) > 3) return Infinity;
      const m = Array(b.length + 1)
        .fill(null)
        .map(() => Array(a.length + 1).fill(0));
      for (let i = 0; i <= a.length; i++) m[0][i] = i;
      for (let j = 0; j <= b.length; j++) m[j][0] = j;
      for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          m[j][i] = Math.min(m[j][i - 1] + 1, m[j - 1][i] + 1, m[j - 1][i - 1] + cost);
        }
      }
      return m[b.length][a.length];
    }

    if (single.length >= 3) {
      for (const w of words) {
        const d = editDistance(w, single);
        const max = Math.floor(single.length / 3);
        if (d <= max) return 50 - d * 10;
      }
    }

    let idx = 0;
    let score = 0;
    let bonus = 1;
    for (let i = 0; i < cleanText.length && idx < cleanSingle.length; i++) {
      if (cleanText[i] === cleanSingle[idx]) {
        score += bonus;
        bonus = Math.min(bonus + 1, 5);
        idx++;
      } else {
        bonus = 1;
      }
    }
    return idx === cleanSingle.length ? Math.min(score, 40) : 0;
  }

  const filteredUsers = useMemo(() => {
    const q = searchText.trim();
    if (!q) return [];
    return allUsers
      .map(u => ({
        ...u,
        score: Math.max(fuzzyScore(u.name, q), fuzzyScore(u.username, q)),
      }))
      .filter(u => u.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [searchText, allUsers]);

  const renderUser = ({ item }: { item: User }) => {
    const isOutgoing = item.pending === 'outgoing';
    const isIncoming = item.pending === 'incoming';

    // Labels + styles for each state
    const label = isOutgoing ? 'Cancel Request' : isIncoming ? 'Respond' : 'Send Friend Request';
    const style = [
      styles.button,
      isOutgoing && styles.buttonCancel,
      isIncoming && styles.buttonRespond,
      workingId === item.id && styles.buttonDisabled,
    ];
    const disabled = workingId === item.id;

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.username}>@{item.username}</Text>

        <TouchableOpacity
          style={style}
          disabled={disabled}
          onPress={() => toggleRequest(item.id)}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
  container: { flex: 1, paddingTop: 60, paddingHorizontal: 20, backgroundColor: '#fff' },
  backButtonWrapper: { marginBottom: 10, marginTop: 10 },
  backButton: { padding: 8, alignSelf: 'flex-start' },
  backText: { color: '#007aff', fontSize: 16, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#111' },
  searchInput: {
    height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 12, marginBottom: 16, backgroundColor: '#f9f9f9',
  },
  card: { backgroundColor: '#f1f1f1', padding: 16, borderRadius: 10, marginBottom: 12 },
  name: { fontSize: 18, fontWeight: '600', color: '#111' },
  username: { fontSize: 14, color: '#666', marginTop: 4 },
  button: {
    marginTop: 8, backgroundColor: '#007aff', padding: 10,
    borderRadius: 6, alignItems: 'center',
  },
  buttonRespond: { backgroundColor: '#ffac33' },
  buttonCancel: { backgroundColor: '#dc3545' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
