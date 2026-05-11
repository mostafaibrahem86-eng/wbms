import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Template matches current Contact fields:
    // Name, Phone, Email, City, Status, Tags, Notes
    const templateData = [
      {
        Name: 'Ahmed Mohamed',
        Phone: '+201002792065',
        Email: 'ahmed@example.com',
        City: 'Cairo',
        Status: 'active',
        Tags: 'customer, vip',
        Notes: 'VIP client from Cairo',
      },
      {
        Name: 'Sara Ali',
        Phone: '+966501234567',
        Email: '',
        City: 'Riyadh',
        Status: 'lead',
        Tags: 'new',
        Notes: '',
      },
      {
        Name: 'Mostafa Ibrahim',
        Phone: '+971509876543',
        Email: 'mostafa@example.com',
        City: 'Abu Dhabi',
        Status: 'prospect',
        Tags: 'follow-up',
        Notes: 'Interested in premium plan',
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 22 }, // Name
      { wch: 20 }, // Phone
      { wch: 28 }, // Email
      { wch: 15 }, // City
      { wch: 12 }, // Status
      { wch: 22 }, // Tags
      { wch: 30 }, // Notes
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="contacts_template.xlsx"',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
