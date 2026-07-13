import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createClient } from '@surveylink/api-client';

// Android emulator maps host localhost to 10.0.2.2; adjust per platform as needed.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    const client = createClient({ baseUrl: API_URL });
    client
      .health()
      .then((h) => setApiStatus(h.status === 'ok' ? 'up' : 'down'))
      .catch(() => setApiStatus('down'));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Phase 1 · Managed marketplace</Text>
      <Text style={styles.title}>SurveyLink</Text>
      <Text style={styles.body}>
        Connecting clients who need a site survey with independent surveyors.
      </Text>
      <Text style={styles.status}>
        API health: {apiStatus === 'checking' ? 'checking…' : apiStatus}
      </Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  kicker: { color: '#93a1c0', letterSpacing: 2, textTransform: 'uppercase', fontSize: 11 },
  title: { color: '#e8eefc', fontSize: 40, fontWeight: '700', marginTop: 8 },
  body: { color: '#93a1c0', fontSize: 16, textAlign: 'center', marginTop: 12 },
  status: { color: '#34d399', fontSize: 14, marginTop: 24 },
});
