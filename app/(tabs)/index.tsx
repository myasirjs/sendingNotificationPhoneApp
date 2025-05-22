import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { db } from '@/app/config/firebase';
import { useAuth } from '@/app/context/AuthContext';
import { registerForPushNotificationsAsync, saveTokenToFirebase, sendPushNotification } from '@/app/utils/notifications';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

const { width, height } = Dimensions.get('window');
// Calculate responsive sizes
const scale = Math.min(width, height) / 375; // 375 is standard iPhone width
const normalize = (size: number) => Math.round(scale * size);

interface NotificationData {
  type?: string;
  senderId?: string;
  senderName?: string;
  timestamp?: string;
  messageTitle?: string;
  messageBody?: string;
}

interface UserNotification {
  title: string;
  body: string;
  senderName: string;
  timestamp: string;
  messageTitle?: string;
  read: boolean;
}

interface NotificationItem extends UserNotification {
  id: string;
}

interface UserNotificationCount {
  unreadCount: number;
  lastUpdated: string;
}

export default function HomeScreen() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [focusedInput, setFocusedInput] = useState('');
  const { logOut, user } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Update unread count when new notifications arrive
  useEffect(() => {
    setUnreadCount(notifications.length);
  }, [notifications]);

  // Add function to update notification count in Firebase
  const updateNotificationCount = async (userId: string, increment: number) => {
    try {
      const userCountRef = doc(db, 'userNotifications', userId);
      const docSnap = await getDoc(userCountRef);

      if (!docSnap.exists()) {
        // Create the document if it doesn't exist
        await setDoc(userCountRef, {
          unreadCount: increment,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Update existing document
        await updateDoc(userCountRef, {
          unreadCount: increment,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error updating notification count:', error);
    }
  };

  // Add function to initialize notification count document
  const initializeNotificationCount = async (userId: string) => {
    try {
      const userCountRef = doc(db, 'userNotifications', userId);
      const docSnap = await getDoc(userCountRef);
      
      if (!docSnap.exists()) {
        // Create initial document with count 0
        await setDoc(userCountRef, {
          unreadCount: 0,
          lastUpdated: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error initializing notification count:', error);
    }
  };

  // Update useEffect to handle notification counts
  useEffect(() => {
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    const setupNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        setExpoPushToken(token);
        try {
          await saveTokenToFirebase(user.uid, token);
          await initializeNotificationCount(user.uid);
        } catch (error) {
          console.error('Error in setup:', error);
        }
      }

      // Configure notification settings for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Get initial unread count
      try {
        const userCountRef = doc(db, 'userNotifications', user.uid);
        const docSnap = await getDoc(userCountRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserNotificationCount;
          setGlobalUnreadCount(data.unreadCount);
          setUnreadCount(data.unreadCount);
          if (Platform.OS !== 'web') {
            await Notifications.setBadgeCountAsync(data.unreadCount);
          }
        }
      } catch (error) {
        console.error('Error getting initial count:', error);
      }
    };

    setupNotifications();

    // Set up real-time listener for notification count updates
    const unsubscribe = onSnapshot(doc(db, 'userNotifications', user.uid), 
      (doc) => {
        if (doc.exists()) {
          const data = doc.data() as UserNotificationCount;
          setGlobalUnreadCount(data.unreadCount);
          setUnreadCount(data.unreadCount);
          if (Platform.OS !== 'web') {
            Notifications.setBadgeCountAsync(data.unreadCount);
          }
        }
      }
    );

    // Only set up Expo notification listeners for mobile platforms
    if (Platform.OS !== 'web') {
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        const notificationData = notification.request.content.data as NotificationData;
        const newNotification: NotificationItem = {
          title: notification.request.content.title ?? '',
          body: notification.request.content.body ?? '',
          senderName: typeof notificationData?.senderName === 'string' ? notificationData.senderName : 'Unknown Sender',
          timestamp: new Date().toLocaleString(),
          messageTitle: notificationData?.messageTitle,
          read: false,
          id: Date.now().toString(),
        };
        setNotifications(prev => [newNotification, ...prev]);
        updateNotificationCount(user.uid, globalUnreadCount + 1);
      });

      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        setShowNotifications(true);
      });
    }

    return () => {
      if (Platform.OS !== 'web') {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      }
      unsubscribe();
    };
  }, [user]);

  const handleCloseNotifications = async () => {
    setShowNotifications(false);
    if (user) {
      await updateNotificationCount(user.uid, 0);
      setUnreadCount(0);
      if (Platform.OS !== 'web') {
        await Notifications.setBadgeCountAsync(0);
      }
    }
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const handleLogout = async () => {
    try {
      await logOut();
      setNotifications([]); // Clear notifications on logout
      setUnreadCount(0); // Reset counter on logout
      router.replace('/auth/login');
    } catch (error: any) {
      console.error('Logout error:', error);
    }
  };

  // Show loading state
  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      console.log('Title or description is empty');
      return;
    }

    setIsSending(true);
    try {
      console.log('Getting user tokens from Firebase...');
      const tokensSnapshot = await getDocs(collection(db, 'userTokens'));
      const tokens = tokensSnapshot.docs
        .filter(doc => {
          const isCurrentUser = doc.id === user?.uid;
          console.log('Checking token document:', doc.id, 'isCurrentUser:', isCurrentUser);
          return !isCurrentUser;
        })
        .map(doc => {
          const data = doc.data();
          console.log('Token document data:', doc.id, data);
          return { 
            token: data.token, 
            platform: data.platform,
            userId: doc.id 
          };
        })
        .filter(tokenData => {
          // Accept both web tokens and Expo tokens
          const isValid = tokenData.token && 
            ((tokenData.platform === 'web' && tokenData.token.startsWith('web-')) || 
             (tokenData.platform !== 'web' && !tokenData.token.startsWith('web-')));
          console.log('Checking token validity:', tokenData, 'isValid:', isValid);
          return isValid;
        });

      console.log('Found valid tokens:', tokens);

      if (tokens.length === 0) {
        console.log('No valid tokens found to send notifications to');
        setIsSending(false);
        return;
      }

      // Initialize notification documents for all recipients first
      console.log('Initializing notification counts for recipients...');
      await Promise.all(tokens.map(tokenData => initializeNotificationCount(tokenData.userId)));

      // Send notifications
      console.log('Starting to send notifications...');
      const sendPromises = tokens.map(async tokenData => {
        console.log('Preparing to send to token:', tokenData);
        try {
          // Get recipient's current notification count
          const recipientCountRef = doc(db, 'userNotifications', tokenData.userId);
          const recipientCountSnap = await getDoc(recipientCountRef);
          const currentCount = recipientCountSnap.exists() ? 
            (recipientCountSnap.data() as UserNotificationCount).unreadCount : 0;

          const notificationData = {
            type: 'message',
            senderId: user?.uid,
            senderName: user?.email,
            timestamp: new Date().toISOString(),
            messageTitle: title,
            messageBody: description,
            unreadCount: currentCount + 1,
          };
          console.log('Notification data:', notificationData);
          
          const result = await sendPushNotification(tokenData.token, title, description, notificationData);
          console.log('Send result for token:', tokenData, result);
          return { result, userId: tokenData.userId };
        } catch (error) {
          console.error('Error sending to token:', tokenData, error);
          return null;
        }
      });

      // Wait for all notifications to be sent
      console.log('Waiting for all notifications to be sent...');
      const results = await Promise.all(sendPromises);
      console.log('All notification results:', results);

      // Update counts for successful sends
      const successfulSends = results.filter(result => result !== null);
      console.log('Successful sends:', successfulSends.length);
      
      if (successfulSends.length > 0) {
        // Update notification count for each recipient
        console.log('Updating notification counts for recipients...');
        await Promise.all(successfulSends.map(async send => {
          if (send && send.userId) {
            try {
              const recipientCountRef = doc(db, 'userNotifications', send.userId);
              const recipientCountSnap = await getDoc(recipientCountRef);
              const currentCount = recipientCountSnap.exists() ? 
                (recipientCountSnap.data() as UserNotificationCount).unreadCount : 0;
              
              await updateNotificationCount(send.userId, currentCount + 1);
              console.log('Updated count for recipient:', send.userId);
            } catch (error) {
              console.error('Error updating recipient count:', error);
            }
          }
        }));

        // Add sent message to notifications list
        const newNotification: NotificationItem = {
          title: 'Message Sent',
          body: description,
          senderName: user?.email || 'You',
          timestamp: new Date().toLocaleString(),
          messageTitle: title,
          read: false,
          id: Date.now().toString(),
        };
        console.log('Adding new notification to list:', newNotification);
        setNotifications(prev => [newNotification, ...prev]);

        // Send confirmation notification
        if (Platform.OS === 'web') {
          if ('Notification' in window) {
            console.log('Sending web confirmation notification...');
            const permission = await window.Notification.requestPermission();
            if (permission === 'granted') {
              new window.Notification('Message Sent', {
                body: `Your message "${title}" has been sent to ${successfulSends.length} users`,
                icon: '/assets/images/favicon.png',
                requireInteraction: true,
                tag: `confirmation-${Date.now()}`,
              });
            }
          }
        } else {
          console.log('Sending mobile confirmation notification...');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Message Sent',
              body: `Your message "${title}" has been sent to ${successfulSends.length} users`,
              data: {
                type: 'confirmation',
                messageTitle: title,
                messageBody: description,
                senderName: user?.email || 'You',
              },
              badge: unreadCount + 1,
            },
            trigger: null,
          });
        }

        console.log('Clearing input fields...');
        setTitle('');
        setDescription('');
      } else {
        console.log('No successful sends, not clearing inputs');
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleNotification = () => {
    setShowNotifications(true);
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
              onPress={() => setShowNotifications(true)}
              activeOpacity={0.7}
            >
              <View style={styles.notificationContainer}>
                <Ionicons name="notifications-outline" size={24} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <ThemedText style={styles.badgeText}>{unreadCount}</ThemedText>
                  </View>
                )}
              </View>
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

      {/* Notifications Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showNotifications}
        onRequestClose={handleCloseNotifications}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>Notifications</ThemedText>
                <ThemedText style={styles.notificationCount}>
                  {notifications.length} {notifications.length === 1 ? 'notification' : 'notifications'}
                </ThemedText>
              </View>
              <View style={styles.modalHeaderButtons}>
                {notifications.length > 0 && (
                  <TouchableOpacity 
                    onPress={clearNotifications}
                    style={[styles.iconButton, styles.clearButton]}
                  >
                    <Ionicons name="trash-outline" size={20} color="#666" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={handleCloseNotifications}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.notificationsList}>
              {notifications.length === 0 ? (
                <ThemedText style={styles.noNotifications}>No notifications yet</ThemedText>
              ) : (
                notifications.map((notification) => (
                  <View 
                    key={notification.id} 
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.unreadNotification
                    ]}
                  >
                    <View style={styles.notificationHeader}>
                      <ThemedText style={styles.senderName}>From: {notification.senderName}</ThemedText>
                      <ThemedText style={styles.notificationTime}>
                        {new Date(notification.timestamp).toLocaleString()}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.notificationTitle}>{notification.messageTitle || notification.title}</ThemedText>
                    <ThemedText style={styles.notificationBody}>{notification.body}</ThemedText>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    }),
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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 3.84,
      elevation: 2,
    }),
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
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 4px 6px rgba(37,99,235,0.3)'
    } : {
      shadowColor: '#2563eb',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 5,
    }),
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
  notificationContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -6,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    minHeight: height * 0.7,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notificationCount: {
    fontSize: 14,
    color: '#666',
  },
  closeButton: {
    padding: 5,
  },
  notificationsList: {
    flex: 1,
  },
  notificationItem: {
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    } : {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    }),
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  notificationTime: {
    fontSize: 12,
    color: '#666',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  notificationBody: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 20,
  },
  noNotifications: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
    fontSize: 16,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearButton: {
    marginRight: 10,
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 8,
  },
  unreadNotification: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 4,
    borderLeftColor: '#2563eb',
  },
});
