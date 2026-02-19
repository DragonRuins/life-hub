/**
 * Notifications Page - Redirect
 *
 * All notification configuration has been consolidated into /settings/notifications.
 * This component redirects old /notifications links (including the bell dropdown's
 * "View All" link) to the new location.
 */
import { Navigate } from 'react-router-dom'

export default function Notifications() {
  return <Navigate to="/settings/notifications" replace />
}
