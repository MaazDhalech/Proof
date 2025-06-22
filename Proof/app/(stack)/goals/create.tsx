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
      checkin_time: goalType === 'scheduled' ? checkinTime.toTimeString().split(' ')[0] : null,
      next_checkin_due: goalType === 'scheduled' ? startDate.toISOString() : null,
      checkin_freq: checkinFreq,
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
          
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.replace('/goals')}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.heading}>Create New Goal</Text>
          <Text style={styles.subheading}>Set up your personal goal and track your progress</Text>

          {/* Goal Title Section */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Goal Title *</Text>
            <Text style={styles.labelDescription}>Give your goal a clear, motivating name</Text>
            <TextInput 
              placeholder="e.g., Run 5K daily, Learn Spanish, Read 12 books" 
              style={styles.input} 
              value={name} 
              onChangeText={setName}
              maxLength={100}
            />
            {name.length > 80 && (
              <Text style={styles.characterCount}>{name.length}/100 characters</Text>
            )}
          </View>

          {/* Goal Description Section */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Description</Text>
            <Text style={styles.labelDescription}>Describe what you want to achieve and why it matters to you</Text>
            <TextInput
              placeholder="Write about your motivation, specific targets, or any additional details that will help you stay focused..."
              style={[styles.input, styles.textArea]}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{description.length}/500 characters</Text>
          </View>

          <Text style={styles.label}>Goal Type</Text>
          <Text style={styles.labelDescription}>Choose how you want to track progress</Text>
          <View style={styles.row}>
            {[
              { key: 'manual', label: 'Manual', desc: 'Check in when you want' },
              { key: 'scheduled', label: 'Scheduled', desc: 'Regular automatic reminders' }
            ].map((type) => (
              <TouchableOpacity
                key={type.key}
                onPress={() => setGoalType(type.key as 'manual' | 'scheduled')}
                style={[
                  styles.typeButton,
                  goalType === type.key && styles.selectedButton,
                ]}
              >
                <Text style={goalType === type.key ? styles.selectedText : styles.buttonText}>
                  {type.label}
                </Text>
                <Text style={[
                  styles.typeDescription,
                  goalType === type.key ? styles.selectedTypeDescription : styles.unselectedTypeDescription
                ]}>
                  {type.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Check-In Frequency</Text>
          <Text style={styles.labelDescription}>
            {goalType === 'manual' 
              ? 'How often do you plan to check in on your progress?' 
              : 'How often do you want to be reminded?'}
          </Text>
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
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Start Date</Text>
          <Text style={styles.labelDescription}>When do you want to begin working on this goal?</Text>
          <DateTimePicker value={startDate} mode="date" onChange={(_, date) => date && setStartDate(date)} />

          <Text style={styles.label}>Target Date</Text>
          <Text style={styles.labelDescription}>When do you aim to complete this goal?</Text>
          <DateTimePicker value={targetDate} mode="date" onChange={(_, date) => date && setTargetDate(date)} />

          {goalType === 'scheduled' && (
            <>
              <Text style={styles.label}>Check-In Time</Text>
              <Text style={styles.labelDescription}>What time works best for reminders?</Text>
              <DateTimePicker value={checkinTime} mode="time" onChange={(_, date) => date && setCheckinTime(date)} />
            </>
          )}

          <Text style={styles.label}>End Date (Optional)</Text>
          <Text style={styles.labelDescription}>Set a final deadline if needed</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  content: { 
    padding: 24,
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e1e3e6',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    color: '#0066ff',
    fontSize: 16,
    fontWeight: '600',
  },
  heading: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 8, 
    color: '#111' 
  },
  subheading: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  labelDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  row: { 
    flexDirection: 'row', 
    gap: 12, 
    marginBottom: 24 
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedButton: {
    backgroundColor: '#e8f2ff',
    borderColor: '#007aff',
  },
  buttonText: { 
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },
  selectedText: { 
    color: '#007aff', 
    fontWeight: '700',
    textAlign: 'center',
  },
  typeDescription: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  selectedTypeDescription: {
    color: '#007aff',
  },
  unselectedTypeDescription: {
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007aff',
    padding: 18,
    borderRadius: 12,
    marginTop: 32,
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
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});