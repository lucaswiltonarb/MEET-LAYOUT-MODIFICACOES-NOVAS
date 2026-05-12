import { Routes, Route, useParams, Outlet } from 'react-router-dom';
import AppProvider from './contexts/AppProvider';
import MeetProvider from './contexts/MeetProvider';

import Home from './pages/Home';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import Lobby from './pages/Lobby';
import Meeting from './pages/Meeting';
import MeetingEnd from './pages/MeetingEnd';
import AdminLogin from './pages/AdminLogin';
import AdminDashboardPage from './pages/AdminDashboard';
import AdminPlansPage from './pages/AdminPlans';
import AdminExpertsPage from './pages/AdminExperts';
import ExpertHome from './pages/ExpertHome';
import ExpertMeeting from './pages/ExpertMeeting';
import AdminLayout from './layouts/AdminLayout';

function MeetingLayout() {
  const { meetingId } = useParams();
  return <MeetProvider meetingId={meetingId!}><Outlet /></MeetProvider>;
}

export default function App() {
  return (
    <AppProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in/*" element={<SignInPage />} />
        <Route path="/sign-up/*" element={<SignUpPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminLayout><AdminDashboardPage /></AdminLayout>} />
        <Route path="/admin/plans" element={<AdminLayout><AdminPlansPage /></AdminLayout>} />
        <Route path="/admin/experts" element={<AdminLayout><AdminExpertsPage /></AdminLayout>} />
        <Route path="/expert" element={<ExpertHome />} />
        <Route path="/expert/:meetingId" element={<ExpertMeeting />} />
        <Route path="/:meetingId" element={<MeetingLayout />}>
          <Route index element={<Lobby />} />
          <Route path="meeting" element={<Meeting />} />
          <Route path="meeting-end" element={<MeetingEnd />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
