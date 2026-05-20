import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Switch, Alert } from 'react-native';
import { User, LogOut, Settings, Bell, Shield, CircleHelp as HelpCircle, Home } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useUserRole } from '@/hooks/useUserRole';
import Header from '@/components/common/Header';
import { auth } from '@/config/firebase';
import { signOut } from 'firebase/auth';

export default function ProfileScreen() {
  const { userRole, userInfo } = useUserRole();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const performLogout = async () => {
    try {
      // Sign out from Firebase
      await signOut(auth);
      
      // Clear AsyncStorage
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userRole');
      await AsyncStorage.removeItem('userInfo');
      
      // Navigate to login screen
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const goToHome = () => {
    router.replace('/(tabs)');
  };

  const getProfilePicturePlaceholder = () => {
    return '';
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Profile" 
        showBack={true}
      
      />
      <ScrollView style={styles.scrollView}>
        <View style={styles.profileHeader}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{ uri: getProfilePicturePlaceholder() }}
              style={styles.profileImage}
            />
          </View>
          <Text style={styles.userName}>{userInfo?.name || 'User Name'}</Text>
          <Text style={styles.userRole}>
            {userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : ''}
          </Text>
          <Text style={styles.userEmail}>{userInfo?.email || 'user@example.com'}</Text>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={goToHome}>
            <Home size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Go to Home</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <User size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Edit Profile</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <Settings size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Preferences</Text>
          </TouchableOpacity>
          
          <View style={styles.menuItem}>
            <Bell size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#D1D1D1', true: '#9ED0FF' }}
              thumbColor={notificationsEnabled ? '#0073CC' : '#F4F3F4'}
              style={styles.switch}
            />
          </View>
          
          <TouchableOpacity style={styles.menuItem}>
            <Shield size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Privacy & Security</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          <TouchableOpacity style={styles.menuItem}>
            <HelpCircle size={22} color="#0073CC" />
            <Text style={styles.menuItemText}>Help & FAQ</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <LogOut size={22} color="#E53935" />
            <Text style={[styles.menuItemText, styles.logoutText]}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Medilink v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileImageContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#0073CC',
    backgroundColor: '#E6EEF8', // Fallback background
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  userRole: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
    marginVertical: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#424242',
    marginLeft: 12,
    flex: 1,
  },
  logoutText: {
    color: '#E53935',
  },
  switch: {
    marginLeft: 'auto',
  },
  versionContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#9E9E9E',
  },
});