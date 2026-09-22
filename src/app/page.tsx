import { redirect } from 'next/navigation';
import { getUserId } from '@/lib/auth';
import Dashboard from '@/components/Dashboard';

export default async function Home() {
  const userId = await getUserId();
  if (!userId) redirect('/login');
  return <Dashboard />;
}
