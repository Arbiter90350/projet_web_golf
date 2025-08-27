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
import QuizPage from './pages/QuizPage';
import InstructorLessonQuizPage from './pages/InstructorLessonQuizPage';
import InstructorPlayersPage from './pages/InstructorPlayersPage';
import InstructorPlayerProgressPage from './pages/InstructorPlayerProgressPage';
import ProfilePage from './pages/ProfilePage';
import FileManagerPage from './pages/FileManagerPage';

// Redirection d'accueil selon le rôle
function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div>Chargement...</div>;
  const role = user?.role;
  if (role === 'instructor') return <Navigate to="/instructor/players" replace />;
  if (role === 'admin') return <Navigate to="/instructor/players" replace />;
  // Par défaut, les joueurs arrivent sur le dashboard
  return <Navigate to="/dashboard" replace />;
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

          {/* Protected routes */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            {/* Profile */}
            <Route path="/mon-compte" element={<ProfilePage />} />
            {/* Index route -> role-based landing */}
            <Route index element={<HomeRedirect />} />
            {/* Dashboard et espace cours réservés aux joueurs */}
            <Route path="dashboard" element={
              <RequireRole roles={["player"]}>
                <DashboardPage />
              </RequireRole>
            } />
            {/* Player area */}
            <Route path="courses" element={
              <RequireRole roles={["player"]}>
                <PlayerCoursesPage />
              </RequireRole>
            } />
            <Route path="courses/:courseId" element={
              <RequireRole roles={["player"]}>
                <CourseDetailPage />
              </RequireRole>
            } />
            <Route path="lessons/:lessonId/quiz" element={
              <RequireRole roles={["player"]}>
                <QuizPage />
              </RequireRole>
            } />
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
            <Route path="instructor/lessons/:lessonId/quiz" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorLessonQuizPage />
              </RequireRole>
            } />
            <Route path="instructor/players" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorPlayersPage />
              </RequireRole>
            } />
            <Route path="instructor/players/:userId" element={
              <RequireRole roles={["instructor", "admin"]}>
                <InstructorPlayerProgressPage />
              </RequireRole>
            } />
            <Route path="instructor/files" element={
              <RequireRole roles={["instructor", "admin"]}>
                <FileManagerPage />
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