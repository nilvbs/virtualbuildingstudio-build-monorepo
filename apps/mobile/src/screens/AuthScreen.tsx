import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { WorkspaceRole } from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { setSession } from '../lib/session';
import { destinationAfterAuth } from '../lib/auth-flow';
import { signInWithGoogle } from '../lib/google';
import {
  defaultPhoneInput,
  phoneInputIsValid,
  phoneInputToE164,
  type PhoneInputValue,
} from '../lib/country-codes';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, BackButton, Button, Divider, Field, GoogleButton } from '../components/ui';
import { PhoneNumberField } from '../components/PhoneNumberField';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;
type Mode = 'login' | 'signup' | 'forgot' | 'complete';

export function AuthScreen({ navigation, route }: Props) {
  const [role] = useState<WorkspaceRole>('surveyor');
  const [mode, setMode] = useState<Mode>(route.params?.mode === 'signup' ? 'signup' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneInput, setPhoneInput] = useState<PhoneInputValue>(defaultPhoneInput());
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    setError(null);
    setInfo(null);
    if (mode !== 'forgot') setForgotSent(false);
  }, [mode, role]);

  async function enterApp(nextRole: WorkspaceRole) {
    const dest = await destinationAfterAuth(nextRole);
    navigation.reset({
      index: 0,
      routes: [
        {
          name:
            dest.kind === 'onboarding'
              ? 'Onboarding'
              : dest.home === 'client'
                ? 'ClientHome'
                : 'SurveyorHome',
        },
      ],
    });
  }

  async function onLogin() {
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      const session = await api.login({ email, password, role });
      await setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
        activeRole: session.activeRole ?? role,
      });
      await enterApp(session.activeRole ?? role);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSignup() {
    if (!role) return;
    if (!phoneInputIsValid(phoneInput)) {
      setError('Enter a valid mobile number for the selected country.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { session } = await api.signup({
        firstName,
        lastName,
        email,
        phone: phoneInputToE164(phoneInput),
        password,
        roleHint: role,
      });
      await setSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: Date.now() + session.expiresIn * 1000,
        activeRole: session.activeRole ?? role,
      });
      await enterApp(session.activeRole ?? role);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword({ email, role });
      setForgotSent(true);
      setInfo(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onForgotResend() {
    if (!role) return;
    setBusy(true);
    setError(null);
    try {
      await api.forgotPassword({ email, role });
      setForgotSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function backToLogin() {
    setForgotSent(false);
    setError(null);
    setInfo(null);
    setMode('login');
  }

  async function onGoogle() {
    if (!role) return;
    setGoogleBusy(true);
    setError(null);
    try {
      const outcome = await signInWithGoogle(role);
      if (outcome.kind === 'authed') {
        await enterApp(outcome.role);
      } else if (outcome.kind === 'needsRegistration') {
        const parts = outcome.fullName.trim().split(/\s+/).filter(Boolean);
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
        setEmail(outcome.email);
        setInfo('Almost there — add your phone number to finish.');
        setMode('complete');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setGoogleBusy(false);
    }
  }

  async function onCompleteRegistration() {
    if (!role) return;
    if (!phoneInputIsValid(phoneInput)) {
      setError('Enter a valid mobile number for the selected country.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.completeRegistration({
        firstName,
        lastName,
        phone: phoneInputToE164(phoneInput),
        roleHint: role,
      });
      await enterApp(role);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onBack() {
    if (mode === 'forgot') {
      backToLogin();
      return;
    }
    if (mode === 'complete') {
      setMode('login');
      return;
    }
    navigation.goBack();
  }

  return (
    <View style={[styles.root, styles.rootSolid]}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <BackButton
                label={mode === 'forgot' ? 'Sign in' : mode === 'complete' ? 'Back' : 'Back'}
                onPress={onBack}
              />

              <Text style={styles.kicker}>Welcome to BLD</Text>
              <Text style={styles.title}>
                {mode === 'forgot'
                  ? forgotSent
                    ? 'Email sent successfully'
                    : 'Forgot password'
                  : mode === 'complete'
                    ? 'Finish sign up'
                    : mode === 'signup'
                      ? 'Create account'
                      : 'Sign in'}
              </Text>
              <Text style={styles.lede}>
                {mode === 'forgot'
                  ? forgotSent
                    ? `We sent a password reset link to ${email.trim() || 'your email'}. Open it to choose a new password.`
                    : 'Enter the email for your surveyor account and we will send a reset link.'
                  : mode === 'complete'
                    ? 'Add your phone number to complete your account.'
                    : 'Continue as a surveyor.'}
              </Text>

              {mode === 'complete' ? (
                <>
                  {error ? <AlertBox message={error} /> : null}
                  {info ? <AlertBox tone="success" message={info} /> : null}
                  <Field
                    label="First name"
                    icon="user"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                  <Field
                    label="Last name"
                    icon="user"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                  <PhoneNumberField value={phoneInput} onChange={setPhoneInput} />
                  <Button
                    label={busy ? 'Finishing…' : 'Finish sign up'}
                    icon="check"
                    busy={busy}
                    onPress={() => void onCompleteRegistration()}
                  />
                </>
              ) : (
                <>
                  {mode !== 'forgot' ? (
                    <View style={styles.tabs}>
                      <Pressable
                        style={[styles.tab, mode === 'login' && styles.tabActive]}
                        onPress={() => setMode('login')}
                      >
                        <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                          Sign in
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.tab, mode === 'signup' && styles.tabActive]}
                        onPress={() => setMode('signup')}
                      >
                        <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                          Create account
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {error ? <AlertBox message={error} /> : null}
                  {info ? <AlertBox tone="success" message={info} /> : null}

                  {mode === 'forgot' && forgotSent ? (
                    <>
                      <AlertBox
                        tone="success"
                        message="If you don't see the email, check spam — or resend below."
                      />
                      <Button
                        label={busy ? 'Sending…' : 'Resend email'}
                        busy={busy}
                        onPress={() => void onForgotResend()}
                      />
                      <Button
                        label="Back to login"
                        variant="ghost"
                        onPress={backToLogin}
                      />
                    </>
                  ) : (
                    <>
                  {mode === 'signup' ? (
                    <>
                      <Field
                        label="First name"
                        icon="user"
                        value={firstName}
                        onChangeText={setFirstName}
                        autoCapitalize="words"
                      />
                      <Field
                        label="Last name"
                        icon="user"
                        value={lastName}
                        onChangeText={setLastName}
                        autoCapitalize="words"
                      />
                    </>
                  ) : null}
                  <Field
                    label="Email"
                    icon="mail"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoComplete="email"
                  />
                  {mode === 'signup' ? (
                    <PhoneNumberField value={phoneInput} onChange={setPhoneInput} />
                  ) : null}
                  {mode !== 'forgot' ? (
                    <Field
                      label="Password"
                      icon="lock"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                      autoComplete={mode === 'login' ? 'password' : 'new-password'}
                    />
                  ) : null}

                  {mode === 'login' ? (
                    <Pressable
                      onPress={() => {
                        setForgotSent(false);
                        setMode('forgot');
                      }}
                      style={{ alignSelf: 'flex-end', marginBottom: 12 }}
                    >
                      <Text style={styles.forgot}>Forgot password?</Text>
                    </Pressable>
                  ) : null}

                  <Button
                    label={
                      busy
                        ? mode === 'signup'
                          ? 'Creating…'
                          : mode === 'forgot'
                            ? 'Sending…'
                            : 'Signing in…'
                        : mode === 'signup'
                          ? 'Create account'
                          : mode === 'forgot'
                            ? 'Send reset link'
                            : 'Sign in'
                    }
                    busy={busy}
                    onPress={() => {
                      if (mode === 'login') void onLogin();
                      else if (mode === 'signup') void onSignup();
                      else void onForgot();
                    }}
                  />

                  {mode !== 'forgot' ? (
                    <>
                      <Divider label="or" />
                      <GoogleButton
                        label={mode === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                        busy={googleBusy}
                        onPress={() => void onGoogle()}
                      />
                    </>
                  ) : null}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  rootSolid: { backgroundColor: colors.page },
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,18,32,0.4)' },
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingBottom: 48 },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  lede: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 6, marginBottom: 20 },
  sheetKicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sheetTitle: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  sheetLede: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 8, marginBottom: 22 },
  roles: { gap: spacing.md },
  role: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.page,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  roleCopy: { color: colors.muted, marginTop: 3, fontSize: 13.5 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(12,21,36,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  tabActive: { backgroundColor: colors.panel, ...shadows.sm },
  tabText: { color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.text },
  forgot: { color: colors.accent, fontWeight: '700', fontSize: 13 },
});
