import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CommonActions, useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthenticatedUser } from '@surveylink/types';
import { api } from '../lib/api';
import { clearSession, getActiveRole } from '../lib/session';
import { colors, radius, shadows, spacing } from '../lib/theme';
import type { RootStackParamList } from '../navigation/types';

type Props = {
  /** Logout only on home screens (client Projects / surveyor Dashboard). */
  showLogout?: boolean;
  /** Account menu with Personal profile + Sign out. */
  showAccountMenu?: boolean;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function avatarUrl(value: string | null | undefined): string | null {
  return /^(https?:\/\/|\/)/.test(value ?? '') ? value! : null;
}

export function AppHeader({ showLogout = false, showAccountMenu = false }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const loadUser = useCallback(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [loadUser]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('bld:user-updated', loadUser);
    return () => sub.remove();
  }, [loadUser]);

  async function signOut() {
    setMenuOpen(false);
    await clearSession();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Landing' }],
      }),
    );
  }

  async function openPersonalProfile() {
    setMenuOpen(false);
    const role = (await getActiveRole()) ?? 'surveyor';
    navigation.navigate('PersonalProfile', { role });
  }

  const showMenu = showAccountMenu || showLogout;
  const photo = avatarUrl(user?.avatarKey);

  return (
    <View style={styles.topbar}>
      <Image
        source={require('../../assets/bld-logo-dark.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      {showMenu ? (
        <Pressable
          style={styles.avatarBtn}
          hitSlop={8}
          accessibilityLabel="Account menu"
          onPress={() => setMenuOpen(true)}
        >
          {photo ? (
            <Image source={{ uri: photo }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{user ? initials(user.fullName) : '·'}</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <Pressable style={styles.menuItem} onPress={() => void openPersonalProfile()}>
              <Feather name="user" size={16} color={colors.navy} />
              <Text style={styles.menuText}>Personal profile</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={() => void signOut()}>
              <Feather name="log-out" size={16} color={colors.muted} />
              <Text style={styles.menuText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.ice, fontSize: 13, fontWeight: '800' },
  spacer: { width: 38, height: 38 },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.28)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 64,
    paddingRight: spacing.xl,
  },
  menu: {
    minWidth: 200,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuText: { color: colors.text, fontWeight: '700', fontSize: 14 },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },
});
