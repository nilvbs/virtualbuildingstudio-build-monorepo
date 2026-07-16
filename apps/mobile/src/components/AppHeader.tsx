import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CommonActions, useNavigation } from '@react-navigation/native';
import { clearSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

type Props = {
  /** Logout only on home screens (client Projects / surveyor Dashboard). */
  showLogout?: boolean;
};

export function AppHeader({ showLogout = false }: Props) {
  const navigation = useNavigation();

  async function signOut() {
    await clearSession();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Landing' }],
      }),
    );
  }

  return (
    <View style={styles.topbar}>
      <Image
        source={require('../../assets/bld-logo-dark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {showLogout ? (
        <Pressable style={styles.iconBtn} hitSlop={8} onPress={() => void signOut()}>
          <Feather name="log-out" size={18} color={colors.muted} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.panel,
  },
  logo: { width: 104, height: 32 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: 38, height: 38 },
});
