import { Routes, Route } from 'react-router-dom'
import { Protected } from './auth/Protected'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Week from './pages/Week'
import Coach from './pages/Coach'
import Journal from './pages/Journal'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<Today />} />
                <Route path="/week" element={<Week />} />
                <Route path="/coach" element={<Coach />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  )
}
