import * as Location from 'expo-location';

/**
 * Posición GPS para registrar llegadas, recogidas y entregas (o null si no hay
 * permiso). Usa la última conocida si la nueva tarda, para no frenar el paso.
 */
export async function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const fresh = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    const position = (await Promise.race([fresh, timeout])) ?? (await Location.getLastKnownPositionAsync());
    return position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;
  } catch {
    return null;
  }
}
