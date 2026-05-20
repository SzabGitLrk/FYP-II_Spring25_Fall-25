import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'pharmacist'>('patient');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    // Reset error message
    setErrorMessage('');

    // Validation
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }

    if (!email.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔐 Attempting login...');
      
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('✅ Firebase Auth successful:', user.uid);

      // Get user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('📄 User data found:', userData.role);
        
        // Check if selected role matches actual role
        if (userData.role !== selectedRole) {
          setErrorMessage(`Please login as ${userData.role}`);
          await auth.signOut();
          return;
        }

        // Store user info in AsyncStorage
        await AsyncStorage.setItem('userToken', user.uid);
        await AsyncStorage.setItem('userRole', userData.role);
        await AsyncStorage.setItem('userInfo', JSON.stringify(userData));
        
        console.log('💾 User data stored, navigating to home...');
        
        // Navigate to the main app
        router.replace('/(tabs)');
      } else {
        console.log('❌ User document not found in Firestore');
        setErrorMessage('User account not found. Please register first.');
        await auth.signOut();
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      
      // Detailed error handling
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          setErrorMessage('Invalid email or password');
          break;
        case 'auth/user-not-found':
          setErrorMessage('No account found with this email');
          break;
        case 'auth/invalid-email':
          setErrorMessage('Invalid email address format');
          break;
        case 'auth/too-many-requests':
          setErrorMessage('Too many login attempts. Please try again later.');
          break;
        case 'auth/network-request-failed':
          setErrorMessage('Network error. Please check your internet connection.');
          break;
        case 'auth/user-disabled':
          setErrorMessage('This account has been disabled.');
          break;
        default:
          setErrorMessage('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToRegister = () => {
    console.log('🔄 Navigating to register screen...');
    router.push('/auth/register');
  };

  const handleBack = () => {
    console.log('⬅️ Going back...');
    router.back();
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot Password',
      'Please contact support to reset your password.',
      [{ text: 'OK' }]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          disabled={isLoading}
        >
          <ArrowLeft size={24} color="#212121" />
        </TouchableOpacity>

        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={{ uri: 'https://images.pexels.com/photos/4021775/pexels-photo-4021775.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2' }}
            style={styles.logoImage}
          />
          <Text style={styles.logoText}>Medilink</Text>
          <Text style={styles.tagline}>Connecting healthcare, simplifying lives</Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Welcome Back</Text>
          <Text style={styles.formSubtitle}>Sign in to your account</Text>

          {/* Error Message */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <Text style={styles.inputLabel}>Email Address</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9E9E9E"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!isLoading}
            />
          </View>

          {/* Password Input */}
          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry={!showPassword}
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <EyeOff size={20} color="#757575" />
              ) : (
                <Eye size={20} color="#757575" />
              )}
            </TouchableOpacity>
          </View>

          {/* Role Selection */}
          <Text style={styles.inputLabel}>I am a:</Text>
          <View style={styles.roleContainer}>
            {['patient', 'doctor', 'pharmacist'].map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.roleButton,
                  selectedRole === role && styles.selectedRoleButton,
                ]}
                onPress={() => setSelectedRole(role as any)}
                disabled={isLoading}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    selectedRole === role && styles.selectedRoleButtonText,
                  ]}
                >
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            style={styles.forgotPassword}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity 
            style={[
              styles.loginButton, 
              isLoading && styles.disabledButton,
              (!email || !password) && styles.disabledButton
            ]} 
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity 
              onPress={handleGoToRegister}
              disabled={isLoading}
            >
              <Text style={styles.registerLink}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
    padding: 8,
    alignSelf: 'flex-start',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0073CC',
    fontFamily: 'Poppins-Bold',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#757575',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212121',
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
  },
  formSubtitle: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 24,
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#E53935',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  inputLabel: {
    fontSize: 14,
    color: '#424242',
    marginBottom: 8,
    fontFamily: 'Poppins-Medium',
  },
  inputContainer: {
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    height: 56,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#212121',
    fontFamily: 'Poppins-Regular',
  },
  eyeIcon: {
    padding: 12,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedRoleButton: {
    backgroundColor: '#E6EEF8',
    borderColor: '#0073CC',
  },
  roleButtonText: {
    fontSize: 14,
    color: '#757575',
    fontFamily: 'Poppins-Medium',
  },
  selectedRoleButtonText: {
    color: '#0073CC',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#0073CC',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  loginButton: {
    backgroundColor: '#0073CC',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#0073CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
    shadowOpacity: 0,
    elevation: 0,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: '#757575',
    fontFamily: 'Poppins-Regular',
  },
  registerLink: {
    fontSize: 14,
    color: '#0073CC',
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 4,
  },
});