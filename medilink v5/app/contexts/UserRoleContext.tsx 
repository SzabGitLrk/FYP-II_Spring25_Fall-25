import React, { useState, useEffect, createContext, useContext } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/config/firebase';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';

interface UserInfo {
  name?: string;
  email?: string;
  role?: string;
  specialty?: string;
  location?: string;
  available?: boolean;
  schedule?: any;
  coordinates?: any;
  pharmacyName?: string;
  phone?: string;
}

interface UserRoleContextType {
  userRole: string | null;
  userInfo: UserInfo | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  updateUserInfo: (info: UserInfo) => Promise<void>;
}

const UserRoleContext = createContext<UserRoleContextType>({
  userRole: null,
  userInfo: null,
  isLoading: true,
  logout: async () => {},
  updateUserInfo: async () => {},
});

export const UserRoleProvider = ({ children }: { children: React.ReactNode }) => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserData();
    
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await loadUserData();
      } else {
        setUserRole(null);
        setUserInfo(null);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loadUserData = async () => {
    try {
      setIsLoading(true);
      
      const [role, info] = await Promise.all([
        AsyncStorage.getItem('userRole'),
        AsyncStorage.getItem('userInfo'),
      ]);

      if (role) {
        setUserRole(role);
      }

      if (info) {
        setUserInfo(JSON.parse(info));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      await AsyncStorage.multiRemove(['userToken', 'userRole', 'userInfo']);
      setUserRole(null);
      setUserInfo(null);
      router.replace('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const updateUserInfo = async (info: UserInfo) => {
    try {
      setUserInfo(info);
      await AsyncStorage.setItem('userInfo', JSON.stringify(info));
    } catch (error) {
      console.error('Error updating user info:', error);
      throw error;
    }
  };

  return (
    <UserRoleContext.Provider
      value={{
        userRole,
        userInfo,
        isLoading,
        logout,
        updateUserInfo,
      }}
    >
      {children}
    </UserRoleContext.Provider>
  );
};

export const useUserRole = () => {
  const context = useContext(UserRoleContext);
  if (!context) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
};