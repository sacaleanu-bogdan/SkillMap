import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { extractText } from 'unpdf'

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = 'application/pdf'

export interface PdfImportResult {
  fileName: string
  text: string
}

// POST /api/admin/pdf-import
// Accepts multipart/form-data with one or more PDF files under the key "files".
// Returns an array of { fileName, text } objects — one per uploaded file.
// Admin-only.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart request' }, { status: 400 })
  }

  const files = formData.getAll('files') as File[]
  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const results: PdfImportResult[] = []

  for (const file of files) {
    // Type guard
    if (file.type !== ALLOWED_MIME) {
      return NextResponse.json(
        { error: `File "${file.name}" is not a PDF (received type: ${file.type})` },
        { status: 400 }
      )
    }

    // Size guard
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds the 10 MB limit` },
        { status: 413 }
      )
    }

    // Convert File → Uint8Array for unpdf
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    let text: string
    try {
      // extractText returns { totalPages, text } — we only need the text
      const result = await extractText(buffer, { mergePages: true })
      // unpdf may return text as string[] (one element per page) or a single string
      text = Array.isArray(result.text) ? result.text.join('\n\n') : result.text
    } catch (err) {
      console.error(`[pdf-import] Failed to extract text from "${file.name}":`, err)
      return NextResponse.json(
        { error: `Could not extract text from "${file.name}". The file may be corrupt or encrypted.` },
        { status: 422 }
      )
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: `No text found in "${file.name}". The file may contain only images.` },
        { status: 422 }
      )
    }

    results.push({ fileName: file.name, text: text.trim() })
  }

  return NextResponse.json(results, { status: 200 })
}
