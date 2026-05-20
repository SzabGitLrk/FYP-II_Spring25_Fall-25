import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { MapPin, Pill, CircleCheck as CheckCircle, Clock } from 'lucide-react-native';

interface MedicinesListProps {
  searchQuery: string;
}

export default function MedicinesList({ searchQuery }: MedicinesListProps) {
  // Mock data for medicines
  const medicines = [
    {
      id: 1,
      name: 'Paracetamol 500mg',
      category: 'Pain Relief',
      price: 'PKR500',
      inStock: true,
      pharmacies: [
        { id: 1, name: 'Central Pharmacy', distance: '0.3 miles', available: true },
        { id: 2, name: 'MediPlus', distance: '1.2 miles', available: true },
        { id: 3, name: 'HealthMart', distance: '2.0 miles', available: true },
      ],
    },
    {
      id: 2,
      name: 'Amoxicillin 250mg',
      category: 'Antibiotics',
      price: 'PKR500',
      inStock: true,
      pharmacies: [
        { id: 1, name: 'Central Pharmacy', distance: '0.3 miles', available: true },
        { id: 2, name: 'MediPlus', distance: '1.2 miles', available: false },
      ],
    },
    {
      id: 3,
      name: 'Loratadine 10mg',
      category: 'Allergy Relief',
      price: 'PKR600',
      inStock: true,
      pharmacies: [
        { id: 2, name: 'MediPlus', distance: '1.2 miles', available: true },
        { id: 3, name: 'HealthMart', distance: '2.0 miles', available: true },
      ],
    },
    {
      id: 4,
      name: 'Metformin 500mg',
      category: 'Diabetes',
      price: 'PKR400',
      inStock: false,
      pharmacies: [
        { id: 1, name: 'Central Pharmacy', distance: '0.3 miles', available: false },
        { id: 3, name: 'HealthMart', distance: '2.0 miles', available: false },
      ],
    },
    {
      id: 5,
      name: 'Ibuprofen 200mg',
      category: 'Pain Relief',
      price: 'PKR900',
      inStock: true,
      pharmacies: [
        { id: 1, name: 'Jeay Sindh', distance: '0.3 KM', available: true },
        { id: 2, name: 'Dileep Store', distance: '1.2 KM', available: true },
      ],
    },
  ];

  // Filter medicines based on search query
  const filteredMedicines = medicines.filter(medicine => 
    medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    medicine.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderMedicineCard = ({ item }: { item: (typeof medicines)[0] }) => {
    const availablePharmacies = item.pharmacies.filter(pharmacy => pharmacy.available);
    
    return (
      <View style={styles.medicineCard}>
        <View style={styles.medicineHeader}>
          <View style={styles.medicineIconContainer}>
            <Pill size={24} color="#0073CC" />
          </View>
          <View style={styles.medicineInfo}>
            <Text style={styles.medicineName}>{item.name}</Text>
            <Text style={styles.medicineCategory}>{item.category}</Text>
            <Text style={styles.medicinePrice}>{item.price}</Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.inStock ? styles.inStockBadge : styles.outOfStockBadge
          ]}>
            <Text style={[
              styles.statusText,
              item.inStock ? styles.inStockText : styles.outOfStockText
            ]}>
              {item.inStock ? 'In Stock' : 'Out of Stock'}
            </Text>
          </View>
        </View>
        
        <View style={styles.pharmaciesContainer}>
          <Text style={styles.pharmaciesTitle}>Available at:</Text>
          
          {availablePharmacies.length > 0 ? (
            availablePharmacies.slice(0, 2).map(pharmacy => (
              <View key={pharmacy.id} style={styles.pharmacyItem}>
                <View style={styles.pharmacyInfo}>
                  <CheckCircle size={16} color="#43A047" />
                  <Text style={styles.pharmacyName}>{pharmacy.name}</Text>
                </View>
                <View style={styles.pharmacyDistance}>
                  <MapPin size={14} color="#757575" />
                  <Text style={styles.distanceText}>{pharmacy.distance}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.unavailableContainer}>
              <Clock size={16} color="#E53935" />
              <Text style={styles.unavailableText}>Currently unavailable at nearby pharmacies</Text>
            </View>
          )}
          
          {availablePharmacies.length > 2 && (
            <TouchableOpacity style={styles.morePharmaciesButton}>
              <Text style={styles.morePharmaciesText}>+{availablePharmacies.length - 2} more pharmacies</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.detailsButton}>
            <Text style={styles.detailsButtonText}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity 
          
            disabled={!item.inStock}
          >
            <Text style={[
              styles.reserveButtonText,
              !item.inStock && styles.disabledButtonText
            ]}>
              
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {filteredMedicines.length > 0 ? (
        <FlatList
          data={filteredMedicines}
          renderItem={renderMedicineCard}
          keyExtractor={(item) => item.id.toString()}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No medicines found matching "{searchQuery}"</Text>
          <Text style={styles.emptySubtext}>Try different keywords or browse all medicines</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 16,
  },
  medicineCard: {
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
  medicineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  medicineIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    color: '#212121',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inStockBadge: {
    backgroundColor: '#E8F5E9',
  },
  outOfStockBadge: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
  inStockText: {
    color: '#43A047',
  },
  outOfStockText: {
    color: '#E53935',
  },
  pharmaciesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginBottom: 16,
  },
  pharmaciesTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#212121',
    marginBottom: 8,
  },
  pharmacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pharmacyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pharmacyName: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#212121',
    marginLeft: 8,
  },
  pharmacyDistance: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 12,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginLeft: 4,
  },
  unavailableContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  unavailableText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#E53935',
    marginLeft: 8,
  },
  morePharmaciesButton: {
    marginTop: 4,
  },
  morePharmaciesText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailsButton: {
    flex: 1,
    backgroundColor: '#E6EEF8',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  detailsButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#0073CC',
  },
  reserveButton: {
    flex: 2,
    backgroundColor: '#0073CC',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  reserveButtonText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#ECEFF1',
  },
  disabledButtonText: {
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    textAlign: 'center',
  },
});