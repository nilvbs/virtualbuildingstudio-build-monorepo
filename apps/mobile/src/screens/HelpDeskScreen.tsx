import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  HELP_TICKET_CATEGORIES,
  HELP_TICKET_CATEGORY_LABELS,
  HELP_TICKET_PRIORITIES,
  HELP_TICKET_PRIORITY_LABELS,
  HELP_TICKET_STATUS_LABELS,
  faqsForWorkspace,
  type HelpTicket,
  type HelpTicketAttachment,
  type HelpTicketCategory,
  type HelpTicketDetail,
  type HelpTicketPriority,
  type HelpTicketStatus,
  type HelpTicketWorkspace,
} from '@surveylink/types';
import { api, errorMessage } from '../lib/api';
import { colors, radius, shadows, spacing } from '../lib/theme';
import { AlertBox, BackButton, Button } from '../components/ui';
import { AppHeader } from '../components/AppHeader';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'HelpDesk'>;
type View_ = 'list' | 'new' | 'ticket';

const MAX_ATTACHMENTS = 5;

function statusColors(status: HelpTicketStatus): { bg: string; fg: string } {
  if (status === 'resolved') return { bg: colors.okSoft, fg: colors.ok };
  if (status === 'closed') return { bg: colors.accentSoft2, fg: colors.muted };
  if (status === 'waiting') return { bg: colors.warnSoft, fg: colors.warn };
  return { bg: colors.accentSoft, fg: colors.accent };
}

function locked(status: HelpTicketStatus): boolean {
  return status === 'resolved' || status === 'closed';
}

