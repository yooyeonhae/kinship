import { BrowserRouter, Navigate, Outlet, Routes, Route } from 'react-router-dom'
import { FamilyProvider, useFamily } from './context/FamilyContext'
import Layout from './components/Layout'
import ConnectionError from './components/ConnectionError'
import OnboardingScreen from './pages/OnboardingScreen'
import EntryScreen from './pages/EntryScreen'
import ChildOutfitScreen from './pages/ChildOutfitScreen'
import ChildTodoScreen from './pages/ChildTodoScreen'
import ParentRecipeScreen from './pages/ParentRecipeScreen'
import ParentTasksScreen from './pages/ParentTasksScreen'
import FamilyRoomScreen from './pages/FamilyRoomScreen'
import InfoFeedScreen from './pages/InfoFeedScreen'
import ParentProgressScreen from './pages/ParentProgressScreen'
import WeekendScreen from './pages/WeekendScreen'
import NotFoundScreen from './pages/NotFoundScreen'

function ProtectedLayout() {
  const { familyId, loading, loadError, reload } = useFamily()
  if (loading) return null
  if (loadError === 'network') return <ConnectionError onRetry={reload} />
  if (!familyId) return <Navigate to="/onboarding" replace />
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

// 이미 가족이 있는 상태에서 /onboarding에 들어오면 두 번째 가족이 만들어지고
// localStorage가 덮어써져 기존 데이터가 고아가 되므로 홈으로 되돌린다.
function OnboardingRoute() {
  const { familyId, loading } = useFamily()
  if (loading) return null
  if (familyId) return <Navigate to="/" replace />
  return <OnboardingScreen />
}

function App() {
  return (
    <FamilyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<EntryScreen />} />
            <Route path="/child-outfit/:memberId" element={<ChildOutfitScreen />} />
            <Route path="/child-todo/:memberId" element={<ChildTodoScreen />} />
            <Route path="/parent-recipe" element={<ParentRecipeScreen />} />
            <Route path="/parent-tasks" element={<ParentTasksScreen />} />
            <Route path="/family-room" element={<FamilyRoomScreen />} />
            <Route path="/info-feed" element={<InfoFeedScreen />} />
            <Route path="/parent-progress" element={<ParentProgressScreen />} />
            <Route path="/weekend" element={<WeekendScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FamilyProvider>
  )
}

export default App
