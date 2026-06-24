'use client'

import { useState, useRef, useCallback } from 'react'
import type { PdfImportResult } from '@/app/api/admin/pdf-import/route'

type FileStatus = 'idle' | 'uploading' | 'done' | 'error'

interface PdfEntry {
  file: File
  status: FileStatus
  result?: PdfImportResult
  error?: string
  previewOpen: boolean
}

// Formats bytes into a human-readable string (e.g. "1.4 MB")
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImportUsersPanel() {
  const [entries, setEntries] = useState<PdfEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Add files, skipping duplicates (by name) and non-PDFs
  function addFiles(files: FileList | File[]) {
    const incoming = Array.from(files).filter(
      (f) =>
        f.type === 'application/pdf' &&
        !entries.some((e) => e.file.name === f.name)
    )
    if (incoming.length === 0) return
    setEntries((prev) => [
      ...prev,
      ...incoming.map((f) => ({ file: f, status: 'idle' as const, previewOpen: false })),
    ])
  }

  function removeEntry(name: string) {
    setEntries((prev) => prev.filter((e) => e.file.name !== name))
  }

  function togglePreview(name: string) {
    setEntries((prev) =>
      prev.map((e) =>
        e.file.name === name ? { ...e, previewOpen: !e.previewOpen } : e
      )
    )
  }

  // Upload a single entry
  async function uploadEntry(name: string) {
    const entry = entries.find((e) => e.file.name === name)
    if (!entry || entry.status === 'uploading' || entry.status === 'done') return

    setEntries((prev) =>
      prev.map((e) => (e.file.name === name ? { ...e, status: 'uploading', error: undefined } : e))
    )

    const formData = new FormData()
    formData.append('files', entry.file)

    try {
      const res = await fetch('/api/admin/pdf-import', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setEntries((prev) =>
          prev.map((e) =>
            e.file.name === name ? { ...e, status: 'error', error: data.error ?? 'Upload failed' } : e
          )
        )
        return
      }

      const result: PdfImportResult = (data as PdfImportResult[])[0]
      setEntries((prev) =>
        prev.map((e) =>
          e.file.name === name ? { ...e, status: 'done', result, previewOpen: true } : e
        )
      )
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.file.name === name ? { ...e, status: 'error', error: 'Network error' } : e
        )
      )
    }
  }

  // Upload all idle entries sequentially to avoid overwhelming the server
  async function uploadAll() {
    const idle = entries.filter((e) => e.status === 'idle')
    for (const e of idle) {
      await uploadEntry(e.file.name)
    }
  }

  // Drag-and-drop handlers
  const onDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    setIsDragging(true)
  }, [])
  const onDragLeave = useCallback(() => setIsDragging(false), [])
  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault()
      setIsDragging(false)
      addFiles(ev.dataTransfer.files)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries]
  )

  const idleCount = entries.filter((e) => e.status === 'idle').length
  const doneCount = entries.filter((e) => e.status === 'done').length

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer px-6 py-10 transition-colors select-none ${
          isDragging
            ? 'border-blue-500 bg-blue-950/30'
            : 'border-gray-700 bg-gray-900/50 hover:border-gray-500 hover:bg-gray-900'
        }`}
      >
        <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        <p className="text-sm text-gray-400">
          Drag & drop PDF files here, or <span className="text-blue-400 underline">browse</span>
        </p>
        <p className="text-xs text-gray-600">One PDF per user · Max 10 MB per file</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files) }}
        />
      </div>

      {/* File list */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {/* Bulk action bar */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {entries.length} file{entries.length !== 1 ? 's' : ''} selected
              {doneCount > 0 && ` · ${doneCount} extracted`}
            </span>
            <div className="flex items-center gap-2">
              {idleCount > 0 && (
                <button
                  type="button"
                  onClick={uploadAll}
                  className="rounded-lg px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  Extract all ({idleCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => setEntries([])}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>

          {/* Per-file rows */}
          {entries.map((entry) => (
            <div
              key={entry.file.name}
              className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden"
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status icon */}
                <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                  {entry.status === 'idle' && (
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  )}
                  {entry.status === 'uploading' && (
                    <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a10 10 0 100 10h-4a8 8 0 01-8-8z" />
                    </svg>
                  )}
                  {entry.status === 'done' && (
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  )}
                  {entry.status === 'error' && (
                    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                  )}
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{entry.file.name}</p>
                  <p className="text-xs text-gray-600">{formatBytes(entry.file.size)}</p>
                </div>

                {/* Error message */}
                {entry.error && (
                  <p className="text-xs text-red-400 max-w-xs truncate">{entry.error}</p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {entry.status === 'idle' && (
                    <button
                      type="button"
                      onClick={() => uploadEntry(entry.file.name)}
                      className="rounded px-2.5 py-1 text-xs bg-blue-700 hover:bg-blue-600 text-white transition-colors"
                    >
                      Extract
                    </button>
                  )}
                  {entry.status === 'error' && (
                    <button
                      type="button"
                      onClick={() => uploadEntry(entry.file.name)}
                      className="rounded px-2.5 py-1 text-xs bg-amber-800 hover:bg-amber-700 text-amber-200 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  {entry.status === 'done' && (
                    <button
                      type="button"
                      onClick={() => togglePreview(entry.file.name)}
                      className="rounded px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                    >
                      {entry.previewOpen ? 'Hide text' : 'View text'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.file.name)}
                    className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Extracted text preview */}
              {entry.previewOpen && entry.result && (
                <div className="border-t border-gray-800 px-4 py-3 bg-gray-950">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Extracted text · {entry.result.text.length.toLocaleString()} chars
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(entry.result!.text).catch(() => {})
                      }}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={entry.result.text}
                    rows={12}
                    className="w-full rounded bg-gray-900 border border-gray-800 px-3 py-2 text-xs text-gray-300 font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-gray-700"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state when nothing is added yet */}
      {entries.length === 0 && (
        <p className="text-center text-xs text-gray-600">
          No files selected yet. Add PDF profiles above to extract their text.
        </p>
      )}
    </div>
  )
}
