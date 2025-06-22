import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function CreateScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [camera, setCamera] = useState<any>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<string>('');
  const [caption, setCaption] = useState('');

  // TODO: Replace with real goals from backend
  const mockGoals = ['Go to the gym', 'Read daily', 'Eat healthy'];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Log Progress</Text>

      {/* Goal Selector */}
      <Text style={styles.label}>Select Goal:</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={selectedGoal}
          onValueChange={(itemValue) => setSelectedGoal(itemValue)}
          style={styles.picker}
        >
          <Picker.Item label="Choose a goal..." value="" />
          {mockGoals.map((goal, idx) => (
            <Picker.Item label={goal} value={goal} key={idx} />
          ))}
        </Picker>
      </View>

      {/* Camera Preview or Captured Image */}
      <View style={styles.cameraContainer}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.preview} />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <Feather name="camera" size={48} color="#aaa" />
            <Text style={styles.cameraText}>Camera Preview</Text>
          </View>
        )}
      </View>

      {/* Retake / Confirm Buttons (Placeholders) */}
      {photo ? (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.buttonSecondary}
            onPress={() => setPhoto(null)}
          >
            <Text style={styles.buttonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonPrimary}>
            <Text style={styles.buttonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={() => {
            // simulate photo capture
            setPhoto('https://via.placeholder.com/300x400.png?text=Proof+Photo');
          }}
        >
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
      )}

      {/* Optional Caption Input */}
      <Text style={styles.label}>Caption (optional):</Text>
      <TextInput
        placeholder="Write something..."
        value={caption}
        onChangeText={setCaption}
        style={styles.input}
      />

      {/* Submit Button (does nothing yet) */}
      <TouchableOpacity style={styles.buttonSubmit}>
        <Text style={styles.buttonText}>Submit Check-In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 10,
  },
  pickerWrapper: {
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    marginVertical: 5,
  },
  picker: {
    height: Platform.OS === 'ios' ? 160 : 50,
    width: '100%',
  },
  cameraContainer: {
    height: 280,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 15,
  },
  cameraPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    color: '#aaa',
    marginTop: 10,
  },
  preview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  input: {
    backgroundColor: '#f1f1f1',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginVertical: 10,
  },
  buttonPrimary: {
    backgroundColor: '#007aff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  buttonSecondary: {
    backgroundColor: '#ccc',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  buttonSubmit: {
    backgroundColor: '#28c76f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
