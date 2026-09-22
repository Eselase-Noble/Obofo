import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminDashboard from '@/components/AdminDashboard';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // Non-admins have no business here — send them back to their own dashboard.
  if (user.role !== 'admin') redirect('/');
  return <AdminDashboard />;
}
