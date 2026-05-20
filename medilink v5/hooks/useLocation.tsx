import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { Alert } from 'react-native';

interface LocationState {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export default function useLocation() {
  const [location, setLocation] = useState<LocationState>({
    latitude: 24.8607, // Default to Karachi coordinates
    longitude: 67.0011,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        setIsLoading(true);
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== 'granted') {
          if (isMounted) {
            setErrorMsg('Permission to access location was denied. Using default location.');
            setIsLoading(false);
          }
          return;
        }

        // Remove the timeout option as it's not supported
        let currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        if (isMounted) {
          setLocation({
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
          setErrorMsg('');
          setIsLoading(false);
        }
      } catch (error) {
        console.log('Error getting location:', error);
        if (isMounted) {
          setErrorMsg('Unable to get your current location. Using default location.');
          setIsLoading(false);
        }
      }
    })();

    // Cleanup function to prevent state updates on unmounted component
    return () => {
      isMounted = false;
    };
  }, []);

  return { location, errorMsg, isLoading };
}