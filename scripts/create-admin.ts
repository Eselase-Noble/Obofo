import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

/**
 * Provision (or promote) an Ɔbɔfo platform admin. Admins are never created
 * through the public signup form — only here.
 *
 *   npm run create-admin -- --email admin@obofo.app [--name "Ada"] [--password "…"]
 *
 * If --password is omitted, a strong one is generated and printed once.
 */
function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg('--email') || '').trim().toLowerCase();
  const name = arg('--name')?.trim() || null;
  let password = arg('--password');

  if (!email || !email.includes('@')) {
    console.error('Usage: npm run create-admin -- --email <email> [--name "<name>"] [--password "<password>"]');
    process.exit(1);
  }

  const generated = !password;
  if (!password) password = randomBytes(9).toString('base64url');

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (existing) {
      // Promote in place. Only reset the password when one was explicitly given.
      await prisma.user.update({
        where: { email },
        data: { role: 'admin', active: true, ...(generated ? {} : { passwordHash }) },
      });
      console.log(`\n✓ Promoted existing account to admin: ${email}`);
      if (!generated) console.log('  Password was reset to the value you provided.');
    } else {
      await prisma.user.create({ data: { email, name, role: 'admin', active: true, passwordHash } });
      console.log(`\n✓ Created admin account: ${email}`);
      if (generated) {
        console.log(`  Temporary password: ${password}`);
        console.log('  Store it now — it will not be shown again.');
      }
    }
    console.log('\n  Sign in at /platform/login\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('create-admin failed:', err?.message ?? err);
  process.exit(1);
});
