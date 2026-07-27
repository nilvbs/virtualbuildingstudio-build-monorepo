import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  COUNTRY_DIALS,
  findCountry,
  type PhoneInputValue,
} from '../lib/country-codes';
import { colors, radius, shadows, spacing } from '../lib/theme';

export function PhoneNumberField({
  label = 'Mobile number',
  value,
  onChange,
}: {
  label?: string;
  value: PhoneInputValue;
  onChange: (next: PhoneInputValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const country = useMemo(() => findCountry(value.countryIso), [value.countryIso]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Pressable style={styles.countryBtn} onPress={() => setOpen(true)}>
          <Text style={styles.countryBtnText} numberOfLines={1}>
            {country.iso} {country.dial}
          </Text>
          <Feather name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          style={styles.input}
          value={value.national}
          onChangeText={(national) => onChange({ ...value, national })}
          keyboardType="phone-pad"
          placeholder={country.placeholder}
          placeholderTextColor={colors.faint}
        />
      </View>
      <Text style={styles.hint}>
        Example: {country.dial} {country.example}
      </Text>

      <Modal visible={open} animationType="slide" transparent>
        <Pressable style={styles.modalDim} onPress={() => setOpen(false)}>
          <Pressable style={[styles.modalSheet, shadows.lg]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Select country</Text>
            <ScrollView>
              {COUNTRY_DIALS.map((c) => (
                <Pressable
                  key={c.iso}
                  style={styles.modalRow}
                  onPress={() => {
                    onChange({ countryIso: c.iso, national: '' });
                    setOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>
                    {c.name} ({c.dial})
                  </Text>
                  {value.countryIso === c.iso ? (
                    <Feather name="check" size={18} color={colors.accent} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted },
  row: { flexDirection: 'row', gap: 8 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 118,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    minHeight: 48,
  },
  countryBtnText: { color: colors.text, fontWeight: '700', fontSize: 13, flexShrink: 1 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.panel,
    fontSize: 15,
  },
  hint: { color: colors.faint, fontSize: 12 },
  modalDim: {
    flex: 1,
    backgroundColor: 'rgba(11,18,32,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '70%',
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1, paddingRight: 12 },
});
