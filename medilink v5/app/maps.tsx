import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Alert, Linking, Platform, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Phone, Navigation, Search } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import * as Location from 'expo-location';
import { db } from '@/config/firebase';
import Header from '@/components/common/Header';
import SearchBar from '@/components/common/SearchBar';

type LocationType = {
  id: string;
  name: string;
  type: 'doctor' | 'pharmacy';
  specialty?: string;
  latitude: number;
  longitude: number;
  address: string;
  phone: string;
  available?: boolean;
  medicines?: string[];
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
const filterLocationsWithin10Km = (locations: LocationType[], userLat: number | null, userLon: number | null): LocationType[] => {
  if (!userLat || !userLon) return [];
  
  return locations.filter(location => {
    const distance = calculateDistanceInKm(userLat, userLon, location.latitude, location.longitude);
    return distance <= 10; // 10km radius
  });
};

export default function MapsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [allLocations, setAllLocations] = useState<LocationType[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<LocationType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'doctors' | 'pharmacies'>('all');
  const [userLocation, setUserLocation] = useState<Region | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationType | null>(null);
  const [locationError, setLocationError] = useState<string>('');

  const defaultRegion: Region = {
    latitude: 24.8607,
    longitude: 67.0011,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  useEffect(() => {
    loadLocations();
    getUserLocation();
  }, []);

  useEffect(() => {
    if (userLocation && allLocations.length > 0) {
      const filteredByDistance = filterLocationsWithin10Km(
        allLocations, 
        userLocation.latitude, 
        userLocation.longitude
      );
      applyFilters(filteredByDistance, searchQuery, selectedType);
    } else {
      setFilteredLocations([]);
    }
  }, [userLocation, allLocations, searchQuery, selectedType]);

  const getUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        const userRegion: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        };
        setUserLocation(userRegion);
        setLocationError('');
      } else {
        setLocationError('Location permission denied. Please enable location services.');
      }
    } catch (error) {
      console.error('Error getting user location:', error);
      setLocationError('Unable to get current location.');
    }
  };

  const loadLocations = () => {
    const doctorsQuery = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const doctorsUnsubscribe = onSnapshot(doctorsQuery, (snapshot) => {
      const doctorsData: LocationType[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.latitude && data.longitude) {
          doctorsData.push({
            id: doc.id,
            name: data.name,
            type: 'doctor',
            specialty: data.specialty,
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.location,
            phone: data.phone || '',
            available: data.available
          });
        }
      });
      updateLocations(doctorsData, 'doctor');
    });

    const pharmaciesQuery = query(collection(db, 'pharmacies'));
    const pharmaciesUnsubscribe = onSnapshot(pharmaciesQuery, (snapshot) => {
      const pharmaciesData: LocationType[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.latitude && data.longitude) {
          pharmaciesData.push({
            id: doc.id,
            name: data.name,
            type: 'pharmacy',
            latitude: data.latitude,
            longitude: data.longitude,
            address: data.location,
            phone: data.phone || '',
            medicines: data.medicines?.map((m: any) => m.name) || []
          });
        }
      });
      updateLocations(pharmaciesData, 'pharmacy');
    });

    return () => {
      doctorsUnsubscribe();
      pharmaciesUnsubscribe();
    };
  };

  const updateLocations = (newLocations: LocationType[], locationType: 'doctor' | 'pharmacy') => {
    setAllLocations(prev => {
      const filtered = prev.filter(loc => loc.type !== locationType);
      return [...filtered, ...newLocations];
    });
  };

  const applyFilters = (locations: LocationType[], query: string, type: 'all' | 'doctors' | 'pharmacies') => {
    let filtered = locations;

    if (type === 'doctors') {
      filtered = filtered.filter(loc => loc.type === 'doctor');
    } else if (type === 'pharmacies') {
      filtered = filtered.filter(loc => loc.type === 'pharmacy');
    }

    if (query) {
      filtered = filtered.filter(loc =>
        loc.name.toLowerCase().includes(query.toLowerCase()) ||
        loc.specialty?.toLowerCase().includes(query.toLowerCase()) ||
        loc.medicines?.some(med => med.toLowerCase().includes(query.toLowerCase()))
      );
    }

    setFilteredLocations(filtered);
  };

  const handleGetDirections = async (location: LocationType) => {
    if (!location.latitude || !location.longitude) {
      Alert.alert('Location Not Available', 'Location information is not available.');
      return;
    }

    if (!userLocation) {
      Alert.alert('Location Required', 'Please enable location services to get directions.');
      return;
    }

    try {
      const destination = `${location.latitude},${location.longitude}`;
      
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

  const handleCall = (phone: string) => {
    if (!phone || phone === '') {
      Alert.alert('Phone Not Available', 'Phone number not available');
      return;
    }
    
    const phoneUrl = `tel:${phone}`;
    Linking.canOpenURL(phoneUrl)
      .then(supported => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert('Call Not Available', `Call: ${phone}`);
        }
      })
      .catch(err => console.error('Error calling:', err));
  };

  const getMarkerColor = (type: 'doctor' | 'pharmacy') => {
    return type === 'doctor' ? '#0073CC' : '#43A047';
  };

  const handleMarkerPress = (location: LocationType) => {
    setSelectedLocation(location);
  };

  const handleMapPress = () => {
    setSelectedLocation(null);
  };

  const formatDistance = (distanceInKm: number): string => {
    if (distanceInKm < 1) {
      return `${(distanceInKm * 1000).toFixed(0)} m`;
    }
    return `${distanceInKm.toFixed(1)} km`;
  };

  const getDistanceFromUser = (location: LocationType): string => {
    if (!userLocation) return 'Distance not available';
    
    const distance = calculateDistanceInKm(
      userLocation.latitude,
      userLocation.longitude,
      location.latitude,
      location.longitude
    );
    
    return formatDistance(distance);
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Medical Map" 
        showBack={true}
        showLogout={true}
      />
      
      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <SearchBar 
            placeholder="Search within 10km radius..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            icon={<Search size={20} color="#767676" />}
          />
        </View>

        <View style={styles.filterContainer}>
          {['all', 'doctors', 'pharmacies'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                selectedType === type && styles.activeFilterButton,
              ]}
              onPress={() => setSelectedType(type as any)}
            >
              <Text style={[
                styles.filterText,
                selectedType === type && styles.activeFilterText,
              ]}>
                {type === 'all' ? 'All' : type === 'doctors' ? 'Doctors' : 'Pharmacies'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {locationError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{locationError}</Text>
          </View>
        ) : userLocation ? (
          <Text style={styles.locationNote}>
            📍 Showing locations within 10km radius ({filteredLocations.length} found)
          </Text>
        ) : (
          <Text style={styles.locationNote}>
            📍 Enable location services to see nearby locations
          </Text>
        )}

        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            region={userLocation || defaultRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            onPress={handleMapPress}
          >
            {filteredLocations.map((location) => (
              <Marker
                key={location.id}
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title={location.name}
                description={location.type === 'doctor' ? location.specialty : 'Pharmacy'}
                onPress={() => handleMarkerPress(location)}
              >
                <View style={[
                  styles.marker, 
                  { backgroundColor: getMarkerColor(location.type) },
                  selectedLocation?.id === location.id && styles.selectedMarker
                ]}>
                  <MapPin size={16} color="#FFFFFF" />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>

        {selectedLocation && (
          <View style={styles.selectedLocationCard}>
            <View style={styles.locationHeader}>
              <View style={[
                styles.typeBadge,
                { backgroundColor: selectedLocation.type === 'doctor' ? '#E3F2FD' : '#E8F5E9' }
              ]}>
                <Text style={[
                  styles.typeText,
                  { color: selectedLocation.type === 'doctor' ? '#0073CC' : '#43A047' }
                ]}>
                  {selectedLocation.type === 'doctor' ? 'Doctor' : 'Pharmacy'}
                </Text>
              </View>
              {selectedLocation.type === 'doctor' && selectedLocation.available && (
                <View style={styles.availableBadge}>
                  <Text style={styles.availableText}>Available</Text>
                </View>
              )}
            </View>
            
            <Text style={styles.locationName}>{selectedLocation.name}</Text>
            {selectedLocation.specialty && (
              <Text style={styles.specialtyText}>{selectedLocation.specialty}</Text>
            )}
            <Text style={styles.addressText}>{selectedLocation.address}</Text>
            <Text style={styles.distanceText}>
              📍 {getDistanceFromUser(selectedLocation)} away
            </Text>
            <Text style={styles.phoneText}>
              {selectedLocation.phone ? `📞 ${selectedLocation.phone}` : '📞 Phone number not available'}
            </Text>
            
            <View style={styles.locationActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleCall(selectedLocation.phone)}
              >
                <Phone size={16} color="#0073CC" />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleGetDirections(selectedLocation)}
              >
                <Navigation size={16} color="#43A047" />
                <Text style={styles.actionText}>Navigate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.locationsList}>
          <Text style={styles.sectionTitle}>
            {userLocation ? `${filteredLocations.length} Locations within 10km` : 'Locations'}
          </Text>
          
          {locationError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{locationError}</Text>
              <Text style={styles.errorSubtext}>Please enable location services to see nearby locations</Text>
            </View>
          ) : !userLocation ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>Location services required</Text>
              <Text style={styles.emptyStateSubtext}>Enable location to see nearby doctors and pharmacies</Text>
            </View>
          ) : filteredLocations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                {searchQuery 
                  ? `No locations within 10km matching "${searchQuery}"`
                  : 'No locations available within 10km radius'
                }
              </Text>
              <Text style={styles.emptyStateSubtext}>Try adjusting your search or location settings</Text>
            </View>
          ) : (
            <ScrollView 
              style={styles.locationsScrollView}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.locationsScrollContent}
            >
              {filteredLocations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.locationCard,
                    selectedLocation?.id === location.id && styles.selectedLocationItem
                  ]}
                  onPress={() => handleMarkerPress(location)}
                >
                  <View style={styles.locationHeader}>
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: location.type === 'doctor' ? '#E3F2FD' : '#E8F5E9' }
                    ]}>
                      <Text style={[
                        styles.typeText,
                        { color: location.type === 'doctor' ? '#0073CC' : '#43A047' }
                      ]}>
                        {location.type === 'doctor' ? 'Doctor' : 'Pharmacy'}
                      </Text>
                    </View>
                    {location.type === 'doctor' && location.available && (
                      <View style={styles.availableBadge}>
                        <Text style={styles.availableText}>Available</Text>
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.locationName}>{location.name}</Text>
                  {location.specialty && (
                    <Text style={styles.specialtyText}>{location.specialty}</Text>
                  )}
                  <Text style={styles.addressText}>{location.address}</Text>
                  <Text style={styles.distanceText}>
                    📍 {getDistanceFromUser(location)} away
                  </Text>
                  <Text style={styles.phoneText}>
                    {location.phone ? `📞 ${location.phone}` : '📞 Phone number not available'}
                  </Text>
                  
                  <View style={styles.locationActions}>
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleCall(location.phone)}
                    >
                      <Phone size={14} color="#0073CC" />
                      <Text style={styles.actionText}>Call</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.actionButton}
                      onPress={() => handleGetDirections(location)}
                    >
                      <Navigation size={14} color="#43A047" />
                      <Text style={styles.actionText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
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
  },
  searchContainer: {
    padding: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#E6EEF8',
    marginHorizontal: 4,
    borderRadius: 8,
  },
  activeFilterButton: {
    backgroundColor: '#0073CC',
  },
  filterText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#767676',
  },
  activeFilterText: {
    color: '#FFFFFF',
  },
  locationNote: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#E53935',
    textAlign: 'center',
  },
  errorSubtext: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    textAlign: 'center',
    marginTop: 4,
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  marker: {
    padding: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMarker: {
    borderWidth: 3,
    borderColor: '#FFC107',
    transform: [{ scale: 1.2 }],
  },
  selectedLocationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationsList: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 16,
  },
  locationsScrollView: {
    flex: 1,
  },
  locationsScrollContent: {
    paddingBottom: 20,
  },
  locationCard: {
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
  selectedLocationItem: {
    borderWidth: 2,
    borderColor: '#0073CC',
    backgroundColor: '#F5F7FA',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  availableBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  availableText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    color: '#43A047',
  },
  locationName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 4,
  },
  specialtyText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 4,
  },
  distanceText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
    marginBottom: 4,
  },
  phoneText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 12,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
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
});