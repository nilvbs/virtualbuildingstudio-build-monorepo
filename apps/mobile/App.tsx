import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Satoshi_500Medium: require('./assets/fonts/Satoshi-Medium.ttf'),
    Satoshi_700Bold: require('./assets/fonts/Satoshi-Bold.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
