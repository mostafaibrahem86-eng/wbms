import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth';

const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await db.user.upsert({
    where: { email: 'admin@wbms.com' },
    update: {},
    create: {
      email: 'admin@wbms.com',
      name: 'Admin',
      password: adminPassword,
      role: 'admin',
      isActive: true,
      isApproved: true,
    },
  });

  console.log('Admin user created:', admin.email);

  // Create default settings
  const defaultSettings = [
    { key: 'whatsapp_api_token', value: '' },
    { key: 'whatsapp_phone_number_id', value: '' },
    { key: 'whatsapp_api_url', value: 'https://graph.facebook.com/v25.0' },
    { key: 'whatsapp_business_account_id', value: '' },
    { key: 'whatsapp_verify_token', value: 'wbms_verify_token' },
    { key: 'auto_reply_enabled', value: 'false' },
    { key: 'notification_enabled', value: 'true' },
    { key: 'max_conversations_per_agent', value: '10' },
  ];

  for (const setting of defaultSettings) {
    await db.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('Default settings created');
  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
