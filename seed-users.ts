import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Check if admin already exists
  let admin = await prisma.user.findUnique({ where: { email: 'admin@yasserabdallah.com' } });
  
  if (!admin) {
    const hashedPassword = await hash('Admin123', 12);
    admin = await prisma.user.create({
      data: {
        email: 'admin@yasserabdallah.com',
        displayName: 'Yasser Admin',
        password: hashedPassword,
        role: 'admin',
        isActive: true,
        isApproved: true,
      },
    });
    console.log('Created admin user:', admin.email);
  } else {
    console.log('Admin user already exists:', admin.email);
  }

  // Create agent user
  let agent = await prisma.user.findUnique({ where: { email: 'agent@yasserabdallah.com' } });
  if (!agent) {
    const hashedPassword = await hash('Agent123', 12);
    agent = await prisma.user.create({
      data: {
        email: 'agent@yasserabdallah.com',
        displayName: 'Ahmed Agent',
        password: hashedPassword,
        role: 'agent',
        isActive: true,
        isApproved: true,
      },
    });
    console.log('Created agent user:', agent.email);
  } else {
    console.log('Agent user already exists:', agent.email);
  }

  // Create viewer user
  let viewer = await prisma.user.findUnique({ where: { email: 'viewer@yasserabdallah.com' } });
  if (!viewer) {
    const hashedPassword = await hash('Viewer123', 12);
    viewer = await prisma.user.create({
      data: {
        email: 'viewer@yasserabdallah.com',
        displayName: 'Sara Viewer',
        password: hashedPassword,
        role: 'viewer',
        isActive: true,
        isApproved: true,
      },
    });
    console.log('Created viewer user:', viewer.email);
  } else {
    console.log('Viewer user already exists:', viewer.email);
  }

  // Create a pending approval user
  let pending = await prisma.user.findUnique({ where: { email: 'pending@yasserabdallah.com' } });
  if (!pending) {
    const hashedPassword = await hash('Pending123', 12);
    pending = await prisma.user.create({
      data: {
        email: 'pending@yasserabdallah.com',
        displayName: 'Mohamed Pending',
        password: hashedPassword,
        role: 'agent',
        isActive: true,
        isApproved: false,
      },
    });
    console.log('Created pending user:', pending.email);
  } else {
    console.log('Pending user already exists:', pending.email);
  }

  // List all users
  const allUsers = await prisma.user.findMany({
    select: { email: true, displayName: true, role: true, isActive: true, isApproved: true },
  });
  console.log('\nAll users in database:');
  allUsers.forEach(u => {
    console.log(`  ${u.email} | ${u.displayName} | role: ${u.role} | active: ${u.isActive} | approved: ${u.isApproved}`);
  });

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
