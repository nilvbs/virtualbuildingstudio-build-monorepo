import { Linking } from 'react-native';
import type { GeoPoint } from '@surveylink/types';

/** Opens Google Street View (app if installed, else browser) at the closest panorama to the point. */
export function openStreetView(point: GeoPoint | null): void {
  if (!point) return;
  void Linking.openURL(
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${point.lat},${point.lng}`,
  );
}
