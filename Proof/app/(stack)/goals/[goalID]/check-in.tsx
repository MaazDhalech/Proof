import { supabase } from '@/services/supabase'; // Adjust path as needed
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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


export default function GoalsPage() {
  
  // State variables from the challenge table
  const params = useLocalSearchParams();
  const challengeName = params.challengeName as string;
  const challengeDescription = params.challengeDescription as string;
  const challengeId = params.id as string;

  // Other state varaibles
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  const textInputRef = useRef<TextInput>(null);
  const router = useRouter();

  useEffect(() => {
    getCameraPermissions();
  }, []);

  const getCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    
    if (status === 'granted') {
      // Automatically open camera when permissions are granted
      takePhoto();
    }
  };

const takePhoto = async () => {
  try {
    setIsLoading(true);

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });

    if (result.canceled) {
      router.push('/goals');
      return;
    }

    if (result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setImageBase64(asset.base64 || null);
    }
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
  } finally {
    setIsLoading(false);
  }
};


  const resetAndRetake = () => {
    setImageUri(null);
    setImageBase64(null);
    setCaption('');
    takePhoto();
  };

const submitToSupabase = async () => {
  if (!imageBase64 || !caption.trim()) {
    Alert.alert('Error', 'Please add a caption before submitting.');
    return;
  }

  try {
    setIsSubmitting(true);

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      Alert.alert('Error', 'You must be logged in to submit a photo.');
      return;
    }

    // Get local date in YYYY-MM-DD format
    const getLocalDate = () => {
      const date = new Date();
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().split('T')[0];
    };

    const localDateString = getLocalDate();

    // 1. First get current challenge data
    const { data: challenge, error: fetchError } = await supabase
      .from('challenges')
      .select('current_streak, total_checkins, last_day, user_id, frequency')
      .eq('id', challengeId)
      .single();

    if (fetchError) throw fetchError;

    // Check if we need to reset streak (from params)
    const shouldResetStreak = params.streakReset === 'true';
    const currentStreak = shouldResetStreak ? 1 : (challenge?.current_streak || 0) + 1;
    const newTotalCheckins = (challenge?.total_checkins || 0) + 1;

    // 2. Get user's profile to check longest_streak and goals_completed
    const { data: profile, error: profileError } = await supabase
      .from('profile')
      .select('longest_streak, goals_completed')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // 3. Update challenge record
    const { error: updateError } = await supabase
      .from('challenges')
      .update({
        last_day: localDateString,
        current_streak: currentStreak,
        total_checkins: newTotalCheckins
      })
      .eq('id', challengeId);

    if (updateError) throw updateError;

    // 4. Check if goal is completed (total_checkins equals frequency)
    const isGoalCompleted = newTotalCheckins === challenge?.frequency;
    
    // 5. Update profile's longest_streak and goals_completed if needed
    const profileUpdates: any = {};
    
    if (currentStreak >= (profile?.longest_streak || 0)) {
      profileUpdates.longest_streak = currentStreak;
    }
    
    if (isGoalCompleted) {
      profileUpdates.goals_completed = (profile?.goals_completed || 0) + 1;
    }
    
    // Only update profile if there are changes
    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileUpdateError } = await supabase
        .from('profile')
        .update(profileUpdates)
        .eq('id', user.id);

      if (profileUpdateError) throw profileUpdateError;
    }

    // 6. Create the proof record
    const { error: insertError } = await supabase
      .from('proof')
      .insert({
        challenge_id: challengeId,
        user_id: user.id,
        picture_url: imageBase64,
        caption: caption.trim(),
        likes: 0,
        reactions: {},
        created_at: new Date().toISOString(),
        verified: false,
        missed_window: false
      });

    if (insertError) throw insertError;

    // Create success message
    let successMessage = 'Your photo has been submitted successfully. ';
    if (shouldResetStreak) {
      successMessage += '(Streak reset to 1)';
    } else if (currentStreak > (profile?.longest_streak || 0)) {
      successMessage += `(New longest streak: ${currentStreak})`;
    }
    if (isGoalCompleted) {
      successMessage += ' 🎉 Goal completed!';
    }

    Alert.alert(
      'Success!', 
      successMessage,
      [{ text: 'OK', onPress: () => router.push('/') }]
    );

  } catch (error) {
    console.error('Error submitting to Supabase:', error);
    Alert.alert('Error', 'Failed to submit your photo. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
};

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Requesting camera permissions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>No access to camera</Text>
          <TouchableOpacity style={styles.button} onPress={getCameraPermissions}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{challengeName}</Text>
          <Text style={styles.headerDescription}>{challengeDescription}</Text>
        </View>

        {/* Main Content */}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Opening camera...</Text>
            </View>
          )}

          {imageUri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            </View>
          )}

          {!imageUri && !isLoading && (
            <View style={styles.centerContent}>
              <TouchableOpacity style={styles.button} onPress={takePhoto}>
                <Text style={styles.buttonText}>Take Photo</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

  {imageUri && (
          <View style={styles.captionInputContainer}>
            <View style={styles.captionInputWrapper}>
              <TextInput
                ref={textInputRef}
                style={styles.captionInput}
                placeholder="Add a caption..."
                placeholderTextColor="#999"
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              {caption.trim() && (
                <TouchableOpacity 
                  style={styles.postButton}
                  onPress={submitToSupabase}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#007AFF" />
                  ) : (
                    <Text style={styles.postButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
  )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 100, // Extra padding to account for caption input
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  analysisOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  analysisText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  responseContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  successContainer: {
    alignItems: 'center',
  },
  successText: {
    fontSize: 18,
    color: '#28a745',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  failureContainer: {
    alignItems: 'center',
  },
  failureText: {
    fontSize: 18,
    color: '#dc3545',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  reasonText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 20,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  retakeButton: {
    backgroundColor: '#6c757d',
    flex: 1,
  },
  submitButton: {
    backgroundColor: '#28a745',
    flex: 1,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 18,
    color: '#dc3545',
    marginBottom: 20,
    textAlign: 'center',
  },
  // Instagram-style caption input at bottom
  captionInputContainer: {
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  captionInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f8f8f8',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 40,
  },
  captionInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingVertical: 8,
    paddingRight: 10,
    color: '#333',
  },
  postButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginLeft: 8,
  },
  postButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});