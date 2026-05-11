import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { normalizePhone, getPhoneError } from '@/lib/phone';
import * as XLSX from 'xlsx';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls'];

const COLUMN_MAP: Record<string, string> = {
  name: 'name',
  الاسم: 'name',
  phone: 'phone',
  الرقم: 'phone',
  email: 'email',
  البريد: 'email',
  city: 'city',
  المدينة: 'city',
  tags: 'tags',
  التاجات: 'tags',
  notes: 'notes',
  ملاحظات: 'notes',
};

function resolveColumn(header: string): string | null {
  const trimmed = String(header).trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  for (const [key, value] of Object.entries(COLUMN_MAP)) {
    if (key.toLowerCase() === lower) {
      return value;
    }
  }

  return null;
}

// Error categories for import report classification
interface SkippedEntry {
  row: number;
  rawPhone: string;
  name: string;
  reason: string;
  category: string;
}

function classifyError(rawPhone: string, normalizedPhone: string, isDuplicate: boolean): { reason: string; category: string } {
  if (!rawPhone || !rawPhone.trim()) {
    return { reason: 'رقم الهاتف فارغ', category: 'أرقام فارغة' };
  }

  const phoneError = getPhoneError(rawPhone);
  if (phoneError) {
    // Classify by Arabic error message
    if (phoneError.includes('فارغ')) {
      return { reason: phoneError, category: 'أرقام فارغة' };
    }
    if (phoneError.includes('لا يحتوي على أرقام')) {
      return { reason: phoneError, category: 'بدون أرقام' };
    }
    if (phoneError.includes('غير مكتمل')) {
      return { reason: phoneError, category: 'أرقام غير مكتملة' };
    }
    if (phoneError.includes('طويل جداً')) {
      return { reason: phoneError, category: 'أرقام طويلة جداً' };
    }
    if (phoneError.includes('قصير جداً')) {
      return { reason: phoneError, category: 'أرقام قصيرة جداً' };
    }
    return { reason: phoneError, category: 'أرقام غير صالحة' };
  }

  if (!normalizedPhone) {
    return { reason: 'رقم غير صالح', category: 'أرقام غير صالحة' };
  }

  if (isDuplicate) {
    return { reason: 'الرقم موجود مسبقاً', category: 'أرقام مكررة' };
  }

  return { reason: 'سبب غير معروف', category: 'أخرى' };
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use "file" field name.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit.' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) =>
      fileName.endsWith(ext)
    );
    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .xlsx and .xls files are allowed.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: 'The Excel file is empty or has no data rows.' },
        { status: 400 }
      );
    }

    const firstRow = rows[0];
    const headerMapping: Record<string, string> = {};
    for (const key of Object.keys(firstRow)) {
      const resolved = resolveColumn(key);
      if (resolved) {
        headerMapping[key] = resolved;
      }
    }

    const phoneHeaderKey = Object.keys(headerMapping).find(
      (k) => headerMapping[k] === 'phone'
    );
    if (!phoneHeaderKey) {
      return NextResponse.json(
        { error: 'Missing required "Phone" column. Ensure your file has a Phone (الرقم) column.' },
        { status: 400 }
      );
    }

    const total = rows.length;
    const importedList: Array<{ row: number; phone: string; name: string }> = [];
    const skippedList: SkippedEntry[] = [];
    const errorCategories: Record<string, number> = {};

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;

      const getValue = (field: string): string => {
        const headerKey = Object.keys(headerMapping).find(
          (k) => headerMapping[k] === field
        );
        if (!headerKey) return '';
        const raw = String(row[headerKey] ?? '').trim();
        return raw;
      };

      const rawPhone = getValue('phone');
      const name = getValue('name') || '';
      const normalizedPhone = normalizePhone(rawPhone);

      // Check if duplicate
      const isDuplicate = normalizedPhone ? await db.contact.findUnique({
        where: { phone: normalizedPhone },
      }).then((c) => !!c) : false;

      if (!rawPhone || !normalizedPhone || isDuplicate) {
        const { reason, category } = classifyError(rawPhone, normalizedPhone, isDuplicate);
        skippedList.push({
          row: rowNumber,
          rawPhone: rawPhone || '(فارغ)',
          name,
          reason,
          category,
        });
        errorCategories[category] = (errorCategories[category] || 0) + 1;
        continue;
      }

      const contactName = name || `Contact ${normalizedPhone.slice(-4)}`;
      const email = getValue('email') || null;
      const city = getValue('city') || null;
      const tags = getValue('tags') || '';
      const notes = getValue('notes') || '';

      try {
        await db.contact.create({
          data: {
            name: contactName.trim(),
            phone: normalizedPhone,
            email: email?.trim() || null,
            city: city?.trim() || null,
            tags: tags.trim(),
            notes: notes.trim(),
            source: 'import',
          },
        });
        importedList.push({ row: rowNumber, phone: normalizedPhone, name: contactName });
      } catch {
        const category = 'فشل في الإضافة';
        skippedList.push({
          row: rowNumber,
          rawPhone: rawPhone,
          name: contactName,
          reason: 'فشل في إضافة جهة الاتصال',
          category,
        });
        errorCategories[category] = (errorCategories[category] || 0) + 1;
      }
    }

    return NextResponse.json({
      imported: importedList.length,
      skipped: skippedList.length,
      total,
      importedContacts: importedList,
      skippedContacts: skippedList,
      errorCategories,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return NextResponse.json(
        { error: 'Invalid request. Expected multipart/form-data with a file.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
