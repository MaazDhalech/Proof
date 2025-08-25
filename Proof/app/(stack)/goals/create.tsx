import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import React, { useMemo, useState, useEffect } from 'react';
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
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Calendar, DateObject } from 'react-native-calendars';

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fromYMD = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayDiff = (a: Date, b: Date) => Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);

/** Weekly end must be N×7−1 days after start (e.g., 6, 13, 20…) */
const isWeeklyAligned = (s: Date, e: Date) => {
  const diff = dayDiff(s, e);
  return diff > 0 && diff % 7 === 6;
};
const snapWeeklyEnd = (s: Date, e: Date) => {
  let diff = dayDiff(s, e);
  if (diff <= 0) diff = 6; // minimum = 6 days (end of first week block)
  const r = diff % 7;
  if (r === 6) return addDays(s, diff); // already aligned

  // nearest value with remainder 6 (i.e., N×7−1)
  const downOffset = (r - 6 + 7) % 7; // steps backward to remainder 6
  const lower = Math.max(6, diff - downOffset);
  const upper = Math.max(6, lower + 7);
  const choose = (diff - lower) <= (upper - diff) ? lower : upper;
  return addDays(s, choose);
};

/* Build marked dates for a single-start or start→end period */
const buildMarkedDates = (start: Date | null, end: Date | null) => {
  const marks: Record<string, any> = {};
  if (!start) return marks;

  const s = toYMD(start);
  if (!end) {
    marks[s] = {
      startingDay: true,
      endingDay: true,
      color: '#007aff',
      textColor: '#fff',
    };
    return marks;
  }

  const e = toYMD(end);
  if (s === e) {
    marks[s] = {
      startingDay: true,
      endingDay: true,
      color: '#007aff',
      textColor: '#fff',
    };
    return marks;
  }

  // Ensure start <= end
  const startDate = start < end ? start : end;
  const endDate = end > start ? end : start;

  let cur = startDate;
  while (cur <= endDate) {
    const key = toYMD(cur);
    marks[key] = {
      color: '#cfe4ff',
      textColor: '#0b3b8f',
    };
    cur = addDays(cur, 1);
  }
  marks[toYMD(startDate)] = {
    startingDay: true,
    color: '#007aff',
    textColor: '#fff',
  };
  marks[toYMD(endDate)] = {
    endingDay: true,
    color: '#007aff',
    textColor: '#fff',
  };
  return marks;
};

