import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './context/AuthContext.tsx';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CheckYourEmailPage from './pages/CheckYourEmailPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResendVerificationPage from './pages/ResendVerificationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import CourseDetailPage from './pages/CourseDetailPage';
import NotFoundPage from './pages/NotFoundPage';
import ProtectedRoute from './components/ProtectedRoute';
import GuestRoute from './components/GuestRoute';
import RequireRole from './components/RequireRole';
import DashboardLayout from './components/layout/DashboardLayout';
import PlayerCoursesPage from './pages/PlayerCoursesPage';
import InstructorCoursesPage from './pages/InstructorCoursesPage';
import InstructorCourseDetailPage from './pages/InstructorCourseDetailPage';
import InstructorLessonContentsPage from './pages/InstructorLessonContentsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import './App.css';
import { useAuth } from './hooks/useAuth';

// Redirection d'accueil selon le rôle
function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Chargement...</div>;
  const role = user?.role;
  if (role === 'instructor') return <Navigate to="/instructor/courses" replace />;
  if (role === 'admin') return <Navigate to="/admin/users" replace />;
  return <Navigate to="/courses" replace />;
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Routes for unauthenticated users */}
          <Route 
            path="/login" 
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route 
            path="/register" 
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />

          {/* Protected routes for authenticated users */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Index route -> role-based landing */}
            <Route index element={<HomeRedirect />} />
            {/* Keep dashboard accessible */}
            <Route path="dashboard" element={<DashboardPage />} />
            {/* Player area */}
            <Route path="courses" element={<PlayerCoursesPage />} />
            <Route path="courses/:courseId" element={<CourseDetailPage />} />
            {/* Instructor area (instructor, admin) */}
            <Route path="instructor/courses" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorCoursesPage />
              </RequireRole>
            } />
            <Route path="instructor/courses/:courseId" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorCourseDetailPage />
              </RequireRole>
            } />
            <Route path="instructor/lessons/:lessonId/contents" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorLessonContentsPage />
              </RequireRole>
            } />
            {/* Admin area */}
            <Route path="admin/users" element={
              <RequireRole roles={["admin"]}>
                <AdminUsersPage />
              </RequireRole>
            } />
          </Route>

          {/* Catch-all for not found pages */}
          {/* Email verification routes */}
          <Route path="/check-your-email" element={<CheckYourEmailPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/resend-verification" element={<ResendVerificationPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Catch-all for not found pages */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;