import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { colors } from '../lib/theme';
import { BootScreen } from '../screens/BootScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProjectsScreen } from '../screens/client/ProjectsScreen';
import { PersonalProfileScreen } from '../screens/PersonalProfileScreen';
import { ProjectDetailScreen } from '../screens/client/ProjectDetailScreen';
import { DashboardScreen } from '../screens/surveyor/DashboardScreen';
import { ProfileScreen as PortfolioScreen } from '../screens/surveyor/ProfileScreen';
import { MatchesScreen } from '../screens/surveyor/MatchesScreen';
import type { ClientTabParamList, RootStackParamList, SurveyorTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ClientTab = createBottomTabNavigator<ClientTabParamList>();
const SurveyorTab = createBottomTabNavigator<SurveyorTabParamList>();

const CLIENT_TAB_ICONS: Record<keyof ClientTabParamList, keyof typeof Feather.glyphMap> = {
  Projects: 'folder',
  PersonalProfile: 'user',
};

const SURVEYOR_TAB_ICONS: Record<keyof SurveyorTabParamList, keyof typeof Feather.glyphMap> = {
  Dashboard: 'grid',
  Matches: 'zap',
  Portfolio: 'briefcase',
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

function ClientPersonalProfileTab() {
  return <PersonalProfileScreen role="client" />;
}

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
      <ClientTab.Screen
        name="PersonalProfile"
        component={ClientPersonalProfileTab}
        options={{ title: 'Profile' }}
      />
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
      <SurveyorTab.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'Portfolio' }} />
    </SurveyorTab.Navigator>
  );
}

function StackPersonalProfile({
  route,
}: NativeStackScreenProps<RootStackParamList, 'PersonalProfile'>) {
  return <PersonalProfileScreen role={route.params.role} />;
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
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="ClientHome" component={ClientHome} />
        <Stack.Screen name="SurveyorHome" component={SurveyorHome} />
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} />
        <Stack.Screen name="PersonalProfile" component={StackPersonalProfile} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
