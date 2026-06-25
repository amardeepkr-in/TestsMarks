import { getSubmissions, getSettings, getSubmissionStats } from '../lib/actions';
import { validateSession } from '../lib/auth';
import HomeContent from '../components/HomeContent';
import DashboardSummary from '../components/DashboardSummary';
import SettingsPanel from '../components/SettingsPanel';

export default async function Home() {
  const submissions = await getSubmissions();
  const settings = await getSettings();
  const stats = await getSubmissionStats();
  const user = await validateSession();
  const isAdmin = !!user;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Marks & Admit Card Portal</h1>
            <p className="subtitle">Upload and view marks and admit cards</p>
          </div>
        </div>
      </header>

      <main className="main-content">
        <DashboardSummary stats={stats} />
        <HomeContent submissions={submissions} />
      </main>

      <SettingsPanel initialSettings={settings} isAdmin={isAdmin} />
    </div>
  );
}

