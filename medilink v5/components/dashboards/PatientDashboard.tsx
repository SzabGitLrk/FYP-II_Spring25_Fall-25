import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Linking, Platform } from 'react-native';
import { Calendar, MapPin, User, Search, Phone, Navigation } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '@/components/common/Header';
import SearchBar from '@/components/common/SearchBar';

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  image: string;
  location: string;
  available: boolean;
  schedule: any;
  phone: string;
  latitude?: number;
  longitude?: number;
};

// Function to calculate distance between two coordinates in km
const calculateDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Filter locations within 10km radius
const filterLocationsWithin10Km = (locations: Doctor[], userLat: number | null, userLon: number | null): Doctor[] => {
  if (!userLat || !userLon) return [];
  
  return locations.filter(location => {
    if (!location.latitude || !location.longitude) return false;
    
    const distance = calculateDistanceInKm(userLat, userLon, location.latitude, location.longitude);
    return distance <= 10; // 10km radius
  });
};

export default function PatientDashboard() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<any>(null);
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [nearbyDoctors, setNearbyDoctors] = useState<Doctor[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [patientLocation, setPatientLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>('');

  useEffect(() => {
    loadUserInfo();
    loadDoctors();
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (patientLocation && allDoctors.length > 0) {
      const filtered = filterLocationsWithin10Km(allDoctors, patientLocation.latitude, patientLocation.longitude);
      setNearbyDoctors(filtered);
    }
  }, [patientLocation, allDoctors]);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        getCurrentLocation();
      } else {
        setLocationError('Location permission denied. Please enable location services.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationError('Unable to access location services.');
      setIsLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPatientLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setLocationError('');
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Unable to get current location.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserInfo = async () => {
    try {
      const userData = await AsyncStorage.getItem('userInfo');
      if (userData) {
        const user = JSON.parse(userData);
        setUserInfo(user);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  };

  const loadDoctors = () => {
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const doctorsData: Doctor[] = [];
      querySnapshot.forEach((doc) => {
        const doctorData = { id: doc.id, ...doc.data() } as Doctor;
        if (doctorData.latitude && doctorData.longitude) {
          doctorsData.push(doctorData);
        }
      });
      setAllDoctors(doctorsData);
    });

    return unsubscribe;
  };

  const handleCallDoctor = (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber === '') {
      Alert.alert('Phone Not Available', 'Phone number not available');
      return;
    }
    
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.canOpenURL(phoneUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Call Not Available', `Call: ${phoneNumber}`);
        }
      })
      .catch(err => console.error('Error calling:', err));
  };

  const handleGetDirections = async (doctor: Doctor) => {
    if (!doctor.latitude || !doctor.longitude) {
      Alert.alert('Location Not Available', 'Doctor location information is not available.');
      return;
    }

    if (!patientLocation) {
      Alert.alert('Location Required', 'Please enable location services to get directions.');
      return;
    }

    try {
      const destination = `${doctor.latitude},${doctor.longitude}`;
      
      const url = Platform.select({
        ios: `http://maps.apple.com/?daddr=${destination}&dirflg=d`,
        android: `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`
      });

      const supported = await Linking.canOpenURL(url!);
      
      if (supported) {
        await Linking.openURL(url!);
      } else {
        const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
        await Linking.openURL(fallbackUrl);
      }
    } catch (error) {
      console.error('Error opening maps:', error);
      Alert.alert('Error', 'Could not open maps app. Please install Google Maps or Apple Maps.');
    }
  };

  const getWeeklySchedule = (schedule: any) => {
    if (!schedule) return 'Schedule not available';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days
      .filter(day => schedule[day]?.available)
      .map(day => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${schedule[day].start} - ${schedule[day].end}`)
      .join('\n');
  };

  const formatDistance = (distanceInKm: number): string => {
    if (distanceInKm < 1) {
      return `${(distanceInKm * 1000).toFixed(0)} m`;
    }
    return `${distanceInKm.toFixed(1)} km`;
  };

  // Filter doctors based on search and distance
  const filteredDoctors = nearbyDoctors.filter(doctor =>
    doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header 
        title="Patient Dashboard" 
        showBack={true}
        showLogout={true}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>
              Hello, {userInfo?.name || 'Patient'}
            </Text>
            <Text style={styles.welcomeSubtext}>
              How are you feeling today?
            </Text>
            {locationError ? (
              <Text style={styles.locationError}>{locationError}</Text>
            ) : patientLocation ? (
              <Text style={styles.locationStatus}>
                📍 Location enabled - Showing doctors within 10km radius
              </Text>
            ) : null}
          </View>

          <View style={styles.searchContainer}>
            <SearchBar 
              placeholder="Search doctors within 10km..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              icon={<Search size={20} color="#767676" />}
            />
          </View>

          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/maps')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E3F2FD' }]}>
                <MapPin size={24} color="#0073CC" />
              </View>
              <Text style={styles.quickActionText}>View Map</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/search?type=doctors')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#E8F5E9' }]}>
                <User size={24} color="#43A047" />
              </View>
              <Text style={styles.quickActionText}>Find Doctors</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => router.push('/emergency')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#FFEBEE' }]}>
                <Phone size={24} color="#E53935" />
              </View>
              <Text style={styles.quickActionText}>Emergency</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nearby Doctors ({nearbyDoctors.length})</Text>
              <TouchableOpacity onPress={() => router.push('/maps')}>
                <Text style={styles.seeAllText}>View on Map</Text>
              </TouchableOpacity>
            </View>

            {locationError ? (
              <Text style={styles.errorText}>{locationError}</Text>
            ) : !patientLocation ? (
              <Text style={styles.errorText}>Unable to access your location. Please enable location services.</Text>
            ) : nearbyDoctors.length > 0 ? (
              nearbyDoctors.map((doctor) => {
                const distance = patientLocation && doctor.latitude && doctor.longitude 
                  ? calculateDistanceInKm(patientLocation.latitude, patientLocation.longitude, doctor.latitude, doctor.longitude)
                  : 0;

                return (
                  <View key={doctor.id} style={styles.doctorCard}>
                    <Image 
                      source={{ uri: doctor.image || 'https://via.placeholder.com/60' }} 
                      style={styles.doctorImage}
                    />
                    <View style={styles.doctorInfo}>
                      <Text style={styles.doctorName}>{doctor.name}</Text>
                      <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
                      <Text style={styles.doctorLocation}>{doctor.location}</Text>
                      <Text style={styles.distanceText}>
                        📍 {formatDistance(distance)} away
                      </Text>
                      <Text style={styles.phoneText}>
                        {doctor.phone ? `📞 ${doctor.phone}` : '📞 Phone number not available'}
                      </Text>
                      
                      <View style={styles.doctorActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleCallDoctor(doctor.phone)}
                        >
                          <Phone size={14} color="#0073CC" />
                          <Text style={styles.actionButtonText}>Call</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleGetDirections(doctor)}
                        >
                          <Navigation size={14} color="#43A047" />
                          <Text style={styles.actionButtonText}>Navigate</Text>
                        </TouchableOpacity>
                      </View>
                      
                      <View style={styles.scheduleContainer}>
                        <Text style={styles.scheduleTitle}>Weekly Schedule:</Text>
                        <Text style={styles.scheduleText}>
                          {getWeeklySchedule(doctor.schedule)}
                        </Text>
                      </View>
                    </View>
                    <View style={[
                      styles.availabilityBadge,
                      { backgroundColor: doctor.available ? '#E8F5E9' : '#FFEBEE' }
                    ]}>
                      <Text style={[
                        styles.availabilityText,
                        { color: doctor.available ? '#43A047' : '#E53935' }
                      ]}>
                        {doctor.available ? 'Available' : 'Busy'}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.noDoctorsText}>
                No doctors available within 10km radius
              </Text>
            )}
          </View>

          {searchQuery && filteredDoctors.length > 0 && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Search Results ({filteredDoctors.length})</Text>
              {filteredDoctors.map((doctor) => {
                const distance = patientLocation && doctor.latitude && doctor.longitude 
                  ? calculateDistanceInKm(patientLocation.latitude, patientLocation.longitude, doctor.latitude, doctor.longitude)
                  : 0;

                return (
                  <View key={doctor.id} style={styles.doctorCard}>
                    <Image 
                      source={{ uri: doctor.image || 'https://via.placeholder.com/60' }} 
                      style={styles.doctorImage}
                    />
                    <View style={styles.doctorInfo}>
                      <Text style={styles.doctorName}>{doctor.name}</Text>
                      <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
                      <Text style={styles.doctorLocation}>{doctor.location}</Text>
                      <Text style={styles.distanceText}>
                        📍 {formatDistance(distance)} away
                      </Text>
                      <Text style={styles.phoneText}>
                        {doctor.phone ? `📞 ${doctor.phone}` : '📞 Phone number not available'}
                      </Text>
                      
                      <View style={styles.doctorActions}>
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleCallDoctor(doctor.phone)}
                        >
                          <Phone size={14} color="#0073CC" />
                          <Text style={styles.actionButtonText}>Call</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          style={styles.actionButton}
                          onPress={() => handleGetDirections(doctor)}
                        >
                          <Navigation size={14} color="#43A047" />
                          <Text style={styles.actionButtonText}>Navigate</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={[
                      styles.availabilityBadge,
                      { backgroundColor: doctor.available ? '#E8F5E9' : '#FFEBEE' }
                    ]}>
                      <Text style={[
                        styles.availabilityText,
                        { color: doctor.available ? '#43A047' : '#E53935' }
                      ]}>
                        {doctor.available ? 'Available' : 'Busy'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {searchQuery && filteredDoctors.length === 0 && patientLocation && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              <Text style={styles.noResultsText}>
                No doctors within 10km matching "{searchQuery}"
              </Text>
            </View>
          )}

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Quick Access</Text>
            <View style={styles.quickAccessGrid}>
              <TouchableOpacity 
                style={styles.quickAccessItem}
                onPress={() => router.push('/maps')}
              >
                <View style={[styles.quickAccessIcon, { backgroundColor: '#E3F2FD' }]}>
                  <MapPin size={24} color="#0073CC" />
                </View>
                <Text style={styles.quickAccessText}>Medical Map</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAccessItem}
                onPress={() => router.push('/search?type=doctors')}
              >
                <View style={[styles.quickAccessIcon, { backgroundColor: '#E8F5E9' }]}>
                  <User size={24} color="#43A047" />
                </View>
                <Text style={styles.quickAccessText}>Find Doctors</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAccessItem}
                onPress={() => router.push('/emergency')}
              >
                <View style={[styles.quickAccessIcon, { backgroundColor: '#FFEBEE' }]}>
                  <Phone size={24} color="#E53935" />
                </View>
                <Text style={styles.quickAccessText}>Emergency</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.quickAccessItem}
                onPress={() => router.push('/search?type=medicines')}
              >
                <View style={[styles.quickAccessIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Calendar size={24} color="#F57C00" />
                </View>
                <Text style={styles.quickAccessText}>Find Medicines</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
  },
  loadingText: {
    fontSize: 18,
    color: '#0073CC',
    fontFamily: 'Poppins-Medium',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeContainer: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#212121',
  },
  welcomeSubtext: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
  },
  locationStatus: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
    marginTop: 8,
  },
  locationError: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#E53935',
    marginTop: 8,
  },
  searchContainer: {
    marginBottom: 20,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickActionButton: {
    alignItems: 'center',
    width: '30%',
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
    textAlign: 'center',
  },
  sectionContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  seeAllText: {
    fontSize: 14,
    color: '#0073CC',
    fontFamily: 'Poppins-Medium',
  },
  doctorCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  doctorImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  doctorInfo: {
    flex: 1,
  },
  doctorName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  doctorSpecialty: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
  },
  doctorLocation: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 2,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
    marginBottom: 2,
  },
  phoneText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 8,
  },
  doctorActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
  },
  scheduleContainer: {
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 4,
  },
  scheduleTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 4,
  },
  scheduleText: {
    fontSize: 11,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    lineHeight: 16,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 10,
    fontFamily: 'Poppins-Medium',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#E53935',
    textAlign: 'center',
    padding: 16,
  },
  noDoctorsText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    textAlign: 'center',
    padding: 16,
  },
  noResultsText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    textAlign: 'center',
    padding: 16,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAccessItem: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  quickAccessIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickAccessText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
    textAlign: 'center',
  },
});