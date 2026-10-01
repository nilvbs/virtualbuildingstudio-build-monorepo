import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { PROJECT_OCCUPANCY_SHORT_LABELS, type SurveyorRequest } from '@surveylink/types';
import { buildingLabel, formatDistanceMi, formatShortDate, serviceLabel, timelineLabel } from '../lib/format';
import { openStreetView } from '../lib/street-view';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { Badge, Button } from './ui';

type FeatherName = keyof typeof Feather.glyphMap;

type Props = {
  request: SurveyorRequest;
  /** "Incoming" pill for requests, match status for accepted work. */
  pill: { label: string; tone: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' };
  /** e.g. "From" for requests, "With" for matches. */
  clientPrefix: string;
  datePrefix?: string;
  showTimer?: boolean;
  children?: ReactNode;
};

function formatWorkingCountdown(ms: number | null): string {
  if (ms == null) return '—';
  const totalMin = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function WorkingHoursTimer({
  remainingWorkingMs,
  paused,
  expiresAt,
}: {
  remainingWorkingMs: number | null;
  paused: boolean;
  expiresAt: string | null;
}) {
  const [remaining, setRemaining] = useState(remainingWorkingMs);

  useEffect(() => {
    setRemaining(remainingWorkingMs);
  }, [remainingWorkingMs]);

  useEffect(() => {
    if (paused || remaining == null || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((prev) => (prev == null ? prev : Math.max(0, prev - 60_000)));
    }, 60_000);
    return () => clearInterval(id);
  }, [paused, remaining]);

  if (!expiresAt) return null;
  const expired = remaining === 0;

  return (
    <View style={[styles.timer, paused && styles.timerPaused, expired && styles.timerExpired]}>
      <Feather name="clock" size={15} color={expired ? colors.danger : paused ? colors.muted : colors.warn} />
      <View style={{ flex: 1 }}>
        <Text style={styles.timerValue}>{expired ? 'Window ended' : formatWorkingCountdown(remaining)}</Text>
        <Text style={styles.timerCopy}>
          {paused ? 'Timer paused outside official working hours (Mon–Fri)' : 'Working hours left to accept'}
        </Text>
      </View>
    </View>
  );
}

/** Project card shared by surveyor Requests and Matches — mirrors the web cards. */
export function SurveyorProjectCard({
  request,
  pill,
  clientPrefix,
  datePrefix,
  showTimer,
  children,
}: Props) {
  const { project, client } = request;
  const meta = [
    project.locationText ? { icon: 'map-pin', text: project.locationText } : null,
    project.distanceKm != null
      ? { icon: 'navigation', text: `${formatDistanceMi(project.distanceKm)} from your base` }
      : null,
    project.buildingType
      ? {
          icon: 'home',
          text: `${buildingLabel(project.buildingType)}${project.buildingAge ? ` · ${project.buildingAge}` : ''}`,
        }
      : null,
    project.floors != null ? { icon: 'layers', text: `${project.floors} floors` } : null,
    project.areaSqft != null ? { icon: 'maximize', text: `${project.areaSqft.toLocaleString()} sq ft` } : null,
    project.occupancy ? { icon: 'users', text: PROJECT_OCCUPANCY_SHORT_LABELS[project.occupancy] } : null,
    project.neededWithin ? { icon: 'clock', text: timelineLabel(project.neededWithin) } : null,
  ].filter(Boolean) as { icon: FeatherName; text: string }[];

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(client.username.trim()[0] ?? 'P').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {project.title}
            </Text>
            <Badge label={pill.label} tone={pill.tone} />
          </View>
          <Text style={styles.client}>
            {clientPrefix} @{client.username}
            {client.companyName ? ` · ${client.companyName}` : ''} · {datePrefix ? `${datePrefix} ` : ''}
            {formatShortDate(request.createdAt)}
          </Text>
          {request.feedbackSubmitted ? <Text style={styles.feedbackDone}>Your feedback was submitted</Text> : null}
        </View>
      </View>

      {showTimer ? (
        <WorkingHoursTimer
          remainingWorkingMs={request.remainingWorkingMs}
          paused={request.responseWindowPaused}
          expiresAt={request.expiresAt}
        />
      ) : null}

      {meta.length > 0 ? (
        <View style={styles.meta}>
          {meta.map((m) => (
            <View key={m.text} style={styles.metaRow}>
              <Feather name={m.icon} size={13} color={colors.muted} />
              <Text style={styles.metaText}>{m.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {project.services.length > 0 ? (
        <View style={styles.tags}>
          {project.services.map((s) => (
            <View key={s} style={styles.tag}>
              <Text style={styles.tagText}>{serviceLabel(s)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {project.notes ? <Text style={styles.notes}>{project.notes}</Text> : null}

      {project.location ? (
        <Button
          label="Street View"
          icon="eye"
          variant="outline"
          onPress={() => openStreetView(project.location)}
        />
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  top: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.ice, fontWeight: '800', fontSize: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, justifyContent: 'space-between' },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text },
  client: { color: colors.muted, fontSize: 12.5, marginTop: 3 },
  feedbackDone: { color: colors.ok, fontSize: 12, fontWeight: '700', marginTop: 4 },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warnSoft,
  },
  timerPaused: { backgroundColor: colors.accentSoft },
  timerExpired: { backgroundColor: colors.dangerSoft },
  timerValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  timerCopy: { fontSize: 12, color: colors.muted, marginTop: 1 },
  meta: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { flex: 1, color: colors.text, fontSize: 13.5, textTransform: 'none' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  tagText: { fontSize: 12, fontWeight: '700', color: colors.text },
  notes: {
    color: colors.text,
    fontSize: 13.5,
    lineHeight: 20,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft2,
  },
});
