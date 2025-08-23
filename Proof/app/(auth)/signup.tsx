import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

declare namespace JSX {
  interface Element extends React.ReactElement<any, any> {}
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}

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
  const [agreed, setAgreed] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [tosModalVisible, setTosModalVisible] = useState(false);
  const [privacyContent, setPrivacyContent] = useState<string>('');
  const [tosContent, setTosContent] = useState<string>('');
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [loadingTos, setLoadingTos] = useState(false);

  // Helper: capitalize first letter
  const capitalizeFirstLetter = (str: string) => {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };
  const handleFirstNameChange = (text: string) => setFirstName(capitalizeFirstLetter(text));
  const handleLastNameChange = (text: string) => setLastName(capitalizeFirstLetter(text));

  // Format input as MM-DD-YYYY for UX
  const formatDate = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
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
  const handleDateChange = (text: string) => setDob(formatDate(text));

  // Convert MM-DD-YYYY → YYYY-MM-DD for DB (DATE)
  const toISODateFromMMDDYYYY = (s: string) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
    if (!m) return null;
    const [_, mm, dd, yyyy] = m;
    // Basic sanity
    const month = Number(mm), day = Number(dd), year = Number(yyyy);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // Construct ISO; Date can further validate
    const iso = `${yyyy}-${mm}-${dd}`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return iso;
  };

  const getStateDisplayName = (stateCode: string) => {
    const stateObj = US_STATES.find(s => s.value === stateCode);
    return stateObj ? stateObj.label : 'Select a state...';
  };
  const handleStateSelect = (stateValue: string) => {
    setState(stateValue);
    setStateDropdownVisible(false);
  };

  useEffect(() => {
    if (privacyModalVisible && !privacyContent) {
      fetchPrivacy();
    }
  }, [privacyModalVisible]);

  useEffect(() => {
    if (tosModalVisible && !tosContent) {
      fetchTos();
    }
  }, [tosModalVisible]);

  const fetchPrivacy = async () => {
    setLoadingPrivacy(true);
    try {
      const privacyResponse = await fetch(
        "https://gist.githubusercontent.com/babikerb/5af2eb0a167f66e6c020016174541cf7/raw"
      );
      const privacyText = await privacyResponse.text();
      setPrivacyContent(privacyText);
    } catch (error) {
      console.error("Error fetching privacy policy:", error);
      Alert.alert("Error", "Failed to load Privacy Policy");
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const fetchTos = async () => {
    setLoadingTos(true);
    try {
      const tosResponse = await fetch(
        "https://gist.githubusercontent.com/babikerb/014985e01ced3341ee89740a4928949b/raw"
      );
      const tosText = await tosResponse.text();
      setTosContent(tosText);
    } catch (error) {
      console.error("Error fetching terms of service:", error);
      Alert.alert("Error", "Failed to load Terms of Service");
    } finally {
      setLoadingTos(false);
    }
  };

  const renderMarkdown = (content: string) => {
    const lines = content.split("\n");
    const elements: JSX.Element[] = [];
    let currentList: JSX.Element[] = [];
    let inList = false;

    lines.forEach((line, index) => {
      line = line.trim();
      if (!line) return;

      if (line.startsWith("# ")) {
        if (inList && currentList.length > 0) {
          elements.push(
            <View key={`list-${index}`} style={styles.listContainer}>
              {currentList}
            </View>
          );
          currentList = [];
          inList = false;
        }
        elements.push(
          <Text key={index} style={styles.policyTitle}>
            {line.replace("# ", "")}
          </Text>
        );
      } else if (line.startsWith("## ")) {
        if (inList && currentList.length > 0) {
          elements.push(
            <View key={`list-${index}`} style={styles.listContainer}>
              {currentList}
            </View>
          );
          currentList = [];
          inList = false;
        }
        elements.push(
          <Text key={index} style={styles.sectionTitle}>
            {line.replace("## ", "")}
          </Text>
        );
      } else if (line.startsWith("**") && line.endsWith("**")) {
        if (inList && currentList.length > 0) {
          elements.push(
            <View key={`list-${index}`} style={styles.listContainer}>
              {currentList}
            </View>
          );
          currentList = [];
          inList = false;
        }
        const text = line.replace(/\*\*/g, "");
        elements.push(
          <Text key={index} style={styles.policyText}>
            {text.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
              if (part.match(/\[.*?\]\(.*?\)/)) {
                const linkText = part.match(/\[(.*?)\]/)?.[1];
                const url = part.match(/\((.*?)\)/)?.[1];
                return (
                  <Text
                    key={`link-${i}`}
                    style={styles.link}
                    onPress={() => url && Linking.openURL(url)}
                  >
                    {linkText}
                  </Text>
                );
              }
              return part;
            })}
          </Text>
        );
      } else if (line.startsWith("- ")) {
        inList = true;
        const text = line.replace("- ", "");
        currentList.push(
          <Text key={index} style={styles.listItem}>
            {text.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
              if (part.match(/\[.*?\]\(.*?\)/)) {
                const linkText = part.match(/\[(.*?)\]/)?.[1];
                const url = part.match(/\((.*?)\)/)?.[1];
                return (
                  <Text
                    key={`link-${i}`}
                    style={styles.link}
                    onPress={() => url && Linking.openURL(url)}
                  >
                    {linkText}
                  </Text>
                );
              }
              return part.replace(/\*\*(.*?)\*\*/g, (_, p1) => p1);
            })}
          </Text>
        );
      } else {
        if (inList && currentList.length > 0) {
          elements.push(
            <View key={`list-${index}`} style={styles.listContainer}>
              {currentList}
            </View>
          );
          currentList = [];
          inList = false;
        }
        elements.push(
          <Text key={index} style={styles.policyText}>
            {line.split(/(\[.*?\]\(.*?\))/g).map((part, i) => {
              if (part.match(/\[.*?\]\(.*?\)/)) {
                const linkText = part.match(/\[(.*?)\]/)?.[1];
                const url = part.match(/\((.*?)\)/)?.[1];
                return (
                  <Text
                    key={`link-${i}`}
                    style={styles.link}
                    onPress={() => url && Linking.openURL(url)}
                  >
                    {linkText}
                  </Text>
                );
              }
              return part.replace(/\*\*(.*?)\*\*/g, (_, p1) => p1);
            })}
          </Text>
        );
      }
    });

    if (inList && currentList.length > 0) {
      elements.push(
        <View key="final-list" style={styles.listContainer}>
          {currentList}
        </View>
      );
    }

    return elements;
  };

  const PrivacyPolicyContent = () => (
    <ScrollView style={styles.policyScroll}>
      {renderMarkdown(privacyContent)}
    </ScrollView>
  );

  const TosContent = () => (
    <ScrollView style={styles.policyScroll}>
      {renderMarkdown(tosContent)}
    </ScrollView>
  );

  const handleSignUp = async () => {
    if (!username || !email || !password || !firstName || !lastName || !dob || !state) {
      Alert.alert('Validation Error', 'Please fill all required fields');
      return;
    }

    if (!agreed) {
      Alert.alert('Agreement Required', 'You must agree to the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    if (dob.length !== 10) {
      Alert.alert('Invalid Date', 'Please enter a valid date in MM-DD-YYYY format.');
      return;
    }

    const [monthStr, dayStr, yearStr] = dob.split('-');
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const year = parseInt(yearStr, 10);

    if (isNaN(month) || isNaN(day) || isNaN(year) || month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2025) {
      Alert.alert('Invalid Date', 'Please enter a valid date in MM-DD-YYYY format.');
      return;
    }

    const birthDate = new Date(year, month - 1, day);
    if (isNaN(birthDate.getTime())) {
      Alert.alert('Invalid Date', 'Please enter a valid date in MM-DD-YYYY format.');
      return;
    }

    const today = new Date(2025, 7, 9); // August 09, 2025
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 13) {
      Alert.alert('Age Requirement', 'You must be at least 13 years old to create an account.');
      return;
    }

    try {
      // Format DOB to YYYY-MM-DD for storage
      const formattedDob = `${year}-${monthStr.padStart(2, '0')}-${dayStr.padStart(2, '0')}`;

      // 1. Create auth user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            first_name: firstName,
            last_name: lastName,
          },
        },
      });
      if (signUpError) throw signUpError;

      // 2) Insert profile row — ONLY columns that exist in your `profile` table
      if (authData.user) {
        const fullName =
          [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || null;

        const payload = {
          id: authData.user.id,
          username,
          first_name: firstName,
          last_name: lastName,
          email,
          full_name: fullName,
          dob: isoDob,            // DATE column expects YYYY-MM-DD
          state: state,           // text (e.g., 'CA')
          profile_picture: null,  // text nullable
          goals_completed: 0,     // int
          longest_streak: 0,      // int
          goal_completion_rate: 0 // numeric
          // created_at/updated_at handled by DB defaults if set
          // expo_push_token can be set later after you register for notifications
        };

        const { error: profileError } = await supabase
          .from('profile')
          .insert({
            id: authData.user.id,
            username,
            first_name: firstName,
            last_name: lastName,
            email,
            full_name: fullName,
            dob: formattedDob,
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
              onChangeText={setDob}
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

            <View style={styles.agreementContainer}>
              <TouchableOpacity
                style={[styles.checkbox, agreed ? styles.checkboxChecked : null]}
                onPress={() => setAgreed(!agreed)}
              >
                {agreed && <Text style={styles.checkboxCheck}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.agreementText}>
                I agree to the{' '}
                <Text
                  style={styles.link}
                  onPress={() => setTosModalVisible(true)}
                >
                  Terms of Service
                </Text>{' '}
                and{' '}
                <Text
                  style={styles.link}
                  onPress={() => setPrivacyModalVisible(true)}
                >
                  Privacy Policy
                </Text>
              </Text>
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

      <Modal
        animationType="slide"
        transparent={false}
        visible={privacyModalVisible}
        onRequestClose={() => setPrivacyModalVisible(false)}
      >
        <View style={styles.policyModalContainer}>
          {loadingPrivacy || !privacyContent ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066ff" />
            </View>
          ) : (
            <PrivacyPolicyContent />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setPrivacyModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        transparent={false}
        visible={tosModalVisible}
        onRequestClose={() => setTosModalVisible(false)}
      >
        <View style={styles.policyModalContainer}>
          {loadingTos || !tosContent ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0066ff" />
            </View>
          ) : (
            <TosContent />
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setTosModalVisible(false)}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#0066ff',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0066ff',
  },
  checkboxCheck: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  agreementText: {
    fontSize: 14,
    color: '#444',
    flex: 1,
  },
  link: {
    color: '#0066ff',
    textDecorationLine: 'underline',
  },
  signUpButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
  policyModalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyScroll: {
    marginTop:48,
    flex: 1,
  },
  policyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 24,
    marginBottom: 12,
  },
  policyText: {
    fontSize: 16,
    color: '#444',
    marginBottom: 12,
    lineHeight: 24,
  },
  listContainer: {
    marginLeft: 20,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 16,
    color: '#444',
    marginBottom: 8,
    lineHeight: 24,
  },
  closeButton: {
    backgroundColor: '#0066ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});