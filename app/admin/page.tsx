import { getSubmissions, getSettings, getSubmissionStats } from '../../lib/actions';
import AdminDashboard from '../../components/AdminDashboard';

export default async function AdminPage() {
  const submissions = await getSubmissions();
  const settings = await getSettings();
  const stats = await getSubmissionStats();

  return <AdminDashboard submissions={submissions} stats={stats} settings={settings} />;
}

