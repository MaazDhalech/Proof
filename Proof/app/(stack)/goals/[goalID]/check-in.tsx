import { letta_client } from '@/services/letta';
import { supabase } from '@/services/supabase'; // Adjust path as needed
import { Camera } from 'expo-camera';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

const {
  LETTA_IMAGE_VERIFIER_MODEL,
} = Constants.expoConfig?.extra || {};

interface LettaResponse {
  score: number;
  reason: string;
}

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
  const [lettaResponse, setLettaResponse] = useState<LettaResponse | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
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

      if (asset.base64) {
        await analyzeLetta(asset.base64);
      }
    }
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
  } finally {
    setIsLoading(false);
  }
};


  const analyzeLetta = async (base64Image: string) => {
    try {
      setIsAnalyzing(true);

      // Now analyze with Letta using the URL
      console.log('base64:', base64Image);

      const response = await letta_client.agents.messages.create(LETTA_IMAGE_VERIFIER_MODEL, {
        messages: [{
          role: "user",
          content: [{
            type: "text",
            text: `${challengeName}. Description: ${challengeDescription}`
          },
          {
            type: "image",
            source: {
              mediaType: "image/jpeg",
              data: base64Image,
              type: "base64"
            }
          }
        ]
        }]
      });


      console.log('Letta response:', response);
      // Extract the response content from Letta response structure
      let responseText = '';
      
      if (response && 'messages' in response && Array.isArray(response.messages)) {
        // First try to find generate_final_response tool return message
        let finalResponseMessage = response.messages.find(
          (msg: any) => msg.messageType === 'tool_return_message' && 
          msg.name === 'generate_final_response' && 
          msg.toolReturn
        );
        
        if (finalResponseMessage && finalResponseMessage.toolReturn) {
          responseText = finalResponseMessage.toolReturn;
        } else {
          // Fallback: try to find assistant_message
          let assistantMessage = response.messages.find(
            (msg: any) => msg.messageType === 'assistant_message' && msg.content
          );
          
          if (assistantMessage && assistantMessage.content) {
            responseText = assistantMessage.content;
          } else {
            // Last fallback: look for any tool_return_message
            const toolReturnMessage = response.messages.find(
              (msg: any) => msg.messageType === 'tool_return_message' && msg.toolReturn
            );
            
            if (toolReturnMessage && toolReturnMessage.toolReturn) {
              responseText = toolReturnMessage.toolReturn;
            }
          }
        }
      }
      
      if (!responseText) {
        throw new Error('No valid response message found');
      }
      
      // Parse JSON from the response
      let data: LettaResponse;
      try {
        // First try to parse the response as direct JSON
        if (responseText.trim().startsWith('{')) {
          data = JSON.parse(responseText);
        } else {
          // If not direct JSON, try to extract JSON from the response text
          const jsonMatch = responseText.match(/\{[^}]*"score"[^}]*\}/);
          if (jsonMatch) {
            data = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
        }

      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        // Fallback response if parsing fails
        data = {
          score: 1,
          reason: "Unable to analyze the image properly. Please try again with a clearer photo."
        };
      }

      setLettaResponse(data);
      console.log('Letta response:', data);
      
    } catch (error) {
      console.error('Error analyzing image with Letta:', error);
      Alert.alert(
        'Analysis Error', 
        'Failed to analyze the image. Please try again.',
        [
          { text: 'Take New Photo', onPress: resetAndRetake }
        ]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAndRetake = () => {
    setImageUri(null);
    setImageBase64(null);
    setLettaResponse(null);
    setCaption('');
    takePhoto();
  };

  const submitToSupabase = async () => {
    if (!imageBase64 || !lettaResponse || !caption.trim()) {
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

      // Insert into Supabase
      const { error } = await supabase
        .from('proof')
        .insert({
          // id will be auto-generated
          challenge_id: challengeId, // Set this based on your app logic
          user_id: user.id,
          picture_url: imageBase64, // Store as base64 data URL
          caption: caption.trim(),
          likes: 0,
          reactions: {},
          created_at: new Date().toISOString(),
          verified: true,
          missed_window: false
        });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Success!', 
        'Your photo has been submitted successfully.',
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
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {isLoading && (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Opening camera...</Text>
            </View>
          )}

          {imageUri && (
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              
              {isAnalyzing && (
                <View style={styles.analysisOverlay}>
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.analysisText}>Analyzing image...</Text>
                </View>
              )}
            </View>
          )}

          {lettaResponse && (
            <View style={styles.responseContainer}>
              <Text style={styles.scoreText}>
                Score: {lettaResponse.score}/10
              </Text>
              
              {lettaResponse.score >= 7 ? (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>✅ Great photo!</Text>
                  <Text style={styles.reasonText}>{lettaResponse.reason}</Text>
                  
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption... (required)"
                    placeholderTextColor= "grey"
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={500}
                  />
                  
                  <View style={styles.buttonContainer}>
                    <TouchableOpacity 
                      style={[styles.button, styles.retakeButton]} 
                      onPress={resetAndRetake}
                      disabled={isSubmitting}
                    >
                      <Text style={styles.buttonText}>Retake Photo</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.button, styles.submitButton]} 
                      onPress={submitToSupabase}
                      disabled={isSubmitting || !caption.trim()}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.buttonText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.failureContainer}>
                  <Text style={styles.failureText}>❌ Photo needs improvement</Text>
                  <Text style={styles.reasonText}>{lettaResponse.reason}</Text>
                  
                  <TouchableOpacity 
                    style={[styles.button, styles.retakeButton]} 
                    onPress={resetAndRetake}
                  >
                    <Text style={styles.buttonText}>Take Another Photo</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  scrollContent: {
    flexGrow: 1,
    padding: 20,
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
  captionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    width: '100%',
    textAlignVertical: 'top',
    marginBottom: 20,
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
});