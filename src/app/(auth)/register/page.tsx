import { redirect } from 'next/navigation';

export default function RegisterPage() {
  // Registration is only available through admin panel
  redirect('/login');
}
