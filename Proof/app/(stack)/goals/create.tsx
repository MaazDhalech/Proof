import { supabase } from '@/services/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
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
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [frequency, setFrequency] = useState('');
  const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  const parsedFrequency = parseInt(frequency);

  // Validate required fields
  if (!name.trim()) {
    Alert.alert('Missing Field', 'Goal name is required.');
    return;
  }

  if (!description.trim()) {
    Alert.alert('Missing Field', 'Description is required.');
    return;
  }

  if (!frequency || isNaN(parsedFrequency)) {
    Alert.alert('Missing Field', 'Please enter a valid frequency.');
    return;
  }

  if (parsedFrequency < 1) {
    Alert.alert('Invalid Frequency', 'Frequency must be at least 1.');
    return;
  }

  if (!startDate) {
    Alert.alert('Missing Field', 'Start date is required.');
    return;
  }

  if (!endDate) {
    Alert.alert('Missing Field', 'End date is required.');
    return;
  }

  const start = new Date(startDate.setHours(0, 0, 0, 0));
  const end = new Date(endDate.setHours(0, 0, 0, 0));

  if (start.getTime() === end.getTime()) {
    Alert.alert('Invalid Dates', 'Start and end dates cannot be the same.');
    return;
  }

  if (end < start) {
    Alert.alert('Invalid Dates', 'End date cannot be before start date.');
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

  const payload = {
    user_id: userId,
    name,
    description,
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    current_streak: 0,
    last_day: null,
    frequency: parsedFrequency,
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardContainer}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => router.replace('/goals')} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Create New Goal</Text>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Goal Title *</Text>
            <TextInput
              placeholder="e.g., Meditate daily"
              style={styles.input}
              value={name}
              onChangeText={setName}
              maxLength={100}
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              placeholder="Describe your goal"
              style={[styles.input, styles.textArea]}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>How many times? *</Text>
            <Text style={styles.labelDescription}>Set how many times you want to commit to this goal within a time period</Text>
            <TextInput
              placeholder="e.g., 30"
              style={styles.input}
              keyboardType="numeric"
              value={frequency}
              onChangeText={setFrequency}
            />
          </View>

          <Text style={styles.label}>Start Date</Text>
          <DateTimePicker value={startDate} mode="date" onChange={(_, date) => date && setStartDate(date)} />

          <Text style={styles.label}>End Date</Text>
          <DateTimePicker
            value={endDate || new Date()}
            mode="date"
            onChange={(_, date) => date && setEndDate(date)}
          />

          <TouchableOpacity
            style={[styles.submitButton, loading && { backgroundColor: '#888' }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitText}>{loading ? 'Creating...' : 'Create Goal'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  keyboardContainer: { flex: 1 },
  content: { padding: 24, paddingTop: 16 },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e1e3e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: { color: '#0066ff', fontSize: 16, fontWeight: '600' },
  heading: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, color: '#111' },
  inputSection: { marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  label: { fontWeight: '700', fontSize: 16, color: '#333', marginBottom: 8 },
  labelDescription: { fontSize: 14, color: '#666', marginBottom: 12 },
  submitButton: {
    backgroundColor: '#007aff',
    padding: 18,
    borderRadius: 12,
    marginTop: 32,
    alignItems: 'center',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
