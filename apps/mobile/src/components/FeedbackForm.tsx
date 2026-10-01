import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  FEEDBACK_ASPECT_KEYS,
  FEEDBACK_RATING_EMOJIS,
  feedbackAspectLabel,
  type FeedbackAspectKey,
  type FeedbackAspects,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, Button } from './ui';

type Props = {
  matchId: string;
  projectTitle: string;
  role: 'client' | 'surveyor';
  onSubmitted?: () => void;
};

function ratingHint(rating: number): string {
  if (rating === 0) return 'Tap an emoji to rate BLD';
  if (rating <= 2) return 'Sorry the product fell short — tell us what happened';
  if (rating === 3) return 'Okay — room to improve the product';
  if (rating === 4) return 'Great — almost there';
  return 'Excellent — the product delivered';
}

/** Product feedback for a completed match — same rules as web `FeedbackForm`. */
export function FeedbackForm({ matchId, projectTitle, role, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [aspects, setAspects] = useState<FeedbackAspects>({});
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    if (rating < 1) {
      setError('Please choose an overall emoji rating.');
      return;
    }
    if (comment.trim().length < 10) {
      setError('Please add a short note (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      await api.submitFeedback({
        matchId,
        rating,
        comment: comment.trim(),
        aspects,
        recommend,
        asRole: role,
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function setAspect(key: FeedbackAspectKey, value: number) {
    setAspects((prev) => ({ ...prev, [key]: value }));
  }

  if (done) {
    return (
      <View style={[styles.card, styles.doneCard]}>
        <View style={styles.doneIcon}>
          <Feather name="check" size={22} color={colors.ok} />
        </View>
        <Text style={styles.title}>Thank you</Text>
        <Text style={styles.sub}>
          Your product feedback for {projectTitle} was sent. We emailed you a confirmation.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>Product feedback</Text>
      <Text style={styles.title}>How is BLD working for you?</Text>
      <Text style={styles.sub}>
        Rate the product and services around “{projectTitle}” — matching, tools, and support.
      </Text>

      <Text style={styles.label}>Overall product experience *</Text>
      <View style={styles.emojiRow} accessibilityRole="radiogroup">
        {([1, 2, 3, 4, 5] as const).map((n) => {
          const meta = FEEDBACK_RATING_EMOJIS[n];
          const on = rating === n;
          return (
            <Pressable
              key={n}
              onPress={() => setRating(n)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${n} — ${meta.label}`}
              style={({ pressed }) => [styles.emoji, on && styles.emojiOn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.emojiFace}>{meta.emoji}</Text>
              <Text style={[styles.emojiLabel, on && styles.emojiLabelOn]} numberOfLines={1}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.hint}>{ratingHint(rating)}</Text>

      <Text style={styles.label}>Rate our services (optional)</Text>
      <View style={styles.aspects}>
        {FEEDBACK_ASPECT_KEYS.map((key) => {
          const label = feedbackAspectLabel(key, role);
          return (
            <View key={key} style={styles.aspectRow}>
              <Text style={styles.aspectLabel}>{label}</Text>
              <View style={styles.stars} accessibilityLabel={label}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const on = (aspects[key] ?? 0) >= n;
                  return (
                    <Pressable key={n} onPress={() => setAspect(key, n)} hitSlop={4} accessibilityLabel={`${n}`}>
                      <Text style={[styles.star, on && styles.starOn]}>{on ? '★' : '☆'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.label}>Would you recommend BLD?</Text>
      <View style={styles.chips}>
        {([
          [true, 'Yes'],
          [false, 'No'],
        ] as const).map(([value, text]) => (
          <Pressable
            key={text}
            onPress={() => setRecommend(value)}
            style={[styles.chip, recommend === value && styles.chipOn]}
          >
            <Text style={[styles.chipText, recommend === value && styles.chipTextOn]}>{text}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>What stood out about the product? *</Text>
      <TextInput
        style={styles.textarea}
        multiline
        maxLength={2000}
        placeholder="Product flow, matching, job tools, support…"
        placeholderTextColor={colors.faint}
        value={comment}
        onChangeText={setComment}
      />
      <Text style={styles.counter}>{comment.trim().length}/10 minimum</Text>

      {error ? <AlertBox message={error} /> : null}
      <Button label="Submit feedback" icon="send" onPress={() => void submit()} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  doneCard: { alignItems: 'center' },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.okSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  sub: { color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4, textAlign: 'left' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  emojiRow: { flexDirection: 'row', gap: 6 },
  emoji: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  emojiOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft2 },
  emojiFace: { fontSize: 24 },
  emojiLabel: { fontSize: 10.5, color: colors.muted, marginTop: 2, fontWeight: '600' },
  emojiLabelOn: { color: colors.text },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  aspects: { gap: 8 },
  aspectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  aspectLabel: { flex: 1, color: colors.text, fontSize: 13.5 },
  stars: { flexDirection: 'row', gap: 4 },
  star: { fontSize: 20, color: colors.faint },
  starOn: { color: colors.amber },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '700', fontSize: 13.5 },
  chipTextOn: { color: colors.ice },
  textarea: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    fontSize: 14.5,
    color: colors.text,
    backgroundColor: colors.panel,
  },
  counter: { fontSize: 11.5, color: colors.muted, marginTop: 4, marginBottom: spacing.md },
});
