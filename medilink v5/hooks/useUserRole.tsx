import { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserInfo {
  uid: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'pharmacist';
  specialty?: string;
  location?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  available?: boolean;
  schedule?: any;
  createdAt?: string;
  updatedAt?: string;
}

export function useUserRole() {
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | 'pharmacist' | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        
        const unsubscribeFirestore = onSnapshot(userDocRef, (docSnapshot) => {
          if (docSnapshot.exists()) {
            const userData = docSnapshot.data() as UserInfo;
            setUserInfo(userData);
            setUserRole(userData.role);
            
            AsyncStorage.setItem('userInfo', JSON.stringify(userData));
            AsyncStorage.setItem('userRole', userData.role);
          }
          setIsLoading(false);
        });

        return unsubscribeFirestore;
      } else {
        setUserRole(null);
        setUserInfo(null);
        setIsLoading(false);
        AsyncStorage.removeItem('userInfo');
        AsyncStorage.removeItem('userRole');
      }
    });

    return unsubscribeAuth;
  }, []);

  const logout = async () => {
    try {
      await auth.signOut();
      setUserRole(null);
      setUserInfo(null);
      await AsyncStorage.removeItem('userInfo');
      await AsyncStorage.removeItem('userRole');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return {
    userRole,
    userInfo,
    isLoading,
    logout,
  };
}