import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Button, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function SignInScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

const handleSignIn = async () => {
  const email = identifier;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message === 'Email not confirmed') {
      Alert.alert('Email not verified', 'Please verify your email before signing in.');
    } else {
      Alert.alert('Error', error.message);
    }
    return;
  }

  router.replace('/');
};

  const goToSignUp = () => {
    router.push('/(auth)/signup');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#666"
        value={identifier}
        onChangeText={setIdentifier}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#666"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Sign In" onPress={handleSignIn} />
      <TouchableOpacity onPress={goToSignUp} style={styles.signupButton}>
        <Text style={styles.signupText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f5f5f5',
    color: '#000',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 15,
    fontSize: 16,
  },
  signupButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  signupText: {
    color: '#007AFF',
    fontSize: 16,
  },
});
