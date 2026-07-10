import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './App.css';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import Home from './components/Home/Home';
import Schedule from './components/Schedule/Schedule';
import Registration from './components/Registration/Registration';
import Leaderboard from './components/Leaderboard/Leaderboard';
import Donations from './components/Donations/Donations';
import About from './components/About/About';
import TournamentHistory from './components/TournamentHistory/TournamentHistory';
import Unsubscribe from './components/Unsubscribe/Unsubscribe';
import SEO from './components/SEO';

// Admin imports
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AdminLogin from './components/Admin/AdminLogin';
import SetPassword from './components/Admin/SetPassword';
import AdminLayout from './components/Admin/AdminLayout';
import AdminDashboard from './components/Admin/AdminDashboard';
import RegistrationList from './components/Admin/Registrations/RegistrationList';
import FinancialsList from './components/Admin/Financials/FinancialsList';
import ContactList from './components/Admin/Contacts/ContactList';
import EmailCampaign from './components/Admin/Communications/EmailCampaign';
import CampaignHistory from './components/Admin/Communications/CampaignHistory';
import UnsubscribeManager from './components/Admin/Communications/UnsubscribeManager';
import TemplateList from './components/Admin/Communications/TemplateList';
import TournamentList from './components/Admin/Tournaments/TournamentList';
import EventList from './components/Admin/Events/EventList';
import AwardList from './components/Admin/Awards/AwardList';
import TeeTimesManagement from './components/Admin/TeeTimes/TeeTimesManagement';
import LeaderboardManagement from './components/Admin/Leaderboard/LeaderboardManagement';
import TeamList from './components/Admin/Teams/TeamList';
import TeamBuilder from './components/Admin/TeamBuilder/TeamBuilder';
import ChangePassword from './components/Admin/ChangePassword';
import RecycleBin from './components/Admin/RecycleBin/RecycleBin';
import AuditLog from './components/Admin/Audit/AuditLog';
import ProtectedRoute from './components/Admin/ProtectedRoute';

// Component for external redirects (can't use Navigate for full URLs)
function ExternalRedirect({ url }) {
  useEffect(() => {
    window.location.href = url;
  }, [url]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

function App() {
  // Detect if we're on the admin subdomain - initialize immediately to avoid race condition
  const [isAdminSite, setIsAdminSite] = useState(() => {
    // Check on initial load
    return window.location.hostname.startsWith('admin.');
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    const isAdmin = hostname.startsWith('admin.');

    // Update state if needed
    if (isAdmin !== isAdminSite) {
      setIsAdminSite(isAdmin);
    }

    // Optional: Log for debugging during development
    if (process.env.NODE_ENV === 'development') {
      console.log('Current hostname:', hostname);
      console.log('Is admin site:', isAdmin);
    }
  }, [isAdminSite]);
  return (
    <ThemeProvider followSystem={isAdminSite}>
      <AuthProvider>
      <Router>
        <Routes>
          {/* PUBLIC SITE (www.kathrynclassic.com or localhost) */}
          {!isAdminSite && (
            <>
              <Route path="/*" element={
                <div className="App min-h-screen flex flex-col bg-white dark:bg-night-900">
                  <Navbar />
                  <main className="flex-grow">
                    <Routes>
                      <Route path="/" element={<><SEO path="/" /><Home /></>} />
                      <Route path="/schedule" element={<><SEO title="Schedule" path="/schedule" description="Weekend schedule for The Kathryn Classic charity golf tournament — events, tee times, and festivities." /><Schedule /></>} />
                      <Route path="/registration" element={<><SEO title="Registration" path="/registration" description="Register to play in The Kathryn Classic charity golf tournament supporting CJD research through the CJD Foundation." /><Registration /></>} />
                      <Route path="/leaderboard" element={<><SEO title="Leaderboard" path="/leaderboard" description="Live leaderboard and results for The Kathryn Classic charity golf tournament." /><Leaderboard /></>} />
                      <Route path="/donations" element={<><SEO title="Donate" path="/donations" description="Support CJD research by donating to The Kathryn Classic and the CJD Foundation." /><Donations /></>} />
                      <Route path="/about" element={<><SEO title="About" path="/about" description="Learn the story behind The Kathryn Classic — a charity golf tournament raising funds and awareness for CJD research." /><About /></>} />
                      <Route path="/history" element={<><SEO title="Tournament History" path="/history" description="Past winners and highlights from previous years of The Kathryn Classic charity golf tournament." /><TournamentHistory /></>} />
                      <Route path="/unsubscribe" element={<><SEO title="Unsubscribe" path="/unsubscribe" description="Manage your email preferences for The Kathryn Classic." /><Unsubscribe /></>} />
                      {/* Redirect admin attempts to admin subdomain */}
                      <Route path="/admin/*" element={
                        <ExternalRedirect url={`${window.location.protocol}//admin.${window.location.hostname.replace('www.', '').replace('admin.', '')}${window.location.pathname}`} />
                      } />
                    </Routes>
                  </main>
                  <Footer />
                </div>
              } />
            </>
          )}

          {/* ADMIN SITE (admin.kathrynclassic.com) */}
          {isAdminSite && (
            <>
              {/* Admin login routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/set-password" element={<SetPassword />} />

              {/* Protected admin routes */}
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<AdminDashboard />} />
                <Route path="tournaments" element={<TournamentList />} />
                <Route path="events" element={<EventList />} />
                <Route path="registrations" element={<RegistrationList />} />
                <Route path="financials" element={<FinancialsList />} />
                <Route path="contacts" element={<ContactList />} />
                <Route path="communications" element={<EmailCampaign />} />
                <Route path="communications/templates" element={<TemplateList />} />
                <Route path="communications/history" element={<CampaignHistory />} />
                <Route path="communications/unsubscribes" element={<UnsubscribeManager />} />
                <Route path="tee-times" element={<TeeTimesManagement />} />
                <Route path="leaderboard" element={<LeaderboardManagement />} />
                <Route path="teams" element={<TeamList />} />
                <Route path="team-builder" element={<TeamBuilder />} />
                <Route path="awards" element={<AwardList />} />
                <Route path="recycle-bin" element={<RecycleBin />} />
                <Route path="audit" element={<AuditLog />} />
                <Route path="change-password" element={<ChangePassword />} />
              </Route>

              {/* Redirect root to admin login */}
              <Route path="/" element={<Navigate to="/admin/login" replace />} />

              {/* Redirect any other public routes to main site */}
              <Route path="/*" element={
                <ExternalRedirect url={`${window.location.protocol}//${window.location.hostname.replace('admin.', '').replace(/^(?!www\.)/, 'www.')}${window.location.pathname}`} />
              } />
            </>
          )}
        </Routes>
      </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
