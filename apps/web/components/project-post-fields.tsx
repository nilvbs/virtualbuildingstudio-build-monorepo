'use client';

import type { ReactNode } from 'react';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';

const cardSx = (selected: boolean) => ({
  m: 0,
  width: '100%',
  height: '100%',
  minHeight: 48,
  px: 1.25,
  py: 1,
  borderRadius: '10px',
  border: '1px solid',
  borderColor: selected ? 'primary.main' : 'rgba(113, 104, 246, 0.14)',
  bgcolor: selected ? 'rgba(113, 104, 246, 0.08)' : '#fff',
  alignItems: 'center',
  mx: 0,
  transition: 'border-color 0.15s ease, background-color 0.15s ease',
  '&:hover': {
    borderColor: selected ? 'primary.main' : 'rgba(91, 82, 224, 0.32)',
    bgcolor: selected ? 'rgba(113, 104, 246, 0.1)' : '#faf9ff',
  },
  '& .MuiCheckbox-root, & .MuiRadio-root': {
    p: 0.5,
    mr: 0.75,
  },
  '& .MuiFormControlLabel-label': {
    fontSize: 13.25,
    lineHeight: 1.25,
    fontWeight: selected ? 650 : 500,
    color: '#2a2558',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
});

export function FieldLabel({
  children,
  hint,
  required,
}: {
  children: ReactNode;
  hint?: ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <Typography variant="subtitle2" component="div" sx={{ mb: hint ? 0.5 : 1 }}>
        {children}
        {required ? ' *' : ''}
      </Typography>
      {hint ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          {hint}
        </Typography>
      ) : null}
    </div>
  );
}

export function ChoicePills<T extends string>({
  options,
  labels,
  value,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | '' | null | undefined;
  onChange: (value: T) => void;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <ToggleButton
          key={opt}
          value={opt}
          selected={value === opt}
          onChange={() => onChange(opt)}
          size="small"
        >
          {labels[opt]}
        </ToggleButton>
      ))}
    </Stack>
  );
}

export function MultiPills<T extends string>({
  options,
  labels,
  value,
  onToggle,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const selected = value.includes(opt);
        return (
          <ToggleButton
            key={opt}
            value={opt}
            selected={selected}
            onChange={() => onToggle(opt)}
            size="small"
          >
            {labels[opt]}
          </ToggleButton>
        );
      })}
    </Stack>
  );
}

/** Keeps long option lists compact: ~6 rows visible, then scroll. */
export const MENU_PROPS = {
  slotProps: {
    paper: {
      sx: {
        maxHeight: 260,
        '& .MuiMenuItem-root': { minHeight: 36, fontSize: 14, py: 0.75 },
      },
    },
  },
};

/** Checkbox dropdown; pass `groups` to show section headers inside the menu. */
export function MultiSelectField<T extends string>({
  id,
  label,
  options,
  labels,
  value,
  onChange,
  groups,
  helperText,
  required,
  disabled,
  chips,
}: {
  id: string;
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: readonly T[];
  onChange: (next: T[]) => void;
  groups?: readonly { id: string; label: string; items: readonly T[] }[];
  helperText?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Show the selection as chips inside the field instead of comma text. */
  chips?: boolean;
}) {
  const item = (opt: T) => (
    <MenuItem key={opt} value={opt} dense>
      <Checkbox size="small" checked={value.includes(opt)} sx={{ p: 0.5, mr: 1 }} />
      <ListItemText primary={labels[opt]} />
    </MenuItem>
  );
  const menuItems = groups
    ? groups.flatMap((g) => [
        <ListSubheader key={`h-${g.id}`} sx={{ lineHeight: '32px', fontWeight: 700 }}>
          {g.label}
        </ListSubheader>,
        ...g.items.map(item),
      ])
    : options.map(item);

  return (
    <FormControl fullWidth required={required} disabled={disabled}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select<T[]>
        multiple
        labelId={`${id}-label`}
        label={label}
        value={[...value]}
        onChange={(e) => {
          const next = e.target.value;
          onChange((typeof next === 'string' ? next.split(',') : next) as T[]);
        }}
        renderValue={(selected) =>
          chips ? (
            <Stack direction="row" useFlexGap spacing={0.5} sx={{ flexWrap: 'wrap' }}>
              {selected.map((s) => (
                <Chip
                  key={s}
                  size="small"
                  label={labels[s]}
                  sx={{ bgcolor: 'rgba(113, 104, 246, 0.1)', color: '#3f37c9', fontWeight: 600 }}
                />
              ))}
            </Stack>
          ) : (
            selected.map((s) => labels[s]).join(', ')
          )
        }
        MenuProps={MENU_PROPS}
      >
        {menuItems}
      </Select>
      {helperText ? <FormHelperText>{helperText}</FormHelperText> : null}
    </FormControl>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  options,
  labels,
  value,
  onChange,
  emptyLabel = 'No preference',
  required,
}: {
  id: string;
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null | undefined;
  onChange: (next: T | null) => void;
  emptyLabel?: string;
  required?: boolean;
}) {
  return (
    <FormControl fullWidth required={required}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        label={label}
        value={value ?? ''}
        onChange={(e) => onChange((e.target.value as T) || null)}
        MenuProps={MENU_PROPS}
      >
        <MenuItem value="">
          <em>{emptyLabel}</em>
        </MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt} value={opt}>
            {labels[opt]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function OptionCards<T extends string>({
  options,
  labels,
  value,
  onToggle,
  exclusive,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | readonly T[] | '' | null | undefined;
  onToggle: (value: T) => void;
  exclusive?: boolean;
}) {
  if (exclusive) {
    return (
      <RadioGroup
        className="project-post-options"
        value={value || ''}
        onChange={(_e, next) => onToggle(next as T)}
      >
        {options.map((opt) => {
          const selected = value === opt;
          return (
            <FormControlLabel
              key={opt}
              value={opt}
              control={<Radio size="small" />}
              label={labels[opt]}
              sx={cardSx(selected)}
            />
          );
        })}
      </RadioGroup>
    );
  }

  const selectedList = Array.isArray(value) ? value : [];
  return (
    <div className="project-post-options">
      {options.map((opt) => {
        const selected = selectedList.includes(opt);
        return (
          <FormControlLabel
            key={opt}
            control={
              <Checkbox size="small" checked={selected} onChange={() => onToggle(opt)} />
            }
            label={labels[opt]}
            sx={cardSx(selected)}
          />
        );
      })}
    </div>
  );
}
