import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
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
  View
} from 'react-native';

// US States list with abbreviations like in ProfileScreen
const US_STATES = [
  { value: '', label: 'Select State' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
];

export default function SignUpScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [state, setState] = useState('');
  const [stateDropdownVisible, setStateDropdownVisible] = useState(false);

  // Helper function to capitalize first letter
  const capitalizeFirstLetter = (str: string) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  // Handle first name change with capitalization
  const handleFirstNameChange = (text: string) => {
    const capitalized = capitalizeFirstLetter(text);
    setFirstName(capitalized);
  };

  // Handle last name change with capitalization
  const handleLastNameChange = (text: string) => {
    const capitalized = capitalizeFirstLetter(text);
    setLastName(capitalized);
  };

  const formatDate = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as MM-DD-YYYY
    if (cleaned.length >= 8) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4, 8)}`;
    } else if (cleaned.length >= 6) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 4)}-${cleaned.slice(4)}`;
    } else if (cleaned.length >= 4) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    } else if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  const handleDateChange = (text: string) => {
    const formatted = formatDate(text);
    setDob(formatted);
  };

  // Get state display name
  const getStateDisplayName = (stateCode: string) => {
    const stateObj = US_STATES.find(s => s.value === stateCode);
    return stateObj ? stateObj.label : 'Select a state...';
  };

  // Handle state selection
  const handleStateSelect = (stateValue: string) => {
    setState(stateValue);
    setStateDropdownVisible(false);
  };

  const handleSignUp = async () => {
    if (!username || !email || !password || !firstName || !lastName || !dob || !state) {
      Alert.alert('Validation Error', 'Please fill all required fields');
      return;
    }

    try {
      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            username,
            first_name: firstName,
            last_name: lastName
          },
        },
      });

      if (signUpError) throw signUpError;

      // 2. If signup successful, create profile record
      if (authData.user) {
        // Create full_name from first and last name
        const fullName = [firstName.trim(), lastName.trim()].filter(name => name.length > 0).join(' ') || null;
        
        const { error: profileError } = await supabase
          .from('profile')
          .insert({
            id: authData.user.id,
            username,
            first_name: firstName,
            last_name: lastName,
            email,
            full_name: fullName,
            dob: dob, // Store date as entered (MM-DD-YYYY format)
            state: state,
            profile_picture: null,
            current_streak: 0,
            goals_completed: 0,
            longest_streak: 0,
            goal_completion_rate: 0.0,
            last_checkin: null,
            is_private: false
          });

        if (profileError) {
          if (profileError.code === '23505' && profileError.message.includes('username')) {
            throw new Error('Username already exists. Please choose a different username.');
          }
          throw profileError;
        }
      }

      Alert.alert(
        'Account Created!',
        `Welcome ${firstName}! Please check your email to verify your account before signing in.`,
        [{ text: 'OK', onPress: () => router.replace('/(auth)/signin') }]
      );

    } catch (error) {
      console.error('Sign up error:', error);
      Alert.alert(
        'Sign Up Failed',
        error instanceof Error ? error.message : 'An unknown error occurred'
      );
    }
  };

  const handleBackToSignIn = () => {
    router.replace('/(auth)/signin');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -50 : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join our community today</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.inputLabel}>Username *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Password *</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
            />

            <View style={styles.nameContainer}>
              <View style={[styles.nameInput, { marginRight: 10 }]}>
                <Text style={styles.inputLabel}>First Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John"
                  placeholderTextColor="#999"
                  value={firstName}
                  onChangeText={handleFirstNameChange}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.nameInput}>
                <Text style={styles.inputLabel}>Last Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={handleLastNameChange}
                  returnKeyType="next"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>Date of Birth (MM-DD-YYYY) *</Text>
            <TextInput
              style={styles.input}
              placeholder="MM-DD-YYYY"
              placeholderTextColor="#999"
              value={dob}
              onChangeText={handleDateChange}
              keyboardType="numeric"
              maxLength={10}
              returnKeyType="next"
            />

            <Text style={styles.inputLabel}>State *</Text>
            <View style={styles.dropdownContainer}>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setStateDropdownVisible(!stateDropdownVisible)}
              >
                <Text style={[styles.dropdownButtonText, !state && styles.placeholderText]}>
                  {getStateDisplayName(state)}
                </Text>
                <Text style={styles.dropdownArrow}>
                  {stateDropdownVisible ? '▲' : '▼'}
                </Text>
              </TouchableOpacity>
              
              {stateDropdownVisible && (
                <View style={styles.dropdownOptions}>
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true}>
                    {US_STATES.map((stateObj) => (
                      <TouchableOpacity
                        key={stateObj.value}
                        style={[
                          styles.dropdownOption,
                          state === stateObj.value && styles.dropdownOptionSelected
                        ]}
                        onPress={() => handleStateSelect(stateObj.value)}
                      >
                        <Text style={[
                          styles.dropdownOptionText,
                          state === stateObj.value && styles.dropdownOptionTextSelected
                        ]}>
                          {stateObj.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
              <Text style={styles.signUpButtonText}>Sign Up</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backButton} onPress={handleBackToSignIn}>
              <Text style={styles.backButtonText}>Already Have an Account?</Text>
            </TouchableOpacity>
          </View>
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
  scrollContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
    paddingBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#444',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#fff',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e3e6',
  },
  nameContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameInput: {
    flex: 1,
  },
  // Custom dropdown styles
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e1e3e6',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  dropdownOptions: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e3e6',
    marginTop: 4,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  dropdownOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dropdownOptionSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  dropdownOptionTextSelected: {
    color: '#0066ff',
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#0066ff',
  },
  backButtonText: {
    color: '#0066ff',
    fontSize: 16,
    fontWeight: '600',
  },
});