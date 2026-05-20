import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { Calendar, User, Clock, MapPin, X, Search } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useUserRole } from '@/hooks/useUserRole';
import Header from '@/components/common/Header';
import * as Location from 'expo-location';

interface ScheduleDay {
  start: string;
  end: string;
  available: boolean;
}

interface Schedule {
  monday: ScheduleDay;
  tuesday: ScheduleDay;
  wednesday: ScheduleDay;
  thursday: ScheduleDay;
  friday: ScheduleDay;
  saturday: ScheduleDay;
  sunday: ScheduleDay;
}

interface LocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: { latitude: number; longitude: number; address: string }) => void;
  initialLocation?: { latitude: number; longitude: number };
}

const LocationPicker: React.FC<LocationPickerProps> = ({ visible, onClose, onSelect, initialLocation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [mapRegion, setMapRegion] = useState({
    latitude: initialLocation?.latitude || 24.8607,
    longitude: initialLocation?.longitude || 67.0011,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number; longitude: number} | null>(
    initialLocation || null
  );
  const [address, setAddress] = useState('');

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setMapRegion({ ...mapRegion, latitude, longitude });
    
    try {
      const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode[0]) {
        const addr = `${reverseGeocode[0].name || ''} ${reverseGeocode[0].street || ''} ${reverseGeocode[0].city || ''}`.trim();
        setAddress(addr);
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const geocode = await Location.geocodeAsync(searchQuery);
      if (geocode[0]) {
        const { latitude, longitude } = geocode[0];
        setSelectedLocation({ latitude, longitude });
        setMapRegion({ ...mapRegion, latitude, longitude });
        setAddress(searchQuery);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not find location. Please try a different address.');
    }
  };

  const handleSelect = () => {
    if (selectedLocation) {
      onSelect({
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        address: address || 'Selected Location'
      });
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Select Location</Text>
          <TouchableOpacity onPress={onClose}>
            <X size={24} color="#212121" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#757575" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search address or place name"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            region={mapRegion}
            onPress={handleMapPress}
          >
            {selectedLocation && (
              <Marker coordinate={selectedLocation}>
                <View style={styles.marker}>
                  <MapPin size={24} color="#E53935" />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        <View style={styles.locationInfo}>
          <Text style={styles.locationInfoTitle}>Selected Location:</Text>
          <Text style={styles.locationInfoText}>
            {selectedLocation 
              ? `Lat: ${selectedLocation.latitude.toFixed(6)}, Lng: ${selectedLocation.longitude.toFixed(6)}`
              : 'Tap on map to select location'
            }
          </Text>
          {address && <Text style={styles.addressText}>Address: {address}</Text>}
        </View>

        <TouchableOpacity 
          style={[styles.selectButton, !selectedLocation && styles.disabledButton]} 
          onPress={handleSelect}
          disabled={!selectedLocation}
        >
          <Text style={styles.selectButtonText}>Select This Location</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export default function DoctorDashboard() {
  const { userInfo } = useUserRole();
  const [schedule, setSchedule] = useState<Schedule>({
    monday: { start: '09:00', end: '17:00', available: true },
    tuesday: { start: '09:00', end: '17:00', available: true },
    wednesday: { start: '09:00', end: '17:00', available: true },
    thursday: { start: '09:00', end: '17:00', available: true },
    friday: { start: '09:00', end: '17:00', available: true },
    saturday: { start: '10:00', end: '14:00', available: false },
    sunday: { start: '00:00', end: '00:00', available: false }
  });
  const [isAvailable, setIsAvailable] = useState(true);
  const [specialty, setSpecialty] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [latitude, setLatitude] = useState(24.8607);
  const [longitude, setLongitude] = useState(67.0011);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userInfo) {
      setSpecialty(userInfo.specialty || '');
      setLocation(userInfo.location || '');
      setPhone(userInfo.phone || '');
      setLatitude(userInfo.latitude || 24.8607);
      setLongitude(userInfo.longitude || 67.0011);
      setIsAvailable(userInfo.available || false);
      if (userInfo.schedule) {
        // Ensure all days have proper structure
        const loadedSchedule = userInfo.schedule;
        const defaultSchedule = {
          monday: { start: '09:00', end: '17:00', available: true },
          tuesday: { start: '09:00', end: '17:00', available: true },
          wednesday: { start: '09:00', end: '17:00', available: true },
          thursday: { start: '09:00', end: '17:00', available: true },
          friday: { start: '09:00', end: '17:00', available: true },
          saturday: { start: '10:00', end: '14:00', available: false },
          sunday: { start: '00:00', end: '00:00', available: false }
        };
        
        // Merge loaded schedule with defaults
        const mergedSchedule = { ...defaultSchedule };
        Object.keys(mergedSchedule).forEach(day => {
          if (loadedSchedule[day]) {
            mergedSchedule[day as keyof Schedule] = {
              ...mergedSchedule[day as keyof Schedule],
              ...loadedSchedule[day]
            };
          }
        });
        
        setSchedule(mergedSchedule);
      }
    }
  }, [userInfo]);

  const updateSchedule = async (day: keyof Schedule, field: keyof ScheduleDay, value: string | boolean) => {
    const newSchedule = { 
      ...schedule, 
      [day]: { 
        ...schedule[day], 
        [field]: value 
      } 
    };
    setSchedule(newSchedule);
    
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          schedule: newSchedule
        });
        Alert.alert('Success', 'Schedule updated successfully');
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      Alert.alert('Error', 'Failed to update schedule');
    }
  };

  const handleLocationSelect = (locationData: { latitude: number; longitude: number; address: string }) => {
    setLatitude(locationData.latitude);
    setLongitude(locationData.longitude);
    setLocation(locationData.address);
  };

  const updateProfile = async () => {
    if (!phone) {
      Alert.alert('Warning', 'Phone number is required. If you prefer not to share, please enter "Not available"');
      return;
    }

    setIsSaving(true);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          specialty,
          location,
          phone: phone === 'Not available' ? '' : phone,
          latitude,
          longitude,
          available: isAvailable,
          schedule, // Keep schedule data
          updatedAt: new Date().toISOString()
        });
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAvailability = async (value: boolean) => {
    setIsAvailable(value);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          available: value,
          // Keep the existing schedule data
          schedule: schedule
        });
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      Alert.alert('Error', 'Failed to update availability');
      // Revert on error
      setIsAvailable(!value);
    }
  };

  const saveSchedule = async () => {
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          schedule: schedule,
          updatedAt: new Date().toISOString()
        });
        Alert.alert('Success', 'Schedule saved successfully');
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      Alert.alert('Error', 'Failed to save schedule');
    }
  };

  return (
    <View style={styles.container}>
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        initialLocation={{ latitude, longitude }}
      />
      
      <Header 
        title="Doctor Dashboard" 
        showBack={true}
        showLogout={true}
      />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.summaryCards}>
            <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
              <View style={styles.summaryContent}>
                <Text style={styles.summaryLabel}>Weekly Schedule</Text>
                <Text style={styles.summaryText}>Manage your availability</Text>
              </View>
              <View style={[styles.summaryIconContainer, { backgroundColor: '#BBDEFB' }]}>
                <Calendar size={24} color="#0073CC" />
              </View>
            </View>
          </View>

          <View style={styles.profileSection}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Specialty</Text>
              <TextInput
                style={styles.input}
                value={specialty}
                onChangeText={setSpecialty}
                placeholder="e.g., Cardiologist, Pediatrician"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter phone number or 'Not available'"
                keyboardType="phone-pad"
              />
              <Text style={styles.helperText}>
                {phone === '' ? 'Will display: Phone number not available' : ''}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Clinic Location</Text>
              <TouchableOpacity 
                style={styles.locationSelector}
                onPress={() => setShowLocationPicker(true)}
              >
                <MapPin size={20} color="#0073CC" />
                <Text style={styles.locationSelectorText}>
                  {location || 'Tap to select location on map'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.coordinatesText}>
                Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
              </Text>
            </View>

            <TouchableOpacity 
              style={[styles.updateButton, isSaving && styles.disabledButton]} 
              onPress={updateProfile}
              disabled={isSaving}
            >
              <Text style={styles.updateButtonText}>
                {isSaving ? 'Saving...' : 'Update Profile'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.availabilityContainer}>
            <View style={styles.availabilityHeader}>
              <Text style={styles.availabilityTitle}>Your Availability</Text>
              <Switch
                value={isAvailable}
                onValueChange={handleToggleAvailability}
                trackColor={{ false: '#D1D1D1', true: '#9ED0FF' }}
                thumbColor={isAvailable ? '#0073CC' : '#F4F3F4'}
              />
            </View>
            <Text style={styles.availabilityStatus}>
              {isAvailable ? 'You are currently available' : 'You are currently unavailable'}
            </Text>
          </View>

          <View style={styles.scheduleSection}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.sectionTitle}>Weekly Schedule</Text>
              <TouchableOpacity style={styles.saveScheduleButton} onPress={saveSchedule}>
                <Text style={styles.saveScheduleButtonText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
            
            {Object.entries(schedule).map(([day, times]) => (
              <View key={day} style={styles.scheduleDay}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayName}>{day.charAt(0).toUpperCase() + day.slice(1)}</Text>
                  <Switch
                    value={times.available}
                    onValueChange={(value) => updateSchedule(day as keyof Schedule, 'available', value)}
                    trackColor={{ false: '#D1D1D1', true: '#9ED0FF' }}
                    thumbColor={times.available ? '#0073CC' : '#F4F3F4'}
                  />
                </View>
                
                {times.available && (
                  <View style={styles.timeInputs}>
                    <View style={styles.timeInput}>
                      <Clock size={16} color="#757575" />
                      <TextInput
                        style={styles.timeInputField}
                        value={times.start}
                        onChangeText={(value) => updateSchedule(day as keyof Schedule, 'start', value)}
                        placeholder="09:00"
                      />
                    </View>
                    <Text style={styles.timeSeparator}>to</Text>
                    <View style={styles.timeInput}>
                      <Clock size={16} color="#757575" />
                      <TextInput
                        style={styles.timeInputField}
                        value={times.end}
                        onChangeText={(value) => updateSchedule(day as keyof Schedule, 'end', value)}
                        placeholder="17:00"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  summaryText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#424242',
    marginTop: 4,
  },
  summaryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginTop: 4,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  locationSelectorText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#212121',
    marginLeft: 8,
    flex: 1,
  },
  coordinatesText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginTop: 4,
  },
  updateButton: {
    backgroundColor: '#0073CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  availabilityContainer: {
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
  availabilityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  availabilityStatus: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#43A047',
    marginBottom: 12,
  },
  scheduleSection: {
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
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  saveScheduleButton: {
    backgroundColor: '#43A047',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveScheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  scheduleDay: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayName: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#212121',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 8,
    flex: 1,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  timeInputField: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#212121',
  },
  timeSeparator: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginHorizontal: 8,
  },
  // Location Picker Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#212121',
  },
  searchButton: {
    backgroundColor: '#0073CC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  mapContainer: {
    height: 300,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  locationInfoTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 8,
  },
  locationInfoText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#424242',
    fontStyle: 'italic',
  },
  selectButton: {
    margin: 16,
    backgroundColor: '#0073CC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
});