import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { Search, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, CirclePlus as PlusCircle, TrendingUp, X, MapPin } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import Header from '@/components/common/Header';
import * as Location from 'expo-location';

interface Medicine {
  id: string;
  name: string;
  category: string;
  price: string;
  stock: number;
  description?: string;
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
          <Text style={styles.modalTitle}>Select Pharmacy Location</Text>
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

export default function PharmacistDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: '',
    location: '',
    phone: '',
    latitude: 24.8607,
    longitude: 67.0011
  });
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    category: '',
    price: '',
    stock: 0,
    description: ''
  });

  useEffect(() => {
    if (auth.currentUser) {
      loadPharmacyData();
      const unsubscribe = onSnapshot(
        doc(db, 'pharmacies', auth.currentUser.uid),
        (doc) => {
          if (doc.exists()) {
            const pharmacyData = doc.data();
            setMedicines(pharmacyData.medicines || []);
            setPharmacyInfo({
              name: pharmacyData.name || '',
              location: pharmacyData.location || '',
              phone: pharmacyData.phone || '',
              latitude: pharmacyData.latitude || 24.8607,
              longitude: pharmacyData.longitude || 67.0011
            });
          }
        }
      );
      return unsubscribe;
    }
  }, []);

  const loadPharmacyData = async () => {
    try {
      if (auth.currentUser) {
        const pharmacyDoc = await getDoc(doc(db, 'pharmacies', auth.currentUser.uid));
        if (!pharmacyDoc.exists()) {
          await updateDoc(doc(db, 'pharmacies', auth.currentUser.uid), {
            name: '',
            location: '',
            phone: '',
            medicines: [],
            latitude: 24.8607,
            longitude: 67.0011,
            ownerId: auth.currentUser.uid,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (error) {
      console.error('Error loading pharmacy data:', error);
    }
  };

  const handleLocationSelect = (locationData: { latitude: number; longitude: number; address: string }) => {
    setPharmacyInfo({
      ...pharmacyInfo,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      location: locationData.address
    });
  };

  const updatePharmacyInfo = async () => {
    if (!pharmacyInfo.phone) {
      Alert.alert('Warning', 'Phone number is required. If you prefer not to share, please enter "Not available"');
      return;
    }

    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'pharmacies', auth.currentUser.uid), {
          name: pharmacyInfo.name,
          location: pharmacyInfo.location,
          phone: pharmacyInfo.phone === 'Not available' ? '' : pharmacyInfo.phone,
          latitude: pharmacyInfo.latitude,
          longitude: pharmacyInfo.longitude,
          updatedAt: new Date().toISOString()
        });
        Alert.alert('Success', 'Pharmacy information updated successfully');
      }
    } catch (error) {
      console.error('Error updating pharmacy info:', error);
      Alert.alert('Error', 'Failed to update pharmacy information');
    }
  };

  const addMedicine = async () => {
    if (!newMedicine.name || !newMedicine.category || !newMedicine.price) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    // Format price with Rs prefix
    const formattedPrice = newMedicine.price.startsWith('Rs ') 
      ? newMedicine.price 
      : `Rs ${newMedicine.price}`;

    try {
      const pharmacyRef = doc(db, 'pharmacies', auth.currentUser!.uid);
      const pharmacyDoc = await getDoc(pharmacyRef);
      
      if (pharmacyDoc.exists()) {
        const currentMedicines = pharmacyDoc.data().medicines || [];
        const updatedMedicines = [...currentMedicines, {
          id: Date.now().toString(),
          ...newMedicine,
          price: formattedPrice,
          stock: parseInt(newMedicine.stock.toString()) || 0
        }];

        await updateDoc(pharmacyRef, {
          medicines: updatedMedicines
        });

        setNewMedicine({ name: '', category: '', price: '', stock: 0, description: '' });
        setShowAddMedicine(false);
        Alert.alert('Success', 'Medicine added successfully');
      }
    } catch (error) {
      console.error('Error adding medicine:', error);
      Alert.alert('Error', 'Failed to add medicine');
    }
  };

  const updateStock = async (medicineId: string, newStock: number) => {
    try {
      const pharmacyRef = doc(db, 'pharmacies', auth.currentUser!.uid);
      const pharmacyDoc = await getDoc(pharmacyRef);
      
      if (pharmacyDoc.exists()) {
        const currentMedicines = pharmacyDoc.data().medicines || [];
        const updatedMedicines = currentMedicines.map((med: Medicine) =>
          med.id === medicineId ? { ...med, stock: newStock } : med
        );

        await updateDoc(pharmacyRef, {
          medicines: updatedMedicines
        });
      }
    } catch (error) {
      console.error('Error updating stock:', error);
      Alert.alert('Error', 'Failed to update stock');
    }
  };

  const deleteMedicine = async (medicineId: string) => {
    Alert.alert(
      'Delete Medicine',
      'Are you sure you want to delete this medicine?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const pharmacyRef = doc(db, 'pharmacies', auth.currentUser!.uid);
              const pharmacyDoc = await getDoc(pharmacyRef);
              
              if (pharmacyDoc.exists()) {
                const currentMedicines = pharmacyDoc.data().medicines || [];
                const updatedMedicines = currentMedicines.filter((med: Medicine) => med.id !== medicineId);

                await updateDoc(pharmacyRef, {
                  medicines: updatedMedicines
                });

                Alert.alert('Success', 'Medicine deleted successfully');
              }
            } catch (error) {
              console.error('Error deleting medicine:', error);
              Alert.alert('Error', 'Failed to delete medicine');
            }
          },
        },
      ]
    );
  };

  const lowStockItems = medicines.filter(med => med.stock < 10);
  const filteredMedicines = medicines.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    med.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <LocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSelect={handleLocationSelect}
        initialLocation={{ latitude: pharmacyInfo.latitude, longitude: pharmacyInfo.longitude }}
      />

      <Modal visible={showAddMedicine} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add New Medicine</Text>
            <TouchableOpacity onPress={() => setShowAddMedicine(false)}>
              <X size={24} color="#212121" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Medicine Name *</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.name}
              onChangeText={(text) => setNewMedicine({...newMedicine, name: text})}
              placeholder="Enter medicine name"
            />

            <Text style={styles.inputLabel}>Category *</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.category}
              onChangeText={(text) => setNewMedicine({...newMedicine, category: text})}
              placeholder="e.g., Pain Relief, Antibiotics"
            />

            <Text style={styles.inputLabel}>Price *</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.price}
              onChangeText={(text) => setNewMedicine({...newMedicine, price: text})}
              placeholder="e.g., 500 (will display as Rs 500)"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Stock Quantity *</Text>
            <TextInput
              style={styles.input}
              value={newMedicine.stock.toString()}
              onChangeText={(text) => setNewMedicine({...newMedicine, stock: parseInt(text) || 0})}
              placeholder="Enter stock quantity"
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newMedicine.description}
              onChangeText={(text) => setNewMedicine({...newMedicine, description: text})}
              placeholder="Enter medicine description"
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.addButton} onPress={addMedicine}>
              <Text style={styles.addButtonText}>Add Medicine</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Header 
        title="Pharmacist Dashboard" 
        showBack={true}
        showLogout={true}
      />

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Pharmacy Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pharmacy Name</Text>
              <TextInput
                style={styles.input}
                value={pharmacyInfo.name}
                onChangeText={(text) => setPharmacyInfo({...pharmacyInfo, name: text})}
                placeholder="Enter pharmacy name"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={pharmacyInfo.phone}
                onChangeText={(text) => setPharmacyInfo({...pharmacyInfo, phone: text})}
                placeholder="Enter phone number or 'Not available'"
                keyboardType="phone-pad"
              />
              <Text style={styles.helperText}>
                {pharmacyInfo.phone === '' ? 'Will display: Phone number not available' : ''}
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Pharmacy Location</Text>
              <TouchableOpacity 
                style={styles.locationSelector}
                onPress={() => setShowLocationPicker(true)}
              >
                <MapPin size={20} color="#0073CC" />
                <Text style={styles.locationSelectorText}>
                  {pharmacyInfo.location || 'Tap to select location on map'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.coordinatesText}>
                Coordinates: {pharmacyInfo.latitude.toFixed(6)}, {pharmacyInfo.longitude.toFixed(6)}
              </Text>
            </View>

            <TouchableOpacity style={styles.updateButton} onPress={updatePharmacyInfo}>
              <Text style={styles.updateButtonText}>Update Pharmacy Info</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Search size={20} color="#757575" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search medicine inventory..."
                placeholderTextColor="#9E9E9E"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <TouchableOpacity 
              style={styles.addFloatingButton}
              onPress={() => setShowAddMedicine(true)}
            >
              <PlusCircle size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryCards}>
            <View style={[styles.summaryCard, { backgroundColor: '#FFEBEE' }]}>
              <AlertTriangle size={20} color="#E53935" />
              <Text style={[styles.summaryCardTitle, { color: '#C62828' }]}>Low Stock</Text>
              <Text style={styles.summaryCardNumber}>{lowStockItems.length}</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#E8F5E9' }]}>
              <CheckCircle size={20} color="#43A047" />
              <Text style={[styles.summaryCardTitle, { color: '#2E7D32' }]}>Total Medicines</Text>
              <Text style={styles.summaryCardNumber}>{medicines.length}</Text>
            </View>
            
            <View style={[styles.summaryCard, { backgroundColor: '#E3F2FD' }]}>
              <TrendingUp size={20} color="#0073CC" />
              <Text style={[styles.summaryCardTitle, { color: '#0073CC' }]}>In Stock</Text>
              <Text style={styles.summaryCardNumber}>
                {medicines.filter(med => med.stock > 0).length}
              </Text>
            </View>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Medicine Inventory ({medicines.length})</Text>
            
            {filteredMedicines.length > 0 ? (
              filteredMedicines.map((medicine) => (
                <View key={medicine.id} style={styles.medicineItem}>
                  <View style={styles.medicineInfo}>
                    <Text style={styles.medicineName}>{medicine.name}</Text>
                    <Text style={styles.medicineCategory}>{medicine.category}</Text>
                    <Text style={styles.medicinePrice}>
                      {medicine.price.startsWith('Rs ') ? medicine.price : `Rs ${medicine.price}`}
                    </Text>
                    {medicine.description && (
                      <Text style={styles.medicineDescription}>{medicine.description}</Text>
                    )}
                  </View>
                  
                  <View style={styles.stockControls}>
                    <Text style={styles.stockLabel}>Stock:</Text>
                    <View style={styles.stockButtons}>
                      <TouchableOpacity 
                        style={styles.stockButton}
                        onPress={() => updateStock(medicine.id, medicine.stock - 1)}
                        disabled={medicine.stock <= 0}
                      >
                        <Text style={styles.stockButtonText}>-</Text>
                      </TouchableOpacity>
                      
                      <Text style={[
                        styles.stockCount,
                        medicine.stock < 10 && styles.lowStock
                      ]}>
                        {medicine.stock}
                      </Text>
                      
                      <TouchableOpacity 
                        style={styles.stockButton}
                        onPress={() => updateStock(medicine.id, medicine.stock + 1)}
                      >
                        <Text style={styles.stockButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.deleteButton}
                      onPress={() => deleteMedicine(medicine.id)}
                    >
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No medicines found</Text>
                <Text style={styles.emptyStateSubtext}>Add your first medicine to get started</Text>
              </View>
            )}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#212121',
    fontFamily: 'Poppins-Regular',
  },
  addFloatingButton: {
    width: 44,
    height: 44,
    backgroundColor: '#0073CC',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  summaryCard: {
    width: '31%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryCardTitle: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
    marginTop: 4,
  },
  summaryCardNumber: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#212121',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
  },
  modalContent: {
    flex: 1,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  addButton: {
    backgroundColor: '#0073CC',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  medicineItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
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
  medicineDescription: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginTop: 4,
  },
  stockControls: {
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 4,
  },
  stockButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0073CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  stockCount: {
    marginHorizontal: 8,
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#212121',
  },
  lowStock: {
    color: '#E53935',
  },
  deleteButton: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#E53935',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
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
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#9E9E9E',
    textAlign: 'center',
  },
  // Location Picker Styles
  searchButton: {
    backgroundColor: '#0073CC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    marginLeft: 8,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
  },
  mapContainer: {
    height: 300,
    marginVertical: 16,
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
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
  },
});