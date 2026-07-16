import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { colors } from '../lib/theme';
import { BootScreen } from '../screens/BootScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProjectsScreen } from '../screens/client/ProjectsScreen';
import { ClientProfileScreen } from '../screens/client/ProfileScreen';
import { ProjectDetailScreen } from '../screens/client/ProjectDetailScreen';
import { DashboardScreen } from '../screens/surveyor/DashboardScreen';
import { ProfileScreen } from '../screens/surveyor/ProfileScreen';
import { MatchesScreen } from '../screens/surveyor/MatchesScreen';
import type { ClientTabParamList, RootStackParamList, SurveyorTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const SurveyorTab = createBottomTabNavigator<SurveyorTabParamList>();

const CLIENT_TAB_ICONS: Record<keyof ClientTabParamList, keyof typeof Feather.glyphMap> = {
  Projects: 'folder',
  Profile: 'user',
};

const SURVEYOR_TAB_ICONS: Record<keyof SurveyorTabParamList, keyof typeof Feather.glyphMap> = {
  Dashboard: 'grid',
  Matches: 'zap',
  Profile: 'user',
};

const tabScreenOptions = {
  headerShown: false,
  lazy: false,
  unmountOnBlur: false,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: colors.faint,
  tabBarStyle: {
    backgroundColor: colors.panel,
    borderTopColor: colors.border,
    height: Platform.OS === 'ios' ? 86 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
  },
  tabBarLabelStyle: { fontSize: 11.5, fontWeight: '700' as const },
};

function ClientHome() {
  return (
    <ClientTab.Navigator
      initialRouteName="Projects"
      screenOptions={({ route }) => ({
        ...tabScreenOptions,
        tabBarIcon: ({ color, size, focused }) => (
          <Feather
            name={CLIENT_TAB_ICONS[route.name] ?? 'circle'}
            size={size - 2}
            color={focused ? colors.accent2 : color}
          />
        ),
      })}
    >
      <ClientTab.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Projects' }} />
      <ClientTab.Screen name="Profile" component={ClientProfileScreen} options={{ title: 'Profile' }} />
    </ClientTab.Navigator>
  );
}

function SurveyorHome() {
  return (
    <SurveyorTab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        ...tabScreenOptions,
        tabBarIcon: ({ color, size, focused }) => (
          <Feather
            name={SURVEYOR_TAB_ICONS[route.name] ?? 'circle'}
            size={size - 2}
            color={focused ? colors.accent2 : color}
          />
        ),
      })}
    >
      <SurveyorTab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <SurveyorTab.Screen name="Matches" component={MatchesScreen} options={{ title: 'Matches' }} />
      <SurveyorTab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </SurveyorTab.Navigator>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.page,
    primary: colors.accent,
    card: colors.panel,
    text: colors.text,
    border: colors.border,
  },
};

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator initialRouteName="Boot" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Boot" component={BootScreen} />
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="ClientHome" component={ClientHome} />
        <Stack.Screen name="SurveyorHome" component={SurveyorHome} />
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
