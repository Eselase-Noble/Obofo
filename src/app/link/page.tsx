import { redirect } from 'next/navigation';

// Linking now lives inside the dashboard shell (see LinkPanel), so this old
// standalone route just forwards to the app.
export default function LinkPage() {
  redirect('/');
}