export default function CreateGoalScreen() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Goal type
  const [goalType, setGoalType] = useState<'daily' | 'weekly' | 'arbitrary'>('daily');

  // Dates (single calendar controls both)
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(null);

  // Indefinite (hidden for arbitrary)
  const [isIndefinite, setIsIndefinite] = useState(false);

  // Frequency slider value
  const [frequency, setFrequency] = useState<number>(1);

  const [weeklySnapNote, setWeeklySnapNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startAtMidnight = useMemo(
    () => (startDate ? atMidnight(startDate) : null),
    [startDate]
  );
  const endAtMidnight = useMemo(
    () => (endDate ? atMidnight(endDate) : null),
    [endDate]
  );

  // Max for slider
  const maxFrequency = useMemo(() => {
    if (goalType === 'weekly') return 7;
    if (goalType === 'arbitrary') {
      if (!startAtMidnight || !endAtMidnight) return 1;
      const diffDays = Math.max(0, dayDiff(startAtMidnight, endAtMidnight));
      return Math.max(1, diffDays + 1); // inclusive
    }
    return 1;
  }, [goalType, startAtMidnight, endAtMidnight]);

  const sliderDisabled = goalType === 'arbitrary' && (!startAtMidnight || !endAtMidnight);
  const shouldShowFrequency = goalType !== 'daily';

  // Keep state sane on type switch
  useEffect(() => {
    setWeeklySnapNote(null);
    if (goalType === 'arbitrary' && isIndefinite) {
      setIsIndefinite(false);
    }
    if (goalType === 'weekly' && startAtMidnight && endAtMidnight && !isWeeklyAligned(startAtMidnight, endAtMidnight)) {
      setEndDate(null);
    }
  }, [goalType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep frequency in bounds
  useEffect(() => {
    setFrequency((prev) => {
      const capped = Math.min(Math.max(1, prev), maxFrequency || 1);
      return sliderDisabled ? 1 : capped;
    });
  }, [maxFrequency, sliderDisabled]);

  // Single calendar day press handler (range selection)
  const onCalendarPress = (day: DateObject) => {
    const pressed = fromYMD(day.dateString);
    setWeeklySnapNote(null);

    // If no start yet or both already chosen -> start a new selection
    if (!startDate || (startDate && endDate)) {
      setStartDate(pressed);
      setEndDate(null);
      return;
    }

    // If selecting second date:
    const s = atMidnight(startDate);
    const e = atMidnight(pressed);

    if (goalType === 'weekly') {
      // Weekly requires end >= start and N×7−1 days
      if (e <= s) {
        setStartDate(pressed);
        setEndDate(null);
        return;
      }
      if (!isWeeklyAligned(s, e)) {
        const snapped = snapWeeklyEnd(s, e);
        setEndDate(snapped);
        setWeeklySnapNote('Adjusted to nearest N×7−1 days (end of full-week block).');
      } else {
        setEndDate(e);
      }
    } else if (goalType === 'arbitrary') {
      // Arbitrary requires a finite range (end > start)
      if (e <= s) {
        setStartDate(pressed);
        setEndDate(null);
        return;
      }
      setEndDate(e);
    } else {
      // Daily: you can choose an end (optional) unless "No end date" is on
      if (isIndefinite) {
        setStartDate(pressed);
        setEndDate(null);
      } else {
        if (e <= s) {
          setStartDate(pressed);
          setEndDate(null);
          return;
        }
        setEndDate(e);
      }
    }
  };

  // Marked dates for the calendar
  const markedDates = useMemo(
    () => buildMarkedDates(startDate, (!isIndefinite || goalType === 'arbitrary') ? endDate : null),
    [startDate, endDate, isIndefinite, goalType]
  );

  const toLocalYMD = (d: Date) => toYMD(d);

  const handleSubmit = async () => {
    // Basic
    if (!name.trim()) {
      Alert.alert('Missing Field', 'Goal name is required.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Missing Field', 'Description is required.');
      return;
    }
    if (!startDate) {
      Alert.alert('Missing Field', 'Start date is required.');
      return;
    }

    if (!endDate && goalType === 'arbitrary') {
      Alert.alert('Missing Field', 'End date is required for arbitrary goals.');
      return;
    }
    if (isIndefinite && !endDate) {
      Alert.alert('Enter end date');
      return;
    }

    // Goal-type-specific validation
    if (goalType === 'arbitrary') {
      if (!endDate) {
        Alert.alert('Missing Field', 'Arbitrary goals require an End Date.');
        return;
      }
      if (endAtMidnight! <= startAtMidnight!) {
        Alert.alert('Invalid Dates', 'End date must be after start date.');
        return;
      }
    } else if (goalType === 'weekly') {
      if (!isIndefinite) {
        if (!endDate) {
          Alert.alert('Missing Field', 'End date is required (or mark as ongoing).');
          return;
        }
        if (endAtMidnight! <= startAtMidnight!) {
          Alert.alert('Invalid Dates', 'End date must be after start date.');
          return;
        }
        if (!isWeeklyAligned(startAtMidnight!, endAtMidnight!)) {
          Alert.alert(
            'Invalid End Date',
            'For weekly goals, end date must be N×7−1 days from the Start Date (e.g., 6, 13, 20…).'
          );
          return;
        }
      }
    } else {
      // daily
      if (!isIndefinite && endDate && endAtMidnight! <= startAtMidnight!) {
        Alert.alert('Invalid Dates', 'End date must be after start date.');
        return;
      }
    }

    // Frequency validation
    if (shouldShowFrequency) {
      if (frequency < 1) {
        Alert.alert('Invalid Frequency', 'Frequency must be at least 1.');
        return;
      }
      if (goalType === 'weekly' && frequency > 7) {
        Alert.alert('Invalid Frequency', 'Weekly goals cannot exceed 7.');
        return;
      }
      if (goalType === 'arbitrary' && startAtMidnight && endAtMidnight) {
        const daysInclusive = dayDiff(startAtMidnight, endAtMidnight) + 1;
        if (frequency > daysInclusive) {
          Alert.alert('Invalid Frequency', `For an arbitrary goal, the maximum is ${daysInclusive} (days in your range).`);
          return;
        }
      }
    }

    setLoading(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      Alert.alert('Auth error', 'Please sign in again.');
      setLoading(false);
      return;
    }

    const userId = session.user.id;

    const payload: any = {
      user_id: userId,
      name: name.trim(),
      description: description.trim(),
      start_date: toLocalYMD(startAtMidnight!),
      end_date:
        goalType === 'arbitrary'
          ? toLocalYMD(endAtMidnight!)
          : isIndefinite
          ? null
          : endDate
          ? toLocalYMD(endAtMidnight!)
          : null,
      created_at: new Date().toISOString(),
      current_streak: 0,
      last_day: null,
      increment: goalType,
      frequency: shouldShowFrequency ? frequency : 1,
      // If you add columns later:
      // goal_type: goalType,
      // is_indefinite: goalType !== 'arbitrary' ? isIndefinite : false,
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
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
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              placeholder="Describe your goal"
              style={[styles.input, styles.textArea]}
              multiline
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>

          {/* Goal Type */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Goal Type</Text>
            <View style={styles.segmentRow}>
              {(['daily', 'weekly', 'arbitrary'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.segmentBtn, goalType === t && styles.segmentBtnActive]}
                  onPress={() => setGoalType(t)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.segmentText, goalType === t && styles.segmentTextActive]}>
                    {t === 'daily' ? 'Daily' : t === 'weekly' ? 'Weekly' : 'Arbitrary'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperNote}>
              {goalType === 'daily' && 'A daily goal resets every day.'}
              {goalType === 'weekly' && 'End date must be N×7−1 days after start (e.g., 6, 13, 20…).'}
              {goalType === 'arbitrary' && 'An arbitrary goal must have a fixed start and end date.'}
            </Text>
          </View>

          {/* Frequency Slider */}
          {shouldShowFrequency && (
            <View style={styles.inputSection}>
              <Text style={styles.label}>How many times? *</Text>
              <Text style={styles.labelDescription}>
                {goalType === 'weekly' && 'Weekly goal: up to 7 times per week.'}
                {goalType === 'arbitrary' && (!startAtMidnight || !endAtMidnight) && 'Pick a Start and End Date to enable the slider.'}
              </Text>

              <View style={[styles.sliderRow, sliderDisabled && { opacity: 0.5 }]}>
                <Slider
                  value={frequency}
                  onValueChange={(val) => setFrequency(Math.round(val))}
                  minimumValue={1}
                  maximumValue={Math.max(1, maxFrequency)}
                  step={1}
                  disabled={sliderDisabled}
                  style={{ flex: 1 }}
                />
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{frequency}</Text>
                </View>
              </View>

              {goalType === 'arbitrary' && startAtMidnight && endAtMidnight && (
                <Text style={styles.helperNote}>
                  Max for your selected range: {maxFrequency}
                </Text>
              )}
            </View>
          )}
          {/* No end date toggle (hidden for arbitrary) */}
            {goalType !== 'arbitrary' && (
              <View style={[styles.inputSection, styles.switchRow]}>
                <Text style={styles.label}>No end date</Text>
                <Switch
                  value={isIndefinite}
                  onValueChange={(v) => {
                    setIsIndefinite(v);
                    if (v) setEndDate(null);
                  }}
                />
              </View>
            )}

          {/* One calendar controls both Start and End (or only Start if indefinite/daily) */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>
              {goalType === 'arbitrary' ? 'Select Start → End' : isIndefinite ? 'Select Start Date' : 'Select Start → End'}
            </Text>
            <View style={styles.calendarWrapper}>
              <Calendar
                onDayPress={onCalendarPress}
                markedDates={markedDates}
                markingType="period"
                enableSwipeMonths
                minDate={toYMD(new Date())}  // 🔒 lock dates before today
                theme={{
                  arrowColor: '#007aff',
                  todayTextColor: '#007aff',
                  selectedDayBackgroundColor: '#007aff',
                  textDayFontWeight: '600',
                  textMonthFontWeight: '700',
                  textDayHeaderFontWeight: '700',
                }}
              />
            </View>
            {goalType === 'weekly' && weeklySnapNote && (
              <Text style={[styles.helperNote, { marginTop: 6 }]}>{weeklySnapNote}</Text>
            )}
            {startDate && (
              <Text style={[styles.helperNote, { marginTop: 6 }]}>
                Start: {toYMD(atMidnight(startDate))}
                {(!isIndefinite || goalType === 'arbitrary') && endDate ? `   •   End: ${toYMD(atMidnight(endDate))}` : ''}
              </Text>
            )}
          </View>

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

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
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
    color: '#111',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  label: { fontWeight: '700', fontSize: 16, color: '#111', marginBottom: 8 },
  labelDescription: { fontSize: 14, color: '#444', marginBottom: 12 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  segmentBtnActive: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
    shadowColor: '#007aff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  segmentText: { fontSize: 14, fontWeight: '700', color: '#111' },
  segmentTextActive: { color: '#fff' },
  helperNote: { marginTop: 8, fontSize: 12, color: '#555' },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: {
    minWidth: 40,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#efefef',
    alignItems: 'center',
  },
  badgeText: { fontSize: 16, fontWeight: '700', color: '#111' },

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

  calendarWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});
