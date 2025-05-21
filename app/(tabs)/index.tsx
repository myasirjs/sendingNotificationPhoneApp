import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { useAuth } from '@/app/context/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const { width, height } = Dimensions.get('window');
// Calculate responsive sizes
const scale = Math.min(width, height) / 375; // 375 is standard iPhone width
const normalize = (size: number) => Math.round(scale * size);

export default function HomeScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  const { logOut, user } = useAuth();

  // Check authentication and redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
    }
  }, [user]);

  // If still checking auth state, show loading
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      alert('Please fill in both title and message fields');
      return;
    }

    setIsSending(true);
    try {
      console.log('Submitted:', { title, description });
      // Handle the submission here
      
      // Clear the inputs after sending
      setTitle('');
      setDescription('');
      alert('Message sent successfully!');
    } catch (error: any) {
      alert('Failed to send message: ' + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logOut();
      router.replace('/auth/login');
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleNotification = () => {
    // Handle notification click
    console.log('Notification clicked');
  };

  return (
    <ThemedView style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <ThemedText style={styles.heading}>Send Message</ThemedText>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={handleNotification}
              activeOpacity={0.7}
            >
              <Ionicons name="notifications-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.iconButton, styles.logoutButton]} 
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Form Section */}
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Title</ThemedText>
          <View style={[
            styles.inputWrapper,
            focusedInput === 'title' && styles.inputWrapperFocused
          ]}>
            <TextInput
              style={styles.input}
              placeholder="Enter a clear and concise title"
              value={title}
              onChangeText={setTitle}
              placeholderTextColor="#999"
              editable={!isSending}
              onFocus={() => setFocusedInput('title')}
              onBlur={() => setFocusedInput('')}
            />
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <ThemedText style={styles.label}>Message</ThemedText>
          <View style={[
            styles.inputWrapper,
            styles.descriptionWrapper,
            focusedInput === 'description' && styles.inputWrapperFocused
          ]}>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder="Enter your message here..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
              textAlignVertical="top"
              editable={!isSending}
              onFocus={() => setFocusedInput('description')}
              onBlur={() => setFocusedInput('')}
            />
          </View>
        </View>
        
        <TouchableOpacity 
          style={[styles.button, isSending && styles.buttonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="send" size={24} color="#fff" style={styles.buttonIcon} />
              <ThemedText style={styles.buttonText}>Send Message</ThemedText>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#2563eb',
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  iconButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoutButton: {
    marginLeft: 12,
  },
  formContainer: {
    flex: 1,
    padding: 20,
    paddingTop: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1a1a1a',
    marginLeft: 4,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 2,
  },
  inputWrapperFocused: {
    borderColor: '#2563eb',
    backgroundColor: '#fff',
    shadowOpacity: 0.1,
    shadowRadius: 4.65,
    elevation: 3,
  },
  input: {
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#1a1a1a',
  },
  descriptionWrapper: {
    height: 150,
  },
  descriptionInput: {
    height: '100%',
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#2563eb',
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    shadowColor: '#2563eb',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
