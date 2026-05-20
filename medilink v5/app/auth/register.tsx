import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor' | 'pharmacist'>('patient');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      const userData = {
        uid: user.uid,
        name,
        email,
        role: selectedRole,
        createdAt: new Date().toISOString(),
        ...(selectedRole === 'doctor' && { 
          specialty: '',
          schedule: {},
          location: '',
          available: false 
        }),
        ...(selectedRole === 'pharmacist' && { 
          pharmacyName: '',
          location: '',
          phone: '' 
        })
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // If pharmacist, create pharmacy document
      if (selectedRole === 'pharmacist') {
        await setDoc(doc(db, 'pharmacies', user.uid), {
          name: '',
          ownerId: user.uid,
          location: '',
          phone: '',
          medicines: [],
          createdAt: new Date().toISOString()
        });
      }

      Alert.alert('Success', 'Account created successfully! Please login.');
      router.replace('/auth/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('Email already in use');
      } else {
        setErrorMessage('An error occurred during registration');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToLogin = () => {
    console.log('Navigating to login screen...');
    router.push('/auth/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#212121" />
        </TouchableOpacity>

        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Create Account</Text>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <Text style={styles.inputLabel}>Full Name</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#9E9E9E"
              value={name}
              onChangeText={setName}
            />
          </View>

          <Text style={styles.inputLabel}>Email</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#9E9E9E"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <Text style={styles.inputLabel}>Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={20} color="#757575" />
              ) : (
                <Eye size={20} color="#757575" />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>Confirm Password</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#9E9E9E"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>

          <Text style={styles.inputLabel}>I am a:</Text>
          <View style={styles.roleContainer}>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === 'patient' && styles.selectedRoleButton,
              ]}
              onPress={() => setSelectedRole('patient')}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === 'patient' && styles.selectedRoleButtonText,
                ]}
              >
                Patient
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === 'doctor' && styles.selectedRoleButton,
              ]}
              onPress={() => setSelectedRole('doctor')}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === 'doctor' && styles.selectedRoleButtonText,
                ]}
              >
                Doctor
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.roleButton,
                selectedRole === 'pharmacist' && styles.selectedRoleButton,
              ]}
              onPress={() => setSelectedRole('pharmacist')}
            >
              <Text
                style={[
                  styles.roleButtonText,
                  selectedRole === 'pharmacist' && styles.selectedRoleButtonText,
                ]}
              >
                Pharmacist
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.registerButton, isLoading && styles.disabledButton]} 
            onPress={handleRegister}
            disabled={isLoading}
          >
            <Text style={styles.registerButtonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>

          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={handleGoToLogin}>
              <Text style={styles.loginLink}>Login</Text>
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
    padding: 20,
  },
  backButton: {
    marginBottom: 16,
    padding: 8,
    alignSelf: 'flex-start',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#212121',
    fontFamily: 'Poppins-Bold',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
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
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#212121',
    fontFamily: 'Poppins-Regular',
  },
  eyeIcon: {
    padding: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedRoleButton: {
    backgroundColor: '#E6EEF8',
    borderWidth: 1,
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
  registerButton: {
    backgroundColor: '#0073CC',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#757575',
    fontFamily: 'Poppins-Regular',
  },
  loginLink: {
    fontSize: 14,
    color: '#0073CC',
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 4,
  },
});