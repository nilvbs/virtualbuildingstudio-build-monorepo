'use client';

import { useEffect, useRef, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { suggestAddresses, type AddressSuggestion } from '../lib/geocode';

type Props = {
  /** Picked place with coordinates plus parsed street / city / state / ZIP / country. */
  onSelect: (place: AddressSuggestion & { lat: number; lng: number }) => void;
};

function shortLabel(name: string) {
  const parts = name
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 2) return name;
  return `${parts[0]}, ${parts[1]}`;
}

export function LocationPlaceSearch({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AddressSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setSearching(false);
      setError(null);
      abortRef.current?.abort();
      return;
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setSearching(true);
      setError(null);

      try {
        const data = await suggestAddresses(q, ctrl.signal, { includePoi: true });
        setHits(data.filter((h) => h.lat != null && h.lng != null));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setHits([]);
        setError('Could not search places. Try again.');
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [query]);

  function selectHit(hit: AddressSuggestion | null) {
    if (!hit || hit.lat == null || hit.lng == null) return;
    onSelect({ ...hit, lat: hit.lat, lng: hit.lng });
    setQuery(hit.label);
  }

  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2">Search place</Typography>
      <Typography variant="body2">Find an address or landmark, then pin it on the map.</Typography>
      <Autocomplete
        freeSolo
        options={hits}
        filterOptions={(x) => x}
        getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
        inputValue={query}
        onInputChange={(_e, value) => setQuery(value ?? '')}
        onChange={(_e, value) => {
          if (value && typeof value !== 'string') selectHit(value);
        }}
        loading={searching}
        noOptionsText={error ?? (query.trim().length < 3 ? 'Type at least 3 characters' : 'No places found')}
        renderOption={(props, option) => {
          const { key, ...rest } = props;
          return (
            <li key={option.id} {...rest}>
              <PlaceOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              <span>
                <strong>{shortLabel(option.label)}</strong>
                <br />
                <Typography variant="caption" color="text.secondary">
                  {option.label}
                </Typography>
              </span>
            </li>
          );
        }}
        renderInput={(params) => {
          const inputSlot =
            params.slotProps?.input && typeof params.slotProps.input === 'object'
              ? params.slotProps.input
              : {};
          const htmlInputSlot =
            params.slotProps?.htmlInput && typeof params.slotProps.htmlInput === 'object'
              ? params.slotProps.htmlInput
              : {};
          return (
            <TextField
              {...params}
              placeholder="Search address, city, or landmark…"
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...htmlInputSlot,
                  autoComplete: 'off',
                },
                input: {
                  ...inputSlot,
                  startAdornment: (
                    <>
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="primary" />
                      </InputAdornment>
                      {'startAdornment' in inputSlot ? inputSlot.startAdornment : null}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {searching ? <CircularProgress color="inherit" size={16} /> : null}
                      {'endAdornment' in inputSlot ? inputSlot.endAdornment : null}
                    </>
                  ),
                },
              }}
            />
          );
        }}
      />
    </Stack>
  );
}
