import { supabase } from '@/services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CreateGoalScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState<'manual' | 'scheduled'>('manual');
  const [checkinFreq, setCheckinFreq] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [checkinTime, setCheckinTime] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [targetDate, setTargetDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name || !goalType || !startDate || !targetDate) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      Alert.alert('Auth error', 'Please sign in again.');
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    const payload: any = {
      user_id: userId,
      name,
      description: description || null,
      start_date: startDate.toISOString(),
      target_date: targetDate.toISOString(),
      end_date: endDate ? endDate.toISOString() : null,
      goal_type: goalType,
      completed: false,
      last_checkin: null,
      checkin_time: checkinTime.toTimeString().split(' ')[0],
      next_checkin_due: goalType === 'scheduled' ? startDate.toISOString() : null,
      checkin_freq: goalType === 'scheduled' ? checkinFreq : null,
    };

    const { error } = await supabase.from('challenges').insert(payload);

    if (error) {
      console.error('Create Goal Error:', error);
      Alert.alert('Error', 'Failed to create goal.');
    } else {
      router.replace('/goals');
    }

    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ marginTop: 20, marginBottom: 12 }}
        >
          <Text style={{ color: '#007aff', fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Create New Goal</Text>

        <TextInput placeholder="Goal Title *" style={styles.input} value={name} onChangeText={setName} />
        <TextInput
          placeholder="Description (optional)"
          style={[styles.input, { height: 100 }]}
          multiline
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Goal Type</Text>
        <View style={styles.row}>
          {['manual', 'scheduled'].map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setGoalType(type as 'manual' | 'scheduled')}
              style={[
                styles.typeButton,
                goalType === type && styles.selectedButton,
              ]}
            >
              <Text style={goalType === type ? styles.selectedText : styles.buttonText}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {goalType === 'scheduled' && (
          <>
            <Text style={styles.label}>Check-In Frequency</Text>
            <View style={styles.row}>
              {['daily', 'weekly', 'monthly'].map((freq) => (
                <TouchableOpacity
                  key={freq}
                  onPress={() => setCheckinFreq(freq as any)}
                  style={[
                    styles.typeButton,
                    checkinFreq === freq && styles.selectedButton,
                  ]}
                >
                  <Text style={checkinFreq === freq ? styles.selectedText : styles.buttonText}>
                    {freq}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>Start Date</Text>
        <DateTimePicker value={startDate} mode="date" onChange={(_, date) => date && setStartDate(date)} />

        <Text style={styles.label}>Target Date</Text>
        <DateTimePicker value={targetDate} mode="date" onChange={(_, date) => date && setTargetDate(date)} />

        <Text style={styles.label}>Check-In Time</Text>
        <DateTimePicker value={checkinTime} mode="time" onChange={(_, date) => date && setCheckinTime(date)} />

        <Text style={styles.label}>Optional End Date</Text>
        <DateTimePicker value={endDate || new Date()} mode="date" onChange={(_, date) => date && setEndDate(date)} />

        <TouchableOpacity
          style={[styles.submitButton, loading && { backgroundColor: '#888' }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? 'Creating...' : 'Create Goal'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24 },
  heading: { fontSize: 26, fontWeight: 'bold', marginBottom: 24, color: '#111' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
    marginTop: 10,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#eee',
    borderRadius: 8,
  },
  selectedButton: {
    backgroundColor: '#007aff',
  },
  buttonText: { color: '#333' },
  selectedText: { color: '#fff', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#007aff',
    padding: 16,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