/** Image attachments picker (max 5) — same limits as the web help desk. */
function Attachments({
  items,
  onChange,
  disabled,
}: {
  items: HelpTicketAttachment[];
  onChange: (next: HelpTicketAttachment[]) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required to attach images.');
      return;
    }
    const slots = MAX_ATTACHMENTS - items.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slots,
      quality: 0.85,
    });
    if (result.canceled || !result.assets.length) return;
    setUploading(true);
    const uploaded: HelpTicketAttachment[] = [];
    try {
      for (const asset of result.assets.slice(0, slots)) {
        const name = asset.fileName ?? `image-${Date.now()}.jpg`;
        const stored = await api.uploadMedia(
          { uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg' },
          'document',
          name,
        );
        uploaded.push({
          url: stored.url,
          fileName: stored.fileName || name,
          contentType: stored.contentType ?? asset.mimeType ?? null,
        });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (uploaded.length) onChange([...items, ...uploaded].slice(0, MAX_ATTACHMENTS));
      setUploading(false);
    }
  }

  function remove(target: HelpTicketAttachment) {
    onChange(items.filter((a) => a.url !== target.url));
    void api.deleteMedia({ url: target.url }).catch(() => undefined);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      {items.length > 0 ? (
        <View style={styles.thumbs}>
          {items.map((a) => (
            <View key={a.url} style={styles.thumb}>
              <Image source={{ uri: a.url }} style={styles.thumbImg} />
              <Pressable
                style={styles.thumbRemove}
                onPress={() => remove(a)}
                disabled={disabled}
                accessibilityLabel={`Remove ${a.fileName}`}
              >
                <Feather name="x" size={12} color={colors.ice} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {items.length < MAX_ATTACHMENTS ? (
        <Pressable
          onPress={() => void pick()}
          disabled={disabled || uploading}
          style={({ pressed }) => [styles.attachBtn, pressed && { opacity: 0.85 }]}
        >
          {uploading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Feather name="image" size={16} color={colors.accent} />
          )}
          <Text style={styles.attachText}>
            {uploading ? 'Uploading…' : `Add images (${items.length}/${MAX_ATTACHMENTS})`}
          </Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function ChoiceChips<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = o === value;
        return (
          <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{labels[o]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HelpDeskScreen({ route, navigation }: Props) {
  const workspace: HelpTicketWorkspace = route.params.workspace;
  const [mode, setMode] = useState<View_>('list');
  const [tickets, setTickets] = useState<HelpTicket[] | null>(null);
  const [selected, setSelected] = useState<HelpTicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const [category, setCategory] = useState<HelpTicketCategory>('account');
  const [priority, setPriority] = useState<HelpTicketPriority>('normal');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<HelpTicketAttachment[]>([]);
  const [reply, setReply] = useState('');
  const [replyAttachments, setReplyAttachments] = useState<HelpTicketAttachment[]>([]);

  const refresh = useCallback(async () => {
    try {
      setTickets(await api.listMyHelpTickets(workspace));
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [workspace]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onCategoryChange(next: HelpTicketCategory) {
    setCategory(next);
    if (next === 'blocker') setPriority((p) => (p === 'low' || p === 'normal' ? 'urgent' : p));
  }

  function resetForm() {
    setCategory('account');
    setPriority('normal');
    setSubject('');
    setBody('');
    setAttachments([]);
  }

  function goBack() {
    setError(null);
    if (mode === 'list') navigation.goBack();
    else setMode('list');
  }

  async function openTicket(id: string) {
    setError(null);
    try {
      setSelected(await api.getMyHelpTicket(id, workspace));
      setReply('');
      setReplyAttachments([]);
      setMode('ticket');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submitTicket() {
    setError(null);
    if (subject.trim().length < 4) {
      setError('Add a short subject (at least 4 characters).');
      return;
    }
    if (body.trim().length < 10) {
      setError('Add a few details (at least 10 characters).');
      return;
    }
    setBusy(true);
    try {
      const detail = await api.createHelpTicket({
        workspace,
        category,
        priority,
        subject: subject.trim(),
        body: body.trim(),
        attachments,
      });
      resetForm();
      await refresh();
      setSelected(detail);
      setMode('ticket');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    setError(null);
    if (locked(selected.status)) {
      setError(
        selected.status === 'resolved'
          ? 'This ticket is resolved — messaging is locked.'
          : 'This ticket is closed — messaging is locked.',
      );
      return;
    }
    if (reply.trim().length < 2 && replyAttachments.length === 0) {
      setError('Add a message or at least one image.');
      return;
    }
    setBusy(true);
    try {
      const detail = await api.replyHelpTicket(
        selected.id,
        { body: reply.trim(), attachments: replyAttachments },
        workspace,
      );
      setReply('');
      setReplyAttachments([]);
      setSelected(detail);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const faqs = faqsForWorkspace(workspace);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            mode === 'list' ? (
              <RefreshControl
                refreshing={refreshing}
                tintColor={colors.accent}
                onRefresh={async () => {
                  setRefreshing(true);
                  await refresh();
                  setRefreshing(false);
                }}
              />
            ) : undefined
          }
        >
          <BackButton label={mode === 'list' ? 'Back' : 'Help desk'} onPress={goBack} />
          {error ? <AlertBox message={error} /> : null}

          {mode === 'list' ? (
            <>
              <View style={styles.hero}>
                <Text style={styles.kicker}>Help desk</Text>
                <Text style={styles.title}>How can we help?</Text>
                <Text style={styles.sub}>
                  Open a ticket and we’ll reply in the same thread. Choose Blocker if you can’t proceed.
                </Text>
                <Button
                  label="New ticket"
                  icon="plus"
                  onPress={() => {
                    resetForm();
                    setError(null);
                    setMode('new');
                  }}
                  style={{ marginTop: spacing.md }}
                />
              </View>

              <Text style={styles.sectionTitle}>Your tickets</Text>
              {tickets == null ? (
                <ActivityIndicator style={{ marginVertical: 24 }} color={colors.accent} />
              ) : tickets.length === 0 ? (
                <Text style={styles.empty}>No tickets yet. Open one if something needs attention.</Text>
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {tickets.map((t) => {
                    const sc = statusColors(t.status);
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => void openTicket(t.id)}
                        style={({ pressed }) => [styles.ticket, pressed && { opacity: 0.9 }]}
                      >
                        <View style={styles.ticketTop}>
                          <Text style={styles.ticketNum}>{t.ticketNumber}</Text>
                          <View style={styles.pills}>
                            {t.category === 'blocker' ? (
                              <View style={[styles.pill, { backgroundColor: colors.dangerSoft }]}>
                                <Text style={[styles.pillText, { color: colors.danger }]}>Blocker</Text>
                              </View>
                            ) : null}
                            <View style={[styles.pill, { backgroundColor: sc.bg }]}>
                              <Text style={[styles.pillText, { color: sc.fg }]}>
                                {HELP_TICKET_STATUS_LABELS[t.status]}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.ticketSubject} numberOfLines={2}>
                          {t.subject}
                        </Text>
                        <Text style={styles.ticketMeta}>
                          {HELP_TICKET_CATEGORY_LABELS[t.category]} · {new Date(t.updatedAt).toLocaleDateString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              <Text style={styles.sectionTitle}>Frequently asked</Text>
              <View style={styles.faqList}>
                {faqs.map((f, i) => {
                  const open = openFaq === f.id;
                  return (
                    <View key={f.id} style={[styles.faq, i > 0 && styles.faqDivider]}>
                      <Pressable
                        onPress={() => setOpenFaq(open ? null : f.id)}
                        style={styles.faqHead}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                      >
                        <Text style={styles.faqQ}>{f.question}</Text>
                        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                      </Pressable>
                      {open ? <Text style={styles.faqA}>{f.answer}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {mode === 'new' ? (
            <View style={styles.panel}>
              <Text style={styles.kicker}>Help desk</Text>
              <Text style={styles.title}>New support ticket</Text>
              {category === 'blocker' ? (
                <Text style={styles.blockerNote}>
                  Blocker tickets are prioritized. Describe what’s stuck and what you need to proceed.
                </Text>
              ) : null}

              <Text style={styles.label}>Category</Text>
              <ChoiceChips
                options={HELP_TICKET_CATEGORIES}
                labels={HELP_TICKET_CATEGORY_LABELS}
                value={category}
                onChange={onCategoryChange}
              />

              <Text style={styles.label}>Priority</Text>
              <ChoiceChips
                options={HELP_TICKET_PRIORITIES}
                labels={HELP_TICKET_PRIORITY_LABELS}
                value={priority}
                onChange={setPriority}
              />

              <Text style={styles.label}>Subject</Text>
              <TextInput
                style={styles.input}
                value={subject}
                onChangeText={setSubject}
                maxLength={160}
                placeholder={
                  category === 'blocker'
                    ? 'What’s blocked? (e.g. can’t accept request)'
                    : 'Short summary of the issue'
                }
                placeholderTextColor={colors.faint}
              />

              <Text style={styles.label}>Details</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
                placeholder={
                  category === 'blocker'
                    ? 'What you tried, where you’re stuck, and any project / match IDs…'
                    : 'What happened, what you expected, and any project or match details…'
                }
                placeholderTextColor={colors.faint}
              />

              <Text style={styles.label}>Images</Text>
              <Attachments items={attachments} onChange={setAttachments} disabled={busy} />

              <View style={styles.formActions}>
                <Button label="Cancel" variant="outline" onPress={goBack} disabled={busy} style={{ flex: 1 }} />
                <Button
                  label={category === 'blocker' ? 'Submit blocker' : 'Submit ticket'}
                  icon="send"
                  onPress={() => void submitTicket()}
                  busy={busy}
                  style={{ flex: 1.4 }}
                />
              </View>
            </View>
          ) : null}

          {mode === 'ticket' && selected ? (
            <>
              <View style={styles.panel}>
                <Text style={styles.ticketNum}>{selected.ticketNumber}</Text>
                <Text style={styles.title}>{selected.subject}</Text>
                <Text style={styles.ticketMeta}>
                  {HELP_TICKET_CATEGORY_LABELS[selected.category]} ·{' '}
                  {HELP_TICKET_PRIORITY_LABELS[selected.priority]} · {HELP_TICKET_STATUS_LABELS[selected.status]}
                </Text>
              </View>

              <View style={styles.thread}>
                {selected.messages.map((m) => (
                  <View key={m.id} style={[styles.msg, m.isStaff ? styles.msgStaff : styles.msgUser]}>
                    <View style={styles.msgHead}>
                      <Text style={styles.msgAuthor}>
                        {m.isStaff ? 'BLD Support' : m.authorFullName || m.authorUsername || 'You'}
                      </Text>
                      <Text style={styles.msgTime}>
                        {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </Text>
                    </View>
                    {m.body.trim() ? <Text style={styles.msgBody}>{m.body}</Text> : null}
                    {(m.attachments ?? []).length > 0 ? (
                      <View style={styles.thumbs}>
                        {m.attachments.map((a) => (
                          <Pressable key={a.url} onPress={() => void Linking.openURL(a.url)} style={styles.thumb}>
                            <Image source={{ uri: a.url }} style={styles.thumbImg} />
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              {!locked(selected.status) ? (
                <View style={styles.panel}>
                  <TextInput
                    style={[styles.input, styles.textarea, { minHeight: 80 }]}
                    value={reply}
                    onChangeText={setReply}
                    multiline
                    placeholder="Add more detail or reply to support…"
                    placeholderTextColor={colors.faint}
                  />
                  <View style={{ marginTop: spacing.sm }}>
                    <Attachments items={replyAttachments} onChange={setReplyAttachments} disabled={busy} />
                  </View>
                  <Button
                    label="Send reply"
                    icon="send"
                    onPress={() => void sendReply()}
                    busy={busy}
                    style={{ marginTop: spacing.md }}
                  />
                </View>
              ) : (
                <Text style={styles.empty}>
                  {selected.status === 'resolved'
                    ? 'This ticket is resolved — messaging is locked.'
                    : 'This ticket is closed — messaging is locked.'}
                </Text>
              )}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  hero: {
    backgroundColor: colors.accentSoft2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4, letterSpacing: -0.3 },
  sub: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
  sectionTitle: { fontSize: 15.5, fontWeight: '800', color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  empty: { color: colors.muted, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginVertical: spacing.md },
  ticket: {
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
    ...shadows.sm,
  },
  ticketTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  ticketNum: { fontSize: 12.5, fontWeight: '800', color: colors.muted, letterSpacing: 0.3 },
  ticketSubject: { fontSize: 15, fontWeight: '700', color: colors.text },
  ticketMeta: { fontSize: 12.5, color: colors.muted, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontSize: 11, fontWeight: '800' },
  faqList: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  faq: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  faqDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  faqA: { marginTop: spacing.sm, color: colors.muted, fontSize: 13.5, lineHeight: 20 },
  panel: {
    marginTop: spacing.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.sm,
  },
  blockerNote: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.lg, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.panel,
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12.5, fontWeight: '700', color: colors.text },
  chipTextOn: { color: colors.ice },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14.5,
    color: colors.text,
    backgroundColor: colors.panel,
  },
  textarea: { minHeight: 110, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.accentSoft2 },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,36,107,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  attachText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 12.5 },
  thread: { marginTop: spacing.md, gap: spacing.sm },
  msg: { borderRadius: radius.md, padding: spacing.md, gap: 6, borderWidth: 1 },
  msgStaff: { backgroundColor: colors.accentSoft2, borderColor: colors.border, marginRight: spacing.xl },
  msgUser: { backgroundColor: colors.panel, borderColor: colors.border, marginLeft: spacing.xl },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  msgAuthor: { fontSize: 13, fontWeight: '800', color: colors.text },
  msgTime: { fontSize: 11.5, color: colors.muted },
  msgBody: { fontSize: 14, color: colors.text, lineHeight: 20 },
});
