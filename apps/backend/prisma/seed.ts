import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../services/password.service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const prisma = new PrismaClient();

async function main() {
  console.log('Starting the seed process...');

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
  const superAdminPhoneNumber = process.env.SUPER_ADMIN_PHONE_NUMBER;

  if (!superAdminEmail || !superAdminPassword || !superAdminPhoneNumber) {
    throw new Error('SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_PHONE_NUMBER must be set in your .env file');
  }

  const hashedPassword = await hashPassword(superAdminPassword);

  // Using `upsert` to prevent creating a duplicate admin on subsequent seeds.
  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {}, // We don't want to update anything if the admin already exists
    create: {
      email: superAdminEmail,
      password: hashedPassword,
      phoneNumber: superAdminPhoneNumber,
      name: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      tenant: { create: { name: 'Super Admin', phoneNumber: "2091827661" } },
      // Note: tenantId is omitted, so it will be null
    },
  });

  console.log(`Super Admin user ensured: ${superAdmin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });