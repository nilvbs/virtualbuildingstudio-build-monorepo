import {
  Dimensions,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors, fonts, radius, shadows, spacing } from '../lib/theme';
import { FadeInUp, PressCard } from '../components/motion';

type Props = NativeStackScreenProps<RootStackParamList, 'Landing'>;
type FeatherName = keyof typeof Feather.glyphMap;

const HERO_H = Math.round(Dimensions.get('window').width * 0.72);

const TRUST: { icon: FeatherName; label: string }[] = [
  { icon: 'shield', label: 'Vetted & insured surveyors' },
  { icon: 'map-pin', label: 'Coverage across all 50 states' },
  { icon: 'zap', label: 'Matched by real people, fast' },
];

const STEPS: { num: string; icon: FeatherName; title: string; copy: string }[] = [
  {
    num: '01',
    icon: 'edit-3',
    title: 'Build your profile',
    copy: 'Services, coverage radius, rates, and portfolio.',
  },
  {
    num: '02',
    icon: 'users',
    title: 'We send you jobs',
    copy: 'Our team matches projects to surveyors who fit location and scope.',
  },
  {
    num: '03',
    icon: 'check-circle',
    title: 'You deliver the survey',
    copy: 'Accept the request, coordinate the visit, and send the results.',
  },
];

export function LandingScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topbar}>
          <Image
            source={require('../../assets/bld-logo-dark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Pressable
            hitSlop={8}
            style={styles.signInBtn}
            onPress={() => navigation.navigate('Auth', { mode: 'login', role: 'surveyor' })}
          >
            <Text style={styles.signIn}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Clean hero image — no overlay, no text on top of it */}
        <View style={styles.heroWrap}>
          <ImageBackground
            source={require('../../assets/landing-hero.png')}
            style={styles.hero}
            imageStyle={styles.heroImage}
            resizeMode="cover"
          />
        </View>

        {/* All copy sits on solid page color for perfect readability */}
        <View style={styles.content}>
          <FadeInUp delay={40}>
            <Text style={styles.tagline}>
              Site work for surveyors,{'\n'}
              <Text style={styles.taglineAccent}>matched by hand.</Text>
            </Text>
            <Text style={styles.lede}>
              Build your profile, set coverage, and get vetted projects sent to you — no bidding
              wars, no cold outreach.
            </Text>
          </FadeInUp>

          <FadeInUp delay={100}>
            <View style={styles.trust}>
              {TRUST.map((t) => (
                <View key={t.label} style={styles.trustRow}>
                  <View style={styles.trustIcon}>
                    <Feather name={t.icon} size={14} color={colors.accent2} />
                  </View>
                  <Text style={styles.trustText}>{t.label}</Text>
                </View>
              ))}
            </View>
          </FadeInUp>

          <FadeInUp delay={160}>
            <Text style={styles.sectionTitle}>Join BLD as a surveyor</Text>
          </FadeInUp>

          <FadeInUp delay={210}>
            <PressCard
              style={styles.path}
              onPress={() => navigation.navigate('Auth', { mode: 'signup', role: 'surveyor' })}
            >
              <View style={[styles.pathIcon, { backgroundColor: colors.accentSoft2 }]}>
                <Feather name="compass" size={22} color={colors.accent2} />
              </View>
              <Text style={styles.pathTag}>Surveyor workspace</Text>
              <Text style={styles.pathTitle}>Offer your services</Text>
              <Text style={styles.pathCopy}>
                Laser scanning, drone, measured building, land, scan-to-BIM. We match you by hand
                to jobs that fit your skills and radius.
              </Text>
              <View style={styles.pathCtaRow}>
                <Text style={styles.pathCta}>Create your surveyor account</Text>
                <Feather name="arrow-right" size={16} color={colors.accent} />
              </View>
            </PressCard>
          </FadeInUp>

          <FadeInUp delay={330}>
            <Text style={styles.sectionTitle}>How it works</Text>
            <View style={styles.steps}>
              {STEPS.map((s) => (
                <View key={s.num} style={styles.step}>
                  <View style={styles.stepIcon}>
                    <Feather name={s.icon} size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{s.title}</Text>
                    <Text style={styles.stepCopy}>{s.copy}</Text>
                  </View>
                  <Text style={styles.stepNum}>{s.num}</Text>
                </View>
              ))}
            </View>
          </FadeInUp>

          <FadeInUp delay={390}>
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Pressable hitSlop={8} onPress={() => navigation.navigate('Auth', { mode: 'login', role: 'surveyor' })}>
                <Text style={styles.footerLink}>Sign in</Text>
              </Pressable>
            </View>
          </FadeInUp>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  topSafe: { backgroundColor: colors.panel, zIndex: 2 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: { width: 112, height: 36 },
  signInBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  signIn: { color: colors.accent, fontWeight: '700', fontSize: 14 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xxxl },

  heroWrap: {
    width: '100%',
    height: HERO_H,
    backgroundColor: colors.ice,
  },
  hero: { flex: 1, width: '100%', height: '100%' },
  heroImage: { width: '100%', height: '100%' },

  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    backgroundColor: colors.page,
  },
  tagline: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
    letterSpacing: -0.9,
    lineHeight: 42,
  },
  taglineAccent: {
    fontFamily: fonts.displayItalic,
    color: colors.accent,
  },
  lede: {
    color: colors.muted,
    fontSize: 15.5,
    lineHeight: 23,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    fontWeight: '500',
  },

  trust: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.sm,
  },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accentSoft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: { color: colors.text, fontSize: 14.5, fontWeight: '600', flex: 1 },

  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  path: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  pathIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pathTag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pathTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  pathCopy: {
    color: colors.muted,
    fontSize: 14.5,
    lineHeight: 21,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  pathCtaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pathCta: { color: colors.accent, fontWeight: '800', fontSize: 14.5 },

  steps: { gap: spacing.md },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 3 },
  stepCopy: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },
  stepNum: { color: colors.faint, fontWeight: '800', fontSize: 15 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.xxl,
  },
  footerText: { color: colors.muted, fontSize: 14 },
  footerLink: { color: colors.accent, fontWeight: '800', fontSize: 14 },
});
