import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import CasesList from './pages/CasesList.jsx'
import Intake from './pages/Intake.jsx'
import Review from './pages/Review.jsx'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <CasesList />
          </Protected>
        }
      />
      <Route
        path="/cases/new"
        element={
          <Protected>
            <Intake />
          </Protected>
        }
      />
      <Route
        path="/cases/:caseId/intake"
        element={
          <Protected>
            <Intake />
          </Protected>
        }
      />
      <Route
        path="/cases/:caseId/review"
        element={
          <Protected>
            <Review />
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
