import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { WorkspaceRole } from '@surveylink/types';

export type RootStackParamList = {
  Boot: undefined;
  Landing: undefined;
  Auth: { mode?: 'login' | 'signup'; role?: WorkspaceRole } | undefined;
  ClientHome: undefined;
  SurveyorHome: undefined;
  ProjectDetail: { id: string };
};

export type ClientTabParamList = {
  Projects: undefined;
  Profile: undefined;
};

export type SurveyorTabParamList = {
  Dashboard: undefined;
  Matches: undefined;
  Profile: undefined;
};

export type RootNav = NativeStackNavigationProp<RootStackParamList>;
export type ClientTabNav = BottomTabNavigationProp<ClientTabParamList>;
export type SurveyorTabNav = BottomTabNavigationProp<SurveyorTabParamList>;
