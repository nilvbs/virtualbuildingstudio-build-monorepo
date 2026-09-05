import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  AccountType,
  AuthenticatedUser,
  OnboardingStatus,
  OnboardingStep,
  WorkspaceRole,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { clearSession, getActiveRole, getSession } from '../lib/session';
import { homeForWorkspace } from '../lib/home';
import { colors, radius, shadows, spacing } from '../lib/theme';
import {
  COUNTRY_DIALS,
  defaultPhoneInput,
  e164ToPhoneInput,
  findCountry,
  phoneInputIsValid,
  phoneInputToE164,
  type PhoneInputValue,
} from '../lib/country-codes';
import { AlertBox, Button, Field } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const EMPTY_ADDRESS = {
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
};

const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: 'select_account_type', label: 'Account' },
  { id: 'accept_terms', label: 'Terms' },
  { id: 'verify_contact', label: 'Verify' },
  { id: 'complete_profile', label: 'Details' },
  { id: 'portfolio', label: 'Portfolio' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

function stepIndex(step: OnboardingStep): number {
  if (step === 'done') return STEPS.length;
  const idx = STEPS.findIndex((s) => s.id === step);
  return idx >= 0 ? idx : 0;
}

export function OnboardingScreen({ navigation }: Props) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneInput, setPhoneInput] = useState<PhoneInputValue>(defaultPhoneInput());
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [workEmail, setWorkEmail] = useState('');
  const [workEmailCode, setWorkEmailCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptNda, setAcceptNda] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewStep, setViewStep] = useState<OnboardingStep | null>(null);
  const roleRef = useRef<WorkspaceRole | null>(null);

  const finishHome = useCallback(
    async (role?: WorkspaceRole | null) => {
      const next = role ?? (await getActiveRole()) ?? 'surveyor';
      navigation.reset({
        index: 0,
        routes: [{ name: homeForWorkspace(next) === 'client' ? 'ClientHome' : 'SurveyorHome' }],
      });
    },
    [navigation],
  );

  const load = useCallback(async () => {
    const next = await api.getOnboarding();
    setStatus(next);
    setViewStep(next.step);
    setAccountType(next.accountType);
    setPhoneInput(
      !next.phoneVerified && next.phone && !next.phoneNeedsEntry
        ? e164ToPhoneInput(next.phone)
        : defaultPhoneInput(),
    );
    setFullName((current) => current || next.fullName);
    setCompanyName((current) => current || next.companyName || '');
    setWorkEmail((current) => current || next.workEmail || '');
    setRegistrationNumber((current) => current || next.registrationNumber || '');
    setWebsite((current) => current || next.website || '');
    setAddress((current) => ({
      line1: current.line1 || next.address.line1 || '',
      line2: current.line2 || next.address.line2 || '',
      city: current.city || next.address.city || '',
      state: current.state || next.address.state || '',
      postalCode: current.postalCode || next.address.postalCode || '',
      country: current.country || next.address.country || '',
    }));
    if (next.termsAccepted) setAcceptTerms(true);
    if (next.ndaAccepted) setAcceptNda(true);
    if (next.phoneVerified) setPhoneOtpSent(false);
    const role = (await getActiveRole()) ?? 'surveyor';
    roleRef.current = role;
    if (next.step === 'done') await finishHome(role);
  }, [finishHome]);

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err)));
  }, [load]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function visibleOnboardingSteps(requiresPortfolio: boolean) {
    return STEPS.filter((item) => requiresPortfolio || item.id !== 'portfolio');
  }

  function advanceReview() {
    if (!status) return;
    const display = viewStep ?? status.step;
    const visible = visibleOnboardingSteps(status.requiresPortfolio);
    const serverIdx = stepIndex(status.step);
    const idx = visible.findIndex((item) => item.id === display);
    const next = visible[idx + 1];
    if (next && stepIndex(next.id) <= serverIdx) {
      setViewStep(next.id);
      setError(null);
    }
  }

  function goBack() {
    if (!status) return;
    const display = viewStep ?? status.step;
    const visible = visibleOnboardingSteps(status.requiresPortfolio);
    const idx = visible.findIndex((item) => item.id === display);
    if (idx > 0) {
      setViewStep(visible[idx - 1]!.id);
      setError(null);
    }
  }

  function jumpToStep(step: OnboardingStep) {
    if (!status) return;
    if (stepIndex(step) > stepIndex(status.step)) return;
    setViewStep(step);
    setError(null);
  }

  async function signOut() {
    setBusy('sign-out');
    setError(null);
    try {
      const session = await getSession();
      await api.logout(session?.refreshToken);
    } catch {
      /* best-effort */
    }
    await clearSession();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Landing' }],
      }),
    );
  }

  async function submitAccountType() {
    if (status?.accountTypeSelected) {
      advanceReview();
      return;
    }
    await run('account-type', () => api.selectAccountType(accountType));
  }

  async function submitTerms() {
    if (status?.termsAccepted && status?.ndaAccepted) {
      advanceReview();
      return;
    }
    if (!acceptTerms || !acceptNda) {
      setError('You must accept both the Terms & Conditions and the NDA to continue.');
      return;
    }
    await run('terms', () => api.acceptTerms());
  }

  async function sendPhoneCode() {
    if (!phoneInputIsValid(phoneInput)) {
      setError('Enter a valid mobile number for the selected country.');
      return;
    }
    setBusy('phone-start');
    setError(null);
    try {
      await api.startPhoneVerification(phoneInputToE164(phoneInput));
      setPhoneOtpSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
    try {
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitProfile() {
    const display = viewStep ?? status?.step;
    const reviewing =
      !!status && !!display && stepIndex(display) < stepIndex(status.step);
    if (reviewing) {
      advanceReview();
      return;
    }
    const isCompany = status?.accountType === 'company';
    if (isCompany && !status?.workEmailVerified) {
      setError('Verify your work email before continuing.');
      return;
    }
    await run('profile', () =>
      api.completeProfile({
        fullName,
        companyName: companyName.trim() ? companyName.trim() : null,
        address: {
          line1: address.line1.trim(),
          line2: address.line2.trim() ? address.line2.trim() : null,
          city: address.city.trim(),
          state: address.state.trim(),
          postalCode: address.postalCode.trim(),
          country: address.country.trim(),
        },
        registrationNumber: isCompany ? registrationNumber.trim() || null : undefined,
        website: isCompany ? (website.trim() ? website.trim() : null) : undefined,
      }),
    );
  }

  async function uploadPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Photo library permission is required to upload a profile photo.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setBusy('photo');
    setError(null);
    try {
      const next: AuthenticatedUser = await api.uploadAvatar(
        {
          uri: asset.uri,
          name: asset.fileName ?? 'profile.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        },
        asset.fileName ?? 'profile.jpg',
      );
      setStatus((current) => (current ? { ...current, avatarKey: next.avatarKey } : current));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const country = useMemo(() => findCountry(phoneInput.countryIso), [phoneInput.countryIso]);

  if (!status) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading onboarding…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onboarding = status;
  const visibleSteps = visibleOnboardingSteps(onboarding.requiresPortfolio);
  const serverStepIndex = stepIndex(onboarding.step);
  const displayStep = viewStep ?? onboarding.step;
  const displayStepIndex = stepIndex(displayStep);
  const canGoBack = displayStepIndex > 0;
  const isReviewing = displayStepIndex < serverStepIndex;
  const needsAccountType = displayStep === 'select_account_type';
  const needsTerms = displayStep === 'accept_terms';
  const needsContact = displayStep === 'verify_contact';
  const needsProfile = displayStep === 'complete_profile';
  const needsPortfolio = displayStep === 'portfolio';
  const isCompany = onboarding.accountType === 'company';
  const canAccept = acceptTerms && acceptNda;
  const accountTypeLocked = onboarding.accountTypeSelected;

  const title = needsAccountType
    ? 'How will you use BLD?'
    : needsTerms
      ? 'Accept terms to continue'
      : needsContact
        ? 'Verify your contact'
        : needsProfile
          ? isCompany
            ? 'Company details'
            : 'Complete your profile'
          : 'Build your portfolio';

  const lede = needsAccountType
    ? 'Choose individual or company. This sets which details we ask for next.'
    : needsTerms
      ? 'Before onboarding, you must accept the Terms & Conditions and NDA. There is no skip.'
      : needsContact
        ? 'Verify either your email or phone to continue. You can finish the other later.'
        : needsProfile
          ? isCompany
            ? 'Verify your work email and add company address, registration number, and optional website.'
            : 'Verify any remaining contact and add your base address.'
          : 'Add project examples next so clients can understand your work.';

  function renderPhoneBlock() {
    if (onboarding.phoneVerified) {
      return (
        <View style={[styles.block, styles.channelOk]}>
          <View style={styles.channel}>
            <Feather name="phone" size={18} color={colors.ok} />
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Mobile number</Text>
              <Text style={styles.channelCopy}>
                Verified{onboarding.phone ? ` · ${onboarding.phone}` : ''}
              </Text>
            </View>
            <Feather name="check-circle" size={18} color={colors.ok} />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.block}>
        <View style={styles.channel}>
          <Feather name="phone" size={18} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.channelTitle}>Mobile number</Text>
            <Text style={styles.channelCopy}>
              {phoneOtpSent
                ? 'Enter the SMS code we sent'
                : 'Select your country, enter your number, then verify'}
            </Text>
          </View>
        </View>

        <View style={styles.phoneRow}>
          <Pressable style={styles.countryBtn} onPress={() => setCountryPickerOpen(true)}>
            <Text style={styles.countryBtnText} numberOfLines={1}>
              {country.iso} {country.dial}
            </Text>
            <Feather name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
          <TextInput
            style={styles.phoneInput}
            value={phoneInput.national}
            onChangeText={(national) => setPhoneInput((v) => ({ ...v, national }))}
            keyboardType="phone-pad"
            placeholder={country.placeholder}
            placeholderTextColor={colors.faint}
            underlineColorAndroid="transparent"
          />
        </View>

        {!phoneOtpSent ? (
          <Button
            label={busy === 'phone-start' ? 'Sending…' : 'Send verification code'}
            busy={busy === 'phone-start'}
            disabled={!phoneInputIsValid(phoneInput)}
            onPress={() => void sendPhoneCode()}
          />
        ) : (
          <View style={{ gap: 10 }}>
            <TextInput
              style={styles.codeInput}
              value={phoneCode}
              onChangeText={setPhoneCode}
              keyboardType="number-pad"
              placeholder="SMS verification code"
              placeholderTextColor={colors.faint}
              underlineColorAndroid="transparent"
              maxLength={6}
            />
            <Button
              label={busy === 'phone' ? 'Verifying…' : 'Verify mobile number'}
              busy={busy === 'phone'}
              disabled={!phoneCode.trim()}
              onPress={() => void run('phone', () => api.verifyPhone(phoneCode))}
            />
            <Button
              label={busy === 'phone-start' ? 'Sending…' : 'Resend code'}
              variant="outline"
              busy={busy === 'phone-start'}
              onPress={() => void sendPhoneCode()}
            />
            <Pressable
              onPress={() => {
                setPhoneOtpSent(false);
                setPhoneCode('');
              }}
            >
              <Text style={styles.changeLink}>Change number</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topbar}>
          <View style={styles.topbarRow}>
            <Image
              source={require('../../assets/bld-logo-dark.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Pressable
              style={styles.signOutBtn}
              disabled={busy === 'sign-out'}
              onPress={() => void signOut()}
              hitSlop={8}
            >
              <Feather name="log-out" size={15} color={colors.text} />
              <Text style={styles.signOutText}>
                {busy === 'sign-out' ? 'Signing out…' : 'Sign out'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.progressRow}>
            {visibleSteps.map((item, index) => {
              const done = index < serverStepIndex;
              const active = item.id === displayStep;
              const reachable = index <= serverStepIndex;
              return (
                <Pressable
                  key={item.id}
                  style={styles.progressSeg}
                  disabled={!reachable}
                  onPress={() => jumpToStep(item.id)}
                >
                  <View
                    style={[
                      styles.progressBar,
                      (active || done) && styles.progressBarOn,
                      done && styles.progressBarDone,
                    ]}
                  />
                  <Text
                    style={[styles.progressLabel, active && styles.progressLabelActive]}
                    numberOfLines={1}
                  >
                    {done ? '✓' : index + 1} {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {canGoBack ? (
            <Pressable style={styles.backBtn} onPress={goBack} hitSlop={8}>
              <Feather name="arrow-left" size={16} color={colors.navy} />
              <Text style={styles.backText}>Previous step</Text>
            </Pressable>
          ) : null}
          <Text style={styles.kicker}>Account setup</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.lede}>{lede}</Text>

          {error ? <AlertBox message={error} /> : null}

          {needsAccountType ? (
            <View style={{ gap: 14 }}>
              <Text style={styles.fieldLabel}>Continue as</Text>
              <View style={styles.accountCards}>
                <Pressable
                  style={[styles.accountCard, accountType === 'individual' && styles.accountCardOn]}
                  disabled={accountTypeLocked}
                  onPress={() => setAccountType('individual')}
                >
                  <Feather
                    name="user"
                    size={22}
                    color={accountType === 'individual' ? colors.navy : colors.muted}
                  />
                  <Text
                    style={[
                      styles.accountCardText,
                      accountType === 'individual' && styles.accountCardTextOn,
                    ]}
                  >
                    Individual
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.accountCard, accountType === 'company' && styles.accountCardOn]}
                  disabled={accountTypeLocked}
                  onPress={() => setAccountType('company')}
                >
                  <Feather
                    name="briefcase"
                    size={22}
                    color={accountType === 'company' ? colors.navy : colors.muted}
                  />
                  <Text
                    style={[
                      styles.accountCardText,
                      accountType === 'company' && styles.accountCardTextOn,
                    ]}
                  >
                    Company
                  </Text>
                </Pressable>
              </View>
              {accountTypeLocked ? (
                <Text style={styles.hint}>Account type is locked after selection.</Text>
              ) : null}
              <Button
                label={busy === 'account-type' ? 'Saving…' : 'Continue'}
                busy={busy === 'account-type'}
                icon="arrow-right"
                onPress={() => void submitAccountType()}
              />
            </View>
          ) : null}

          {needsTerms ? (
            <View style={{ gap: 14 }}>
              <Pressable
                style={styles.acceptRow}
                disabled={status.termsAccepted}
                onPress={() => setAcceptTerms((v) => !v)}
              >
                <View style={[styles.checkbox, acceptTerms && styles.checkboxOn]}>
                  {acceptTerms ? <Feather name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acceptTitle}>I accept the Terms & Conditions</Text>
                  <Text style={styles.acceptCopy}>
                    Required.{' '}
                    <Text
                      style={styles.link}
                      onPress={() => void Linking.openURL('https://surveylink.app/terms')}
                    >
                      Review terms
                    </Text>
                  </Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.acceptRow}
                disabled={status.ndaAccepted}
                onPress={() => setAcceptNda((v) => !v)}
              >
                <View style={[styles.checkbox, acceptNda && styles.checkboxOn]}>
                  {acceptNda ? <Feather name="check" size={14} color="#fff" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.acceptTitle}>I accept the NDA</Text>
                  <Text style={styles.acceptCopy}>
                    Required.{' '}
                    <Text
                      style={styles.link}
                      onPress={() => void Linking.openURL('https://surveylink.app/nda')}
                    >
                      Review NDA
                    </Text>
                  </Text>
                </View>
              </Pressable>
              <Button
                label={busy === 'terms' ? 'Saving…' : 'Continue'}
                busy={busy === 'terms'}
                disabled={!canAccept && !isReviewing}
                icon="arrow-right"
                onPress={() => void submitTerms()}
              />
              {!canAccept && !isReviewing ? (
                <Text style={styles.acceptHint}>
                  Accept both to unlock the next step. You cannot bypass this.
                </Text>
              ) : null}
            </View>
          ) : null}

          {needsContact ? (
            <View style={{ gap: 14 }}>
              {status.emailVerified ? (
                <View style={[styles.block, styles.channelOk]}>
                  <View style={styles.channel}>
                    <Feather name="mail" size={18} color={colors.ok} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.channelTitle}>Email</Text>
                      <Text style={styles.channelCopy}>Verified</Text>
                    </View>
                    <Feather name="check-circle" size={18} color={colors.ok} />
                  </View>
                </View>
              ) : (
                <View style={styles.block}>
                  <View style={styles.channel}>
                    <Feather name="mail" size={18} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.channelTitle}>Email</Text>
                      <Text style={styles.channelCopy}>Enter the OTP sent to your inbox</Text>
                    </View>
                  </View>
                  <Field
                    label="Email verification code"
                    icon="hash"
                    value={emailCode}
                    onChangeText={setEmailCode}
                    keyboardType="number-pad"
                  />
                  <Button
                    label={busy === 'email' ? 'Verifying…' : 'Verify email'}
                    busy={busy === 'email'}
                    onPress={() => void run('email', () => api.verifyEmail(emailCode))}
                  />
                  <Button
                    label={busy === 'email-start' ? 'Sending…' : 'Resend email code'}
                    variant="outline"
                    busy={busy === 'email-start'}
                    onPress={() => void run('email-start', () => api.startEmailVerification())}
                  />
                </View>
              )}
              {renderPhoneBlock()}
              {isReviewing ? (
                <Button label="Continue" icon="arrow-right" onPress={advanceReview} />
              ) : null}
            </View>
          ) : null}

          {needsProfile ? (
            <View style={{ gap: 12 }}>
              <View style={styles.identity}>
                <Pressable style={styles.avatarBtn} onPress={() => void uploadPhoto()} disabled={busy === 'photo'}>
                  {status.avatarKey ? (
                    <Image source={{ uri: status.avatarKey }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{initials(fullName)}</Text>
                  )}
                  <View style={styles.avatarOverlay}>
                    <Feather name="camera" size={14} color="#fff" />
                  </View>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <View style={styles.disabledField}>
                    <Feather name="user" size={16} color={colors.faint} />
                    <Text style={styles.disabledFieldText}>{fullName || '—'}</Text>
                  </View>
                  <Text style={styles.hint}>From your account · not editable here</Text>
                </View>
              </View>

              {isCompany ? (
                <>
                  <Field
                    label="Company name"
                    icon="briefcase"
                    value={companyName}
                    onChangeText={setCompanyName}
                    autoCapitalize="words"
                  />
                  <View style={styles.block}>
                    <View style={styles.channel}>
                      <Feather name="mail" size={18} color={colors.accent} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.channelTitle}>Work email</Text>
                        <Text style={styles.channelCopy}>
                          {status.workEmailVerified
                            ? `Verified · ${status.workEmail}`
                            : 'Corporate email requiring OTP verification'}
                        </Text>
                      </View>
                      {status.workEmailVerified ? (
                        <Feather name="check-circle" size={18} color={colors.ok} />
                      ) : null}
                    </View>
                    {!status.workEmailVerified ? (
                      <>
                        <Field
                          label="Work email"
                          icon="mail"
                          value={workEmail}
                          onChangeText={setWorkEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                        <Button
                          label={busy === 'work-start' ? 'Sending…' : 'Send work email code'}
                          variant="outline"
                          busy={busy === 'work-start'}
                          disabled={!workEmail.trim()}
                          onPress={() =>
                            void run('work-start', () =>
                              api.startWorkEmailVerification(workEmail.trim()),
                            )
                          }
                        />
                        <Field
                          label="Work email OTP"
                          icon="hash"
                          value={workEmailCode}
                          onChangeText={setWorkEmailCode}
                          keyboardType="number-pad"
                        />
                        <Button
                          label={busy === 'work' ? 'Verifying…' : 'Verify work email'}
                          busy={busy === 'work'}
                          disabled={!workEmailCode.trim()}
                          onPress={() => void run('work', () => api.verifyWorkEmail(workEmailCode))}
                        />
                      </>
                    ) : null}
                  </View>
                  <Field
                    label="Company registration number"
                    icon="hash"
                    value={registrationNumber}
                    onChangeText={setRegistrationNumber}
                  />
                  <Field
                    label="Company website (optional)"
                    icon="globe"
                    value={website}
                    onChangeText={setWebsite}
                    autoCapitalize="none"
                    placeholder="https://"
                  />
                </>
              ) : null}

              {!isCompany ? (
                <View style={{ gap: 12 }}>
                  {!status.emailVerified || !status.phoneVerified ? (
                    <Text style={styles.acceptHint}>
                      Verify any remaining contact before finishing your profile.
                    </Text>
                  ) : null}
                  {status.emailVerified ? (
                    <View style={[styles.block, styles.channelOk]}>
                      <View style={styles.channel}>
                        <Feather name="mail" size={18} color={colors.ok} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.channelTitle}>Email</Text>
                          <Text style={styles.channelCopy}>Verified</Text>
                        </View>
                        <Feather name="check-circle" size={18} color={colors.ok} />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.block}>
                      <View style={styles.channel}>
                        <Feather name="mail" size={18} color={colors.accent} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.channelTitle}>Email</Text>
                          <Text style={styles.channelCopy}>Enter the code we sent to your inbox</Text>
                        </View>
                      </View>
                      <TextInput
                        style={styles.codeInput}
                        value={emailCode}
                        onChangeText={setEmailCode}
                        keyboardType="number-pad"
                        placeholder="6-digit code"
                        placeholderTextColor={colors.faint}
                        underlineColorAndroid="transparent"
                        maxLength={6}
                      />
                      <Button
                        label={busy === 'email' ? 'Verifying…' : 'Verify email'}
                        busy={busy === 'email'}
                        onPress={() => void run('email', () => api.verifyEmail(emailCode))}
                      />
                    </View>
                  )}
                  {renderPhoneBlock()}
                </View>
              ) : null}

              <Field
                label={isCompany ? 'Company address' : 'Base address'}
                icon="map-pin"
                value={address.line1}
                onChangeText={(line1) => setAddress((a) => ({ ...a, line1 }))}
                placeholder="Address line 1"
              />
              <Field
                label="Address line 2 (optional)"
                value={address.line2}
                onChangeText={(line2) => setAddress((a) => ({ ...a, line2 }))}
              />
              <Field
                label="City"
                value={address.city}
                onChangeText={(city) => setAddress((a) => ({ ...a, city }))}
              />
              <Field
                label="State / region"
                value={address.state}
                onChangeText={(state) => setAddress((a) => ({ ...a, state }))}
              />
              <Field
                label="Postal code"
                value={address.postalCode}
                onChangeText={(postalCode) => setAddress((a) => ({ ...a, postalCode }))}
              />
              <Field
                label="Country"
                value={address.country}
                onChangeText={(countryName) => setAddress((a) => ({ ...a, country: countryName }))}
              />

              <Button
                label={busy === 'profile' ? 'Saving…' : 'Continue'}
                busy={busy === 'profile'}
                disabled={isCompany && !status.workEmailVerified}
                icon="arrow-right"
                onPress={() => void submitProfile()}
              />
            </View>
          ) : null}

          {needsPortfolio ? (
            <View style={{ gap: 12 }}>
              <Button
                label="Go to portfolio builder"
                icon="arrow-right"
                onPress={() =>
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'SurveyorHome' }],
                  })
                }
              />
              <Button
                label={busy === 'portfolio' ? 'Skipping…' : 'I’ll add portfolio later'}
                variant="outline"
                busy={busy === 'portfolio'}
                onPress={() => void run('portfolio', () => api.completePortfolio())}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={countryPickerOpen} animationType="slide" transparent>
        <Pressable style={styles.modalDim} onPress={() => setCountryPickerOpen(false)}>
          <Pressable style={[styles.modalSheet, shadows.lg]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select country</Text>
            <ScrollView>
              {COUNTRY_DIALS.map((c) => (
                <Pressable
                  key={c.iso}
                  style={styles.modalRow}
                  onPress={() => {
                    setPhoneInput({ countryIso: c.iso, national: '' });
                    setCountryPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>
                    {c.name} ({c.dial})
                  </Text>
                  {phoneInput.countryIso === c.iso ? (
                    <Feather name="check" size={18} color={colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.muted },
  topbar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#fff',
    gap: 12,
  },
  topbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  logo: { width: 72, height: 28 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  signOutText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressSeg: { flex: 1, gap: 6, minWidth: 0 },
  progressBar: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,36,107,0.1)',
  },
  progressBarOn: { backgroundColor: colors.navy },
  progressBarDone: { backgroundColor: colors.ok },
  progressLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  progressLabelActive: { color: colors.text },
  content: { padding: spacing.xl, paddingBottom: 56, gap: 4 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  backText: { color: colors.navy, fontSize: 13, fontWeight: '700' },
  kicker: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  lede: { color: colors.muted, fontSize: 14.5, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#eef4fc',
  },
  avatarBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 24,
    backgroundColor: 'rgba(0,21,63,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,36,107,0.1)',
    backgroundColor: '#f1f5fb',
  },
  disabledFieldText: { color: '#5a6f93', fontWeight: '600', fontSize: 15, flex: 1 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  accountCards: { gap: 10 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  accountCardOn: {
    borderColor: colors.navy,
    backgroundColor: colors.accentSoft2,
  },
  accountCardText: { color: colors.muted, fontWeight: '800', fontSize: 16 },
  accountCardTextOn: { color: colors.text },
  acceptRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  acceptTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  acceptCopy: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  acceptHint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  link: { color: colors.accent, fontWeight: '700' },
  block: {
    gap: 12,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#eef4fc',
  },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  channelOk: {
    backgroundColor: colors.okSoft,
    borderColor: 'rgba(5,150,105,0.18)',
  },
  channelTitle: { fontSize: 15, fontWeight: '800', color: colors.text },
  channelCopy: { color: colors.muted, fontSize: 13, marginTop: 2 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 118,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
    minHeight: 48,
  },
  countryBtnText: { color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  phoneInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.panel,
    fontSize: 15,
  },
  codeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.panel,
    fontSize: 15,
  },
  changeLink: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 6,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.ice, fontSize: 20, fontWeight: '800' },
  modalDim: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { color: colors.text, fontSize: 15, fontWeight: '600' },
});
