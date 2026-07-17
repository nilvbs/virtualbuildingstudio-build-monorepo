import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import type { WorkspaceRole } from '@surveylink/types';

export type ClientTabParamList = {
  Projects: undefined;
  PersonalProfile: undefined;
};

export type SurveyorTabParamList = {
  Dashboard: undefined;
  Matches: undefined;
  Portfolio: undefined;
};

export type RootStackParamList = {
  Boot: undefined;
  Landing: undefined;
  Auth: { mode?: 'login' | 'signup'; role?: WorkspaceRole } | undefined;
  Onboarding: undefined;
  ClientHome: NavigatorScreenParams<ClientTabParamList> | undefined;
  SurveyorHome: NavigatorScreenParams<SurveyorTabParamList> | undefined;
  ProjectDetail: { id: string };
  PersonalProfile: { role: WorkspaceRole };
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
export type ClientTabNav = BottomTabNavigationProp<ClientTabParamList>;
export type SurveyorTabNav = BottomTabNavigationProp<SurveyorTabParamList>;
