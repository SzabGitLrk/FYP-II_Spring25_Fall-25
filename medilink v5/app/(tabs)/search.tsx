import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Search as SearchIcon, MapPin, Pill, User, Clock, CircleCheck as CheckCircle } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '@/config/firebase';
import SearchBar from '@/components/common/SearchBar';
import Header from '@/components/common/Header';

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  location: string;
  available: boolean;
  schedule: any;
  coordinates?: any;
  phone: string;
  latitude?: number;
  longitude?: number;
}

interface Pharmacy {
  id: string;
  name: string;
  location: string;
  phone: string;
  coordinates: any;
  medicines: any[];
  ownerId: string;
  address?: string;
  email?: string;
  website?: string;
  openingHours?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
}

interface MedicineResult {
  medicine: any;
  pharmacy: Pharmacy;
}

type SearchType = 'doctors' | 'medicines' | 'pharmacies';

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
const filterLocationsWithin10Km = <T extends { latitude?: number; longitude?: number }>(
  locations: T[], 
  userLat: number | null, 
  userLon: number | null
): T[] => {
  if (!userLat || !userLon) return [];
  
  return locations.filter(location => {
    if (!location.latitude || !location.longitude) return false;
    
    const distance = calculateDistanceInKm(userLat, userLon, location.latitude, location.longitude);
    return distance <= 10; // 10km radius
  });
};

