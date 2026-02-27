import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function UserRootPage() {
  const permsHeader = (await headers()).get('x-bfl-permissions');
  const perms = permsHeader ? (JSON.parse(permsHeader) as string[]) : [];

  if (perms.includes('menu:admin')) redirect('/choose-panel');
  redirect('/marketplace');
}
