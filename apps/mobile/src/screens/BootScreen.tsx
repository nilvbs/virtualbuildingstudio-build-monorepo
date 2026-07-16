import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../lib/api';
import { clearSession, getSession } from '../lib/session';
import { homeForUser } from '../lib/home';
import { colors } from '../lib/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Boot'>;

export function BootScreen({ navigation }: Props) {
  useEffect(() => {
    let active = true;

    async function decide() {
      const session = await getSession();
      if (!session?.accessToken) {
        if (active) navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
        return;
      }
      try {
        const me = await api.me();
        const home = await homeForUser(me);
        if (!active) return;
        navigation.reset({
          index: 0,
          routes: [{ name: home === 'client' ? 'ClientHome' : 'SurveyorHome' }],
        });
      } catch {
        await clearSession();
        if (active) navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
      }
    }

    void decide();
    return () => {
      active = false;
    };
  }, [navigation]);

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/bld-logo-dark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', gap: 24 },
  logo: { width: 160, height: 52 },
});
