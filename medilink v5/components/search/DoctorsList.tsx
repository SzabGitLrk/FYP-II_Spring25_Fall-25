import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { MapPin, Clock, Star } from 'lucide-react-native';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/config/firebase';

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  image: string;
  location: string;
  available: boolean;
  schedule: any;
  rating: number;
};

export default function DoctorsList({ searchQuery }: { searchQuery: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    // Real-time listener for doctors
    const q = query(collection(db, 'users'), where('role', '==', 'doctor'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const doctorsData: Doctor[] = [];
      querySnapshot.forEach((doc) => {
        doctorsData.push({ id: doc.id, ...doc.data() } as Doctor);
      });
      setDoctors(doctorsData);
    });

    return unsubscribe;
  }, []);

  const filteredDoctors = doctors.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.specialty.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  return (
    <FlatList
      data={filteredDoctors}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Image 
            source={{ uri: item.image || 'https://via.placeholder.com/100' }} 
            style={styles.image} 
          />
          <View style={styles.info}>
            <View style={styles.header}>
              <Text style={styles.name}>{item.name}</Text>
              <View style={[
                styles.availabilityBadge,
                { backgroundColor: isDoctorAvailable(item) ? '#E8F5E9' : '#FFEBEE' }
              ]}>
                <Text style={[
                  styles.availabilityText,
                  { color: isDoctorAvailable(item) ? '#43A047' : '#E53935' }
                ]}>
                  {isDoctorAvailable(item) ? 'Available' : 'Unavailable'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.specialty}>{item.specialty}</Text>
            
            <View style={styles.details}>
              <View style={styles.detailItem}>
                <MapPin size={14} color="#757575" />
                <Text style={styles.detailText}>{item.location}</Text>
              </View>
              
              <View style={styles.detailItem}>
                <Star size={14} color="#FFC107" />
                <Text style={styles.detailText}>{item.rating || '4.5'}</Text>
              </View>
            </View>

            {item.schedule && (
              <View style={styles.schedule}>
                <Clock size={14} color="#757575" />
                <Text style={styles.scheduleText}>
                  Today: {item.schedule[new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()]?.start || 'N/A'} - 
                  {item.schedule[new Date().toLocaleDateString('en', { weekday: 'long' }).toLowerCase()]?.end || 'N/A'}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
    flex: 1,
  },
  availabilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 10,
    fontWeight: '500',
  },
  specialty: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 8,
  },
  details: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
  schedule: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleText: {
    fontSize: 12,
    color: '#757575',
    marginLeft: 4,
  },
});