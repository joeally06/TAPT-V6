import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Resources } from './pages/Resources';
import { Contact } from './pages/Contact';
import { News } from './pages/News';
import { Events } from './pages/Events';
import { Members } from './pages/Members';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminUsers } from './pages/AdminUsers';
import { BoardMembers } from './pages/BoardMembers';
import { AdminBoardMembers } from './pages/AdminBoardMembers';
import { AdminContent } from './pages/AdminContent';
import { AdminArchives } from './pages/AdminArchives';
import { AdminMemberships } from './pages/AdminMemberships';
import ConferenceRegistration from './pages/ConferenceRegistration';
import TechConferenceRegistration from './pages/TechConferenceRegistration';
import ExhibitorRegistration from './pages/ExhibitorRegistration';
import StudentScholarshipApplication from './pages/StudentScholarshipApplication';
import { AdminConferenceRegistrations } from './pages/AdminConferenceRegistrations';
import AdminTechConferenceRegistrations from './pages/AdminTechConferenceRegistrations';
import AdminExhibitorRegistrations from './pages/AdminExhibitorRegistrations';
import AdminStudentScholarshipApplications from './pages/AdminStudentScholarshipApplications';
import { AdminConferenceSettings } from './pages/AdminConferenceSettings';
import { AdminTechConferenceSettings } from './pages/AdminTechConferenceSettings';
import AdminExhibitorSettings from './pages/AdminExhibitorSettings';
import AdminStudentScholarshipSettings from './pages/AdminStudentScholarshipSettings';
import { AdminHallOfFameSettings } from './pages/AdminHallOfFameSettings';
import { AdminHallOfFameNominations } from './pages/AdminHallOfFameNominations';
import { AdminHallOfFameMembers } from './pages/AdminHallOfFameMembers';
import { HallOfFameNomination } from './pages/HallOfFameNomination';
import { HallOfFameMembers } from './pages/HallOfFameMembers';
import AdminSiteSettings from './pages/AdminSiteSettings';
import AdminPaymentSettings from './pages/AdminPaymentSettings';
import AdminContactMessages from './pages/AdminContactMessages';
import AdminPaymentManagement from './pages/AdminPaymentManagement';
import AdminPhotoGallery from './pages/AdminPhotoGallery';
import ConferenceGalleryPage from './pages/ConferenceGalleryPage';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import './index.css';

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-t-4 border-b-4 border-primary rounded-full animate-spin mx-auto"></div>
          <h2 className="mt-4 text-xl font-semibold text-gray-800">Loading TAPT...</h2>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public Routes */}
          <Route
            path="/*"
            element={
              <div className="flex flex-col min-h-screen bg-gray-50">
                <main className="flex-grow">
                  <div className="container mx-auto px-4 py-8">
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/board-members" element={<BoardMembers />} />
                      <Route path="/resources" element={<Resources />} />
                      <Route path="/news" element={<News />} />
                      <Route path="/events" element={<Events />} />
                      <Route path="/members" element={<Members />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/conference-registration" element={<ConferenceRegistration />} />
                      <Route path="/tech-conference-registration" element={<TechConferenceRegistration />} />
                      <Route path="/exhibitor-registration" element={<ExhibitorRegistration />} />
                      <Route path="/student-scholarship-application" element={<StudentScholarshipApplication />} />
                      <Route path="/hall-of-fame-nomination" element={<HallOfFameNomination />} />
                      <Route path="/hall-of-fame-members" element={<HallOfFameMembers />} />
                      <Route path="/conference-gallery" element={<ConferenceGalleryPage />} />
                    </Routes>
                  </div>
                </main>
              </div>
            }
          />

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/payment-management" element={
            <ProtectedRoute requireAdmin>
              <AdminPaymentManagement />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute requireAdmin>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/board-members" element={
            <ProtectedRoute requireAdmin>
              <AdminBoardMembers />
            </ProtectedRoute>
          } />
          <Route path="/admin/content" element={
            <ProtectedRoute requireAdmin>
              <AdminContent />
            </ProtectedRoute>
          } />
          <Route path="/admin/archives" element={
            <ProtectedRoute requireAdmin>
              <AdminArchives />
            </ProtectedRoute>
          } />
          <Route path="/admin/memberships" element={
            <ProtectedRoute requireAdmin>
              <AdminMemberships />
            </ProtectedRoute>
          } />
          <Route path="/admin/conference-registrations" element={
            <ProtectedRoute requireAdmin>
              <AdminConferenceRegistrations />
            </ProtectedRoute>
          } />
          <Route path="/admin/tech-conference-registrations" element={
            <ProtectedRoute requireAdmin>
              <AdminTechConferenceRegistrations />
            </ProtectedRoute>
          } />
          <Route path="/admin/exhibitor-registrations" element={
            <ProtectedRoute requireAdmin>
              <AdminExhibitorRegistrations />
            </ProtectedRoute>
          } />
          <Route path="/admin/student-scholarship-applications" element={
            <ProtectedRoute requireAdmin>
              <AdminStudentScholarshipApplications />
            </ProtectedRoute>
          } />
          <Route path="/admin/conference-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminConferenceSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/tech-conference-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminTechConferenceSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/exhibitor-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminExhibitorSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/student-scholarship-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminStudentScholarshipSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/hall-of-fame-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminHallOfFameSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/hall-of-fame-nominations" element={
            <ProtectedRoute requireAdmin>
              <AdminHallOfFameNominations />
            </ProtectedRoute>
          } />
          <Route path="/admin/hall-of-fame-members" element={
            <ProtectedRoute requireAdmin>
              <AdminHallOfFameMembers />
            </ProtectedRoute>
          } />
          <Route path="/admin/site-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminSiteSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/payment-settings" element={
            <ProtectedRoute requireAdmin>
              <AdminPaymentSettings />
            </ProtectedRoute>
          } />
          <Route path="/admin/contact-messages" element={
            <ProtectedRoute requireAdmin>
              <AdminContactMessages />
            </ProtectedRoute>
          } />
          <Route path="/admin/photo-gallery" element={
            <ProtectedRoute requireAdmin>
              <AdminPhotoGallery />
            </ProtectedRoute>
          } />
        </Routes>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;