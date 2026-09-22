import { redirect } from 'next/navigation';
import { getPlatformAdmin } from '@/lib/auth';
import PlatformLogin from '@/components/PlatformLogin';

export default async function PlatformLoginPage() {
  // Already signed in as an admin? Skip straight to the console.
  if (await getPlatformAdmin()) redirect('/platform');
  return <PlatformLogin />;
}