export default function SearchScreen() {
  const [searchType, setSearchType] = useState<SearchType>('doctors');
  const [searchQuery, setSearchQuery] = useState('');
  const [allDoctors, setAllDoctors] = useState<Doctor[]>([]);
  const [allPharmacies, setAllPharmacies] = useState<Pharmacy[]>([]);
  const [allMedicineResults, setAllMedicineResults] = useState<MedicineResult[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [filteredMedicineResults, setFilteredMedicineResults] = useState<MedicineResult[]>([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState<Pharmacy[]>([]);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>('');

  useEffect(() => {
    loadLocations();
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (userLocation) {
      const nearbyDoctors = filterLocationsWithin10Km(allDoctors, userLocation.latitude, userLocation.longitude);
      setFilteredDoctors(nearbyDoctors);
      
      const nearbyPharmacies = filterLocationsWithin10Km(allPharmacies, userLocation.latitude, userLocation.longitude);
      setFilteredPharmacies(nearbyPharmacies);
      
      // Filter medicine results based on nearby pharmacies
      const nearbyMedicineResults = allMedicineResults.filter(item => 
        nearbyPharmacies.some(pharmacy => pharmacy.id === item.pharmacy.id)
      );
      setFilteredMedicineResults(nearbyMedicineResults);
    } else {
      setFilteredDoctors([]);
      setFilteredPharmacies([]);
      setFilteredMedicineResults([]);
    }
  }, [userLocation, allDoctors, allPharmacies, allMedicineResults]);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        getCurrentLocation();
      } else {
        setLocationError('Location permission denied. Please enable location services.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationError('Unable to access location services.');
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      setLocationError('');
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Unable to get current location.');
    } finally {
      setLoading(false);
    }
  };

  const loadLocations = () => {
    try {
      const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
      const doctorsUnsubscribe = onSnapshot(doctorsQuery, 
        (querySnapshot) => {
          const doctorsData: Doctor[] = [];
          querySnapshot.forEach((doc) => {
            const doctorData = doc.data();
            doctorsData.push({ 
              id: doc.id, 
              name: doctorData.name || 'Doctor',
              specialty: doctorData.specialty || 'General Practitioner',
              location: doctorData.location || 'Location not specified',
              available: doctorData.available || false,
              schedule: doctorData.schedule || {},
              coordinates: doctorData.coordinates || {},
              phone: doctorData.phone || '',
              latitude: doctorData.latitude,
              longitude: doctorData.longitude
            } as Doctor);
          });
          setAllDoctors(doctorsData);
        },
        (error) => {
          console.error('Error fetching doctors:', error);
        }
      );

      const pharmaciesUnsubscribe = onSnapshot(collection(db, 'pharmacies'), 
        (querySnapshot) => {
          const pharmaciesData: Pharmacy[] = [];
          const medicineData: MedicineResult[] = [];
          
          querySnapshot.forEach((doc) => {
            const pharmacyData = doc.data();
            const pharmacy: Pharmacy = { 
              id: doc.id, 
              name: pharmacyData.name || 'Pharmacy',
              location: pharmacyData.location || 'Location not specified',
              phone: pharmacyData.phone || '',
              coordinates: pharmacyData.coordinates || {},
              medicines: pharmacyData.medicines || [],
              ownerId: pharmacyData.ownerId || '',
              address: pharmacyData.address || '',
              email: pharmacyData.email || '',
              website: pharmacyData.website || '',
              openingHours: pharmacyData.openingHours || '9:00 AM - 9:00 PM',
              description: pharmacyData.description || '',
              latitude: pharmacyData.latitude,
              longitude: pharmacyData.longitude
            };
            pharmaciesData.push(pharmacy);

            if (pharmacyData.medicines && Array.isArray(pharmacyData.medicines)) {
              pharmacyData.medicines.forEach((medicine: any) => {
                medicineData.push({ 
                  medicine: {
                    id: medicine.id || Math.random().toString(),
                    name: medicine.name || 'Medicine',
                    category: medicine.category || 'General',
                    price: medicine.price || 'Rs 0',
                    stock: medicine.stock || 0,
                    description: medicine.description || ''
                  }, 
                  pharmacy 
                });
              });
            }
          });
          
          setAllPharmacies(pharmaciesData);
          setAllMedicineResults(medicineData);
        },
        (error) => {
          console.error('Error fetching pharmacies:', error);
        }
      );

      return () => {
        doctorsUnsubscribe();
        pharmaciesUnsubscribe();
      };
    } catch (error) {
      console.error('Error setting up listeners:', error);
    }
  };

  const formatDistance = (distanceInKm: number): string => {
    if (distanceInKm < 1) {
      return `${(distanceInKm * 1000).toFixed(0)} m`;
    }
    return `${distanceInKm.toFixed(1)} km`;
  };

  const getDistanceFromUser = (location: { latitude?: number; longitude?: number }): string => {
    if (!userLocation || !location.latitude || !location.longitude) {
      return 'Distance not available';
    }
    
    const distance = calculateDistanceInKm(
      userLocation.latitude,
      userLocation.longitude,
      location.latitude,
      location.longitude
    );
    
    return formatDistance(distance);
  };

  const isDoctorAvailable = (doctor: Doctor) => {
    if (!doctor.available) return false;
    if (!doctor.schedule) return false;
    
    const now = new Date();
    const day = now.toLocaleDateString('en', { weekday: 'long' }).toLowerCase();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const todaySchedule = doctor.schedule[day];
    if (!todaySchedule || !todaySchedule.available) return false;
    
    const [startHour, startMinute] = todaySchedule.start.split(':').map(Number);
    const [endHour, endMinute] = todaySchedule.end.split(':').map(Number);
    
    const startTime = startHour * 100 + startMinute;
    const endTime = endHour * 100 + endMinute;
    
    return currentTime >= startTime && currentTime <= endTime;
  };

  const getWeeklySchedule = (schedule: any) => {
    if (!schedule) return 'Schedule not available';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days
      .filter(day => schedule[day]?.available)
      .map(day => `${day.charAt(0).toUpperCase() + day.slice(1)}: ${schedule[day].start} - ${schedule[day].end}`)
      .join('\n');
  };

  // Apply search filter to already filtered (by distance) results
  const getSearchResults = () => {
    if (searchType === 'doctors') {
      return filteredDoctors.filter(doctor =>
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doctor.specialty && doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    } else if (searchType === 'medicines') {
      return filteredMedicineResults.filter(item =>
        item.medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.medicine.category && item.medicine.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    } else {
      return filteredPharmacies.filter(pharmacy =>
        pharmacy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pharmacy.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  };

  const searchResults = getSearchResults();

  const renderDoctors = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading doctors...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby doctors</Text>
        </View>
      );
    }

    if (!userLocation) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Unable to access location</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby doctors</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery 
              ? `No doctors within 10km matching "${searchQuery}"`
              : 'No doctors available within 10km radius'
            }
          </Text>
          <Text style={styles.emptyStateSubtext}>Try searching with different terms</Text>
        </View>
      );
    }

    return searchResults.map((doctor) => (
      <View key={doctor.id} style={styles.resultCard}>
        <View style={styles.doctorHeader}>
          <View style={styles.doctorImagePlaceholder}>
            <User size={24} color="#0073CC" />
          </View>
          <View style={styles.doctorInfo}>
            <Text style={styles.doctorName}>{doctor.name}</Text>
            <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
            <View style={styles.doctorDetails}>
              <View style={styles.detailItem}>
                <MapPin size={14} color="#757575" />
                <Text style={styles.detailText}>{doctor.location}</Text>
              </View>
            </View>
            <Text style={styles.distanceText}>
              📍 {getDistanceFromUser(doctor)} away
            </Text>
            <Text style={styles.phoneText}>
              {doctor.phone ? `📞 ${doctor.phone}` : '📞 Phone number not available'}
            </Text>
          </View>
        </View>
        
        <View style={styles.availabilityContainer}>
          <View style={[
            styles.availabilityBadge,
            { backgroundColor: isDoctorAvailable(doctor) ? '#E8F5E9' : '#FFEBEE' }
          ]}>
            <Text style={[
              styles.availabilityText,
              { color: isDoctorAvailable(doctor) ? '#43A047' : '#E53935' }
            ]}>
              {isDoctorAvailable(doctor) ? 'Available Now' : 'Unavailable'}
            </Text>
          </View>
          
          {doctor.schedule && (
            <View style={styles.scheduleInfo}>
              <Clock size={14} color="#757575" />
              <Text style={styles.scheduleText}>
                Weekly Schedule Available
              </Text>
            </View>
          )}
        </View>
        
        {doctor.schedule && (
          <View style={styles.scheduleContainer}>
            <Text style={styles.scheduleTitle}>Weekly Schedule:</Text>
            <Text style={styles.scheduleText}>
              {getWeeklySchedule(doctor.schedule)}
            </Text>
          </View>
        )}
      </View>
    ));
  };

  const renderMedicines = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading medicines...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby medicines</Text>
        </View>
      );
    }

    if (!userLocation) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Unable to access location</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby medicines</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery 
              ? `No medicines within 10km matching "${searchQuery}"`
              : 'No medicines available within 10km radius'
            }
          </Text>
          <Text style={styles.emptyStateSubtext}>Try searching with different terms</Text>
        </View>
      );
    }

    return searchResults.map((item, index) => (
      <View key={`${item.medicine.id}-${index}`} style={styles.resultCard}>
        <View style={styles.medicineHeader}>
          <View style={styles.medicineIcon}>
            <Pill size={24} color="#0073CC" />
          </View>
          <View style={styles.medicineInfo}>
            <Text style={styles.medicineName}>{item.medicine.name}</Text>
            <Text style={styles.medicineCategory}>{item.medicine.category}</Text>
            <Text style={styles.medicinePrice}>
              {item.medicine.price.startsWith('Rs ') ? item.medicine.price : `Rs ${item.medicine.price}`}
            </Text>
          </View>
          <View style={[
            styles.stockBadge,
            { backgroundColor: item.medicine.stock > 0 ? '#E8F5E9' : '#FFEBEE' }
          ]}>
            <Text style={[
              styles.stockText,
              { color: item.medicine.stock > 0 ? '#43A047' : '#E53935' }
            ]}>
              {item.medicine.stock > 0 ? `Stock: ${item.medicine.stock}` : 'Out of Stock'}
            </Text>
          </View>
        </View>
        
        <View style={styles.pharmacyInfoRow}>
          <CheckCircle size={16} color="#43A047" />
          <Text style={styles.pharmacyNameText}>Available at: {item.pharmacy.name}</Text>
        </View>
        
        <View style={styles.locationInfo}>
          <MapPin size={14} color="#757575" />
          <Text style={styles.locationText}>{item.pharmacy.location}</Text>
          <Text style={styles.distanceText}>
            📍 {getDistanceFromUser(item.pharmacy)} away
          </Text>
        </View>
        
        <Text style={styles.phoneText}>
          {item.pharmacy.phone ? `📞 ${item.pharmacy.phone}` : '📞 Phone number not available'}
        </Text>
        
        {item.medicine.description && (
          <Text style={styles.medicineDescription}>{item.medicine.description}</Text>
        )}
      </View>
    ));
  };

  const renderPharmacies = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Loading pharmacies...</Text>
        </View>
      );
    }

    if (locationError) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.errorText}>{locationError}</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby pharmacies</Text>
        </View>
      );
    }

    if (!userLocation) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Unable to access location</Text>
          <Text style={styles.emptyStateSubtext}>Please enable location services to see nearby pharmacies</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {searchQuery 
              ? `No pharmacies within 10km matching "${searchQuery}"`
              : 'No pharmacies available within 10km radius'
            }
          </Text>
          <Text style={styles.emptyStateSubtext}>Try searching with different terms</Text>
        </View>
      );
    }

    return searchResults.map((pharmacy) => {
      const availableMeds = allMedicineResults
        .filter(item => item.pharmacy.id === pharmacy.id && item.medicine.stock > 0)
        .slice(0, 3);

      return (
        <View key={pharmacy.id} style={styles.resultCard}>
          <View style={styles.pharmacyHeader}>
            <View style={styles.pharmacyIcon}>
              <Pill size={24} color="#0073CC" />
            </View>
            <View style={styles.pharmacyInfoContainer}>
              <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
              <Text style={styles.pharmacyLocation}>{pharmacy.location}</Text>
              <Text style={styles.distanceText}>
                📍 {getDistanceFromUser(pharmacy)} away
              </Text>
              <Text style={styles.phoneText}>
                {pharmacy.phone ? `📞 ${pharmacy.phone}` : '📞 Phone number not available'}
              </Text>
            </View>
          </View>
          
          <View style={styles.medicinesList}>
            <Text style={styles.medicinesTitle}>Available Medicines:</Text>
            {availableMeds.length > 0 ? (
              availableMeds.map((item, index) => (
                <View key={index} style={styles.medicineItem}>
                  <Text style={styles.medItemName}>{item.medicine.name}</Text>
                  <Text style={styles.medItemStock}>Stock: {item.medicine.stock}</Text>
                  <Text style={styles.medItemPrice}>
                    {item.medicine.price.startsWith('Rs ') ? item.medicine.price : `Rs ${item.medicine.price}`}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.noMedicinesText}>No medicines available</Text>
            )}
          </View>
          
          <View style={styles.pharmacyStats}>
            <Text style={styles.totalMedicines}>
              Total Medicines: {allMedicineResults.filter(item => item.pharmacy.id === pharmacy.id).length}
            </Text>
            <Text style={styles.availableMedicines}>
              In Stock: {availableMeds.length}
            </Text>
          </View>
        </View>
      );
    });
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Search" 
        showBack={true}
      />
      
      <View style={styles.content}>
        <SearchBar 
          placeholder={`Search for ${searchType} within 10km...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon={<SearchIcon size={20} color="#767676" />}
        />

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              searchType === 'doctors' && styles.activeTabButton,
            ]}
            onPress={() => setSearchType('doctors')}
          >
            <Text
              style={[
                styles.tabText,
                searchType === 'doctors' && styles.activeTabText,
              ]}
            >
              Doctors
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton,
              searchType === 'medicines' && styles.activeTabButton,
            ]}
            onPress={() => setSearchType('medicines')}
          >
            <Text
              style={[
                styles.tabText,
                searchType === 'medicines' && styles.activeTabText,
              ]}
            >
              Medicines
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tabButton,
              searchType === 'pharmacies' && styles.activeTabButton,
            ]}
            onPress={() => setSearchType('pharmacies')}
          >
            <Text
              style={[
                styles.tabText,
                searchType === 'pharmacies' && styles.activeTabText,
              ]}
            >
              Pharmacies
            </Text>
          </TouchableOpacity>
        </View>

        {userLocation && (
          <Text style={styles.locationNote}>
            📍 Showing results within 10km radius
          </Text>
        )}

        <ScrollView 
          style={styles.resultsContainer} 
          showsVerticalScrollIndicator={false}
        >
          {searchType === 'doctors' && renderDoctors()}
          {searchType === 'medicines' && renderMedicines()}
          {searchType === 'pharmacies' && renderPharmacies()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    marginVertical: 16,
    backgroundColor: '#E6EEF8',
    borderRadius: 8,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#767676',
  },
  activeTabText: {
    color: '#0073CC',
  },
  locationNote: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
    marginBottom: 12,
    textAlign: 'center',
  },
  resultsContainer: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  // Doctor Styles
  doctorHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  doctorImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E6EEF8',
    justifyContent: 'center',
    alignItems: 'center',
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
    color: '#0073CC',
    marginBottom: 4,
  },
  doctorDetails: {
    flexDirection: 'row',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
    marginTop: 2,
  },
  phoneText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginTop: 2,
  },
  availabilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  scheduleTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 4,
  },
  scheduleText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginLeft: 4,
    lineHeight: 16,
  },
  // Medicine Styles
  medicineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  medicineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6EEF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  medicineInfo: {
    flex: 1,
  },
  medicineName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  medicineCategory: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
  },
  medicinePrice: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stockText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  pharmacyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pharmacyNameText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
    marginLeft: 8,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginLeft: 4,
    flex: 1,
  },
  medicineDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#9E9E9E',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // Pharmacy Styles
  pharmacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pharmacyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6EEF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pharmacyInfoContainer: {
    flex: 1,
  },
  pharmacyName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  pharmacyLocation: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 4,
  },
  medicinesList: {
    marginBottom: 12,
  },
  medicinesTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#212121',
    marginBottom: 8,
  },
  medicineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  medItemName: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#212121',
    flex: 2,
  },
  medItemStock: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#43A047',
    flex: 1,
    textAlign: 'center',
  },
  medItemPrice: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
    flex: 1,
    textAlign: 'right',
  },
  noMedicinesText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    fontStyle: 'italic',
  },
  pharmacyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalMedicines: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
  },
  availableMedicines: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#757575',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#9E9E9E',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#E53935',
    marginBottom: 8,
    textAlign: 'center',
  },
});