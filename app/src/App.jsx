import { BrowserRouter, Navigate, Outlet, Routes, Route, useParams } from 'react-router-dom'
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

// 아래 두 가드는 UI 게이팅이다. 서버는 아직 역할을 구분하지 못하므로
// (요청에 실리는 건 x-family-id 하나뿐) 실수·오탐색을 막는 수준이고
// 진짜 강제력은 아니다. 강제하려면 x-member-id + 역할 기반 RLS가 필요하다.
function RequireParent({ children }) {
  const { currentMember, currentMemberId, isParent } = useFamily()
  if (!currentMember) return <Navigate to="/" replace />
  if (!isParent) return <Navigate to={`/child-todo/${currentMemberId}`} replace />
  return children
}

// 자녀는 자기 화면만, 부모는 모든 자녀 화면을 볼 수 있다.
function RequireChildSelf({ children }) {
  const { memberId } = useParams()
  const { currentMember, currentMemberId, isParent } = useFamily()
  if (!currentMember) return <Navigate to="/" replace />
  if (!isParent && currentMemberId !== memberId) return <Navigate to={`/child-outfit/${currentMemberId}`} replace />
  return children
}

function App() {
  return (
    <FamilyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<EntryScreen />} />
            <Route
              path="/child-outfit/:memberId"
              element={
                <RequireChildSelf>
                  <ChildOutfitScreen />
                </RequireChildSelf>
              }
            />
            <Route
              path="/child-todo/:memberId"
              element={
                <RequireChildSelf>
                  <ChildTodoScreen />
                </RequireChildSelf>
              }
            />
            <Route path="/parent-recipe" element={<ParentRecipeScreen />} />
            <Route
              path="/parent-tasks"
              element={
                <RequireParent>
                  <ParentTasksScreen />
                </RequireParent>
              }
            />
            <Route path="/family-room" element={<FamilyRoomScreen />} />
            <Route path="/info-feed" element={<InfoFeedScreen />} />
            <Route
              path="/parent-progress"
              element={
                <RequireParent>
                  <ParentProgressScreen />
                </RequireParent>
              }
            />
            <Route path="/weekend" element={<WeekendScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FamilyProvider>
  )
}

export default App
