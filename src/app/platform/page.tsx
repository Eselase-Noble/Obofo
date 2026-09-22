import { redirect } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/auth';
import AdminDashboard from '@/components/AdminDashboard';

export default async function PlatformPage() {
  // Requires a valid, separate admin session — the user cookie grants nothing here.
  if (!(await getPlatformAdmin())) redirect('/platform/login');
  return <AdminDashboard />;
}
