import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, Alert } from 'react-native';
import { Phone, Ambulance, TriangleAlert as AlertTriangle } from 'lucide-react-native';
import Header from '@/components/common/Header';

export default function EmergencyScreen() {
  const callEmergency = async (phoneNumber: string) => {
    const canOpenURL = await Linking.canOpenURL(`tel:${phoneNumber}`);
    
    if (canOpenURL) {
      await Linking.openURL(`tel:${phoneNumber}`);
    } else {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Emergency Contact',
          `Please call the emergency number: ${phoneNumber}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'Your device cannot make phone calls',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <View style={styles.container}>
      <Header 
        title="Emergency Services" 
        showBack={true}
      />
      
      <View style={styles.content}>
        <View style={styles.emergencyCard}>
          <AlertTriangle size={40} color="#E53935" />
          <Text style={styles.emergencyTitle}>Medical Emergency?</Text>
          <Text style={styles.emergencyDescription}>
            Tap the button below to call for an ambulance immediately. Emergency services are available 24/7.
          </Text>
          
          <TouchableOpacity 
            style={styles.callButton}
            onPress={() => callEmergency('1122')}
            activeOpacity={0.8}
          >
            <Phone size={24} color="#FFFFFF" />
            <Text style={styles.callButtonText}>Call Ambulance (1122)</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Emergency Services</Text>
        
        <View style={styles.serviceCard}>
          <View style={styles.serviceIconContainer}>
            <Ambulance size={24} color="#0073CC" />
          </View>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>Ambulance Service</Text>
            <Text style={styles.serviceDescription}>For medical emergencies requiring immediate transport</Text>
            <TouchableOpacity 
              style={styles.serviceButton}
              onPress={() => callEmergency('1122')}
            >
              <Text style={styles.serviceButtonText}>Call 1122</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.serviceCard}>
          <View style={styles.serviceIconContainer}>
            <Phone size={24} color="#0073CC" />
          </View>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceName}>Medical Helpline</Text>
            <Text style={styles.serviceDescription}>For medical advice and non-emergency situations</Text>
            <TouchableOpacity 
              style={styles.serviceButton}
              onPress={() => callEmergency('1035')}
            >
              <Text style={styles.serviceButtonText}>Call 1035</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>When to call an ambulance:</Text>
          <Text style={styles.infoText}>• Severe chest pain or difficulty breathing</Text>
          <Text style={styles.infoText}>• Severe bleeding or burns</Text>
          <Text style={styles.infoText}>• Sudden, severe headache or loss of consciousness</Text>
          <Text style={styles.infoText}>• Suspected stroke or heart attack</Text>
          <Text style={styles.infoText}>• Major injuries from accidents</Text>
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
    padding: 16,
  },
  emergencyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FFCDD2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  emergencyTitle: {
    fontSize: 22,
    fontFamily: 'Poppins-Bold',
    color: '#E53935',
    marginTop: 12,
    marginBottom: 8,
  },
  emergencyDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#424242',
    textAlign: 'center',
    marginBottom: 24,
  },
  callButton: {
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 30,
    width: '100%',
  },
  callButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 16,
  },
  serviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E6EEF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#757575',
    marginBottom: 12,
  },
  serviceButton: {
    backgroundColor: '#E6EEF8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  serviceButtonText: {
    color: '#0073CC',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  infoBox: {
    backgroundColor: '#FFF9C4',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#212121',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#424242',
    marginBottom: 4,
    lineHeight: 22,
  },
});