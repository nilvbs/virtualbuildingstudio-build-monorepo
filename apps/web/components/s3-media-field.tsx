'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2, FileText } from 'lucide-react';
import { api, errorMessage } from '../lib/api';

type MediaKind = 'avatar' | 'portfolio' | 'document' | 'logo' | 'cover' | 'certificate';

type Props = {
  kind: MediaKind;
  label: string;
  hint?: string;
  url: string | null;
  fileName?: string | null;
  accept?: string;
  /** Wider preview for cover images */
  variant?: 'square' | 'wide' | 'doc';
  onUploaded: (result: { url: string; fileName: string }) => void;
  onCleared?: () => void;
};

function isImageUrl(url: string | null | undefined, fileName?: string | null): boolean {
  if (!url) return false;
  const probe = `${url} ${fileName ?? ''}`.toLowerCase();
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(probe) || probe.includes('image/');
}

export function S3MediaField({
  kind,
  label,
  hint,
  url,
  fileName,
  accept = 'image/jpeg,image/png,image/webp,image/gif,application/pdf',
  variant = 'square',
  onUploaded,
  onCleared,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const stored = await api.uploadMedia(file, kind, file.name);
      onUploaded({ url: stored.url, fileName: stored.fileName });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const showImage = Boolean(url) && isImageUrl(url, fileName);

  return (
    <div className={`s3-media s3-media-${variant}`}>
      <div className="s3-media-head">
        <span className="s3-media-label">{label}</span>
        {hint ? <span className="s3-media-hint">{hint}</span> : null}
      </div>

      <div className="s3-media-body">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url!} alt={label} className="s3-media-preview" />
        ) : url ? (
          <a className="s3-media-doc" href={url} target="_blank" rel="noreferrer">
            <FileText size={22} />
            <span>{fileName || 'Open file'}</span>
          </a>
        ) : (
          <button
            type="button"
            className="s3-media-empty"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 size={22} className="spin" /> : <ImagePlus size={22} />}
            <span>{busy ? 'Uploading to S3…' : 'Upload to S3'}</span>
          </button>
        )}

        {url ? (
          <div className="s3-media-actions">
            <button
              type="button"
              className="btn secondary sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? 'Uploading…' : 'Replace'}
            </button>
            {onCleared ? (
              <button
                type="button"
                className="btn secondary sm"
                disabled={busy}
                onClick={onCleared}
              >
                <Trash2 size={14} /> Remove
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      {error ? (
        <p className="s3-media-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
