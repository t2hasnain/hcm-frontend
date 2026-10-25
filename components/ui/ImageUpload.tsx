'use client';
import React, { useState, useRef } from 'react';
import { UploadCloud, X, CheckCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { extractErrorMessage } from '@/lib/utils';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  helper?: string;
}

export function ImageUpload({
  value,
  onChange,
  label = 'Company Logo',
  helper = 'Supports PNG, JPG, SVG, WebP up to 32MB via ImgBB',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, SVG, WebP)');
      return;
    }
    if (file.size > 32 * 1024 * 1024) {
      setError('Image must be under 32MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data } = await api.post('/api/v1/setup/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (data && data.url) {
        onChange(data.url);
      } else {
        throw new Error('Upload succeeded but no URL was returned');
      }
    } catch (err: unknown) {
      const msg = extractErrorMessage(err, 'Failed to upload image to ImgBB');
      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      {value ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Uploaded logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              Uploaded to ImgBB Cloud
            </p>
            <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{value}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
              dragOver
                ? 'border-[#0066FF] bg-blue-50/50 dark:bg-blue-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-[#0066FF] bg-slate-50/50 dark:bg-slate-900/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            {uploading ? (
              <div className="flex items-center gap-2 text-xs font-medium text-[#0066FF]">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Uploading image to ImgBB cloud...</span>
              </div>
            ) : (
              <>
                <div className="h-9 w-9 rounded-full bg-blue-100 dark:bg-blue-900/40 text-[#0066FF] flex items-center justify-center">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-[#0066FF]">Click to browse</span> or drag and drop
                </div>
                <p className="text-[11px] text-slate-400">PNG, JPG, SVG or WebP (Hosted on ImgBB)</p>
              </>
            )}
          </div>

          {/* Or enter direct URL */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] text-slate-400 shrink-0">Or URL:</span>
            <input
              type="url"
              placeholder="https://i.ibb.co/..."
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      {helper && !error && <p className="text-[11px] text-slate-400 mt-0.5">{helper}</p>}
    </div>
  );
}
