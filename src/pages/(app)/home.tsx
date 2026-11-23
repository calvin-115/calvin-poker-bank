import { Navigate } from 'react-router-dom'

// The games list is the app's real home.
export default function HomePage() {
  return <Navigate to="/games" replace />
}
