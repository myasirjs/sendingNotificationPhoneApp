import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';

// Configure notification handler with proper settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

// Function to handle web notifications
async function sendWebNotification(title: string, body: string, data: any = {}) {
  if (!('Notification' in window)) {
    console.log('This browser does not support desktop notification');
    return null;
  }

  try {
    const permission = await window.Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Creating web notification with:', { title, body, data });
      const notification = new window.Notification(title, {
        body: body,
        icon: '/assets/images/favicon.png',
        requireInteraction: true, // Notification will persist until user interacts
        tag: `message-${Date.now()}`, // Unique tag for each notification
        badge: '/assets/images/favicon.png', // Add badge icon for web notifications
        data: data, // Add data to notification
      });

      notification.onclick = function() {
        window.focus();
        if (data.type === 'message') {
          // You can handle specific actions based on notification type
          console.log('Message notification clicked:', data);
        }
        notification.close();
      };

      return { status: 'success', platform: 'web' };
    } else {
      console.log('Permission denied for notification');
      return null;
    }
  } catch (err) {
    console.error('Error showing notification:', err);
    return null;
  }
}

// Function to register for push notifications
export async function registerForPushNotificationsAsync() {
  let token;
  console.log('Starting push notification registration...');

  if (Platform.OS === 'web') {
    try {
      const permission = await window.Notification.requestPermission();
      console.log('Web notification permission:', permission);
      if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
      }
      // Generate a unique token for web users
      token = `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Generated web token:', token);
    } catch (error) {
      console.error('Error setting up web notifications:', error);
      return null;
    }
  } else {
    if (Platform.OS === 'android') {
      console.log('Setting up Android notification channel...');
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          enableVibrate: true,
          enableLights: true,
          showBadge: true,
        });
        console.log('Android notification channel set up successfully');
      } catch (error) {
        console.error('Error setting up Android channel:', error);
      }
    }

    if (Device.isDevice) {
      console.log('Checking notification permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      console.log('Existing permission status:', existingStatus);
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        console.log('Requesting notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('New permission status:', finalStatus);
      }
      if (finalStatus !== 'granted') {
        console.error('Failed to get push notification permissions');
        alert('Failed to get push token for push notification!');
        return null;
      }

      try {
        console.log('Getting Expo push token...');
        const projectId = Constants?.expoConfig?.extra?.eas?.projectId;
        console.log('Project ID:', projectId);
        token = (await Notifications.getExpoPushTokenAsync({
          projectId: projectId || 'sendingnotification-e08c8',
        })).data;
        console.log('Successfully got push token:', token);
      } catch (e) {
        console.error('Error getting push token:', e);
        return null;
      }
    } else {
      console.warn('Must use physical device for Push Notifications');
    }
  }

  return token;
}

// Function to schedule a local notification
export async function scheduleLocalNotification(title: string, body: string, data: any = {}) {
  try {
    if (Platform.OS === 'web') {
      return await sendWebNotification(title, body);
    }

    // Only proceed with Expo notifications on mobile platforms
    if (!Device.isDevice && !__DEV__) {
      console.warn('Must use physical device for Push Notifications');
      return;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        badge: 1,
      },
      trigger: {
        seconds: 1,
        channelId: 'default',
      },
    });
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

// Function to save token to Firebase
export async function saveTokenToFirebase(userId: string, token: string) {
  if (!token) {
    console.error('No token provided to save to Firebase');
    return;
  }

  try {
    console.log('Saving token to Firebase for user:', userId);
    console.log('Token to save:', token);
    
    const tokenData = {
      token,
      updatedAt: new Date().toISOString(),
      platform: Platform.OS,
      deviceName: Device.deviceName || 'Unknown Device',
      deviceType: Device.deviceType || 'Unknown Type',
      isDevelopment: __DEV__,
    };
    
    console.log('Token data to save:', tokenData);
    
    await setDoc(doc(db, 'userTokens', userId), tokenData, { merge: true });
    console.log('Token successfully saved to Firebase');
  } catch (error) {
    console.error('Error saving token to Firebase:', error);
    throw error;
  }
}

// Function to send push notification
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
  try {
    console.log('Sending push notification:', { expoPushToken, title, body, data });
    
    if (Platform.OS === 'web') {
      // Check if the token is a web token
      if (expoPushToken.startsWith('web-')) {
        console.log('Sending web notification');
        return await sendWebNotification(title, body, data);
      }
      return null;
    }

    // Skip if token is invalid or is a web token
    if (!expoPushToken || expoPushToken.startsWith('web-')) {
      console.log('Invalid or web token, skipping notification:', expoPushToken);
      return null;
    }

    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: {
        ...data,
        experienceId: '@anonymous/tasksendingNotification',
        scopeKey: '@anonymous/tasksendingNotification',
      },
      badge: data.unreadCount || 1,
      priority: 'high',
      channelId: 'default',
      _displayInForeground: true,
      ttl: 3600, // Time to live: 1 hour
      sticky: true, // Make notification persistent
      mutableContent: true, // Allow modification of notification content
    };

    console.log('Sending notification to:', expoPushToken);
    console.log('Message:', message);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseText = await response.text();
    console.log('Response text:', responseText);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('Error parsing response:', e);
      result = { raw: responseText };
    }

    console.log('Successfully sent notification:', result);
    return result;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
} 