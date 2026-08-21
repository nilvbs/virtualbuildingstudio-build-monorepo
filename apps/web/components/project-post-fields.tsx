'use client';

import type { ReactNode } from 'react';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';

const cardSx = (selected: boolean) => ({
  m: 0,
  width: '100%',
  px: 1.5,
  py: 1,
  borderRadius: 1.25,
  border: '1px solid',
  borderColor: selected ? 'primary.main' : 'divider',
  bgcolor: selected ? 'rgba(0, 36, 107, 0.06)' : 'background.paper',
  alignItems: 'flex-start',
  '& .MuiFormControlLabel-label': { fontSize: 14, fontWeight: selected ? 600 : 500 },
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
        value={value || ''}
        onChange={(_e, next) => onToggle(next as T)}
      >
        <Grid container spacing={1.25}>
          {options.map((opt) => {
            const selected = value === opt;
            return (
              <Grid key={opt} size={{ xs: 12, sm: 6 }}>
                <FormControlLabel
                  value={opt}
                  control={<Radio size="small" />}
                  label={labels[opt]}
                  sx={cardSx(selected)}
                />
              </Grid>
            );
          })}
        </Grid>
      </RadioGroup>
    );
  }

  const selectedList = Array.isArray(value) ? value : [];
  return (
    <Grid container spacing={1.25}>
      {options.map((opt) => {
        const selected = selectedList.includes(opt);
        return (
          <Grid key={opt} size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={
                <Checkbox size="small" checked={selected} onChange={() => onToggle(opt)} />
              }
              label={labels[opt]}
              sx={cardSx(selected)}
            />
          </Grid>
        );
      })}
    </Grid>
  );
}
