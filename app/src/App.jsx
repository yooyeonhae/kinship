import { useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Routes, Route, useParams } from 'react-router-dom'
import { FamilyProvider, useFamily } from './context/FamilyContext'
import Layout from './components/Layout'
import ConnectionError from './components/ConnectionError'
import OnboardingScreen from './pages/OnboardingScreen'
import ParentUnlockScreen from './pages/ParentUnlockScreen'
import EntryScreen from './pages/EntryScreen'
import ChildOutfitScreen from './pages/ChildOutfitScreen'
import ChildTodoScreen from './pages/ChildTodoScreen'
import ParentRecipeScreen from './pages/ParentRecipeScreen'
import ParentTasksScreen from './pages/ParentTasksScreen'
import OutfitSettingsScreen from './pages/OutfitSettingsScreen'
import FamilyRoomScreen from './pages/FamilyRoomScreen'
import InfoFeedScreen from './pages/InfoFeedScreen'
import ParentProgressScreen from './pages/ParentProgressScreen'
import WeekendScreen from './pages/WeekendScreen'
import NotFoundScreen from './pages/NotFoundScreen'

// 가족이 확정되기 전에는 어떤 화면도 의미가 없다.
function RequireFamily({ children }) {
  const { familyId, loading, loadError, reload } = useFamily()
  if (loading) return null
  if (loadError === 'network') return <ConnectionError onRetry={reload} />
  if (!familyId) return <Navigate to="/onboarding" replace />
  return children
}

function ProtectedLayout() {
  return (
    <RequireFamily>
      <Layout>
        <Outlet />
      </Layout>
    </RequireFamily>
  )
}

// 이미 가족이 있는 상태에서 /onboarding에 들어오면 두 번째 가족이 만들어지고
// localStorage가 덮어써져 기존 데이터가 고아가 되므로 홈으로 되돌린다.
function OnboardingRoute() {
  const { familyId, loading } = useFamily()
  // 마운트 시점의 값으로만 판단한다. 화면 안에서 가족을 만들면 familyId가 생기는데,
  // 그때마다 리다이렉트하면 새로 발급된 가족 코드를 보여줄 틈이 없다.
  const [hadFamilyOnMount] = useState(() => Boolean(localStorage.getItem('kinship_family_id')))
  if (loading) return null
  if (familyId && hadFamilyOnMount) return <Navigate to="/" replace />
  return <OnboardingScreen />
}

// 부모 화면은 서버가 발급한 토큰이 있을 때만 들어갈 수 있다.
// 토큰 없이 들어가게 하면 화면은 열리는데 모든 쓰기가 42501로 실패한다.
function RequireParent({ children }) {
  const { currentMember, currentMemberId, isParentRole, isParentAuthed } = useFamily()
  if (!currentMember) return <Navigate to="/" replace />
  if (!isParentRole) return <Navigate to={`/child-todo/${currentMemberId}`} replace />
  if (!isParentAuthed) return <Navigate to={`/parent-unlock/${currentMemberId}`} replace />
  return children
}

// 자녀는 자기 화면만, 부모는 모든 자녀 화면을 볼 수 있다.
function RequireChildSelf({ children }) {
  const { memberId } = useParams()
  const { currentMember, currentMemberId, isParentRole } = useFamily()
  if (!currentMember) return <Navigate to="/" replace />
  if (!isParentRole && currentMemberId !== memberId) {
    return <Navigate to={`/child-outfit/${currentMemberId}`} replace />
  }
  return children
}

function App() {
  return (
    <FamilyProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/onboarding" element={<OnboardingRoute />} />
          <Route
            path="/parent-unlock/:memberId"
            element={
              <RequireFamily>
                <ParentUnlockScreen />
              </RequireFamily>
            }
          />
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
            <Route
              path="/parent-recipe"
              element={
                <RequireParent>
                  <ParentRecipeScreen />
                </RequireParent>
              }
            />
            <Route
              path="/parent-tasks"
              element={
                <RequireParent>
                  <ParentTasksScreen />
                </RequireParent>
              }
            />
            <Route
              path="/parent-progress"
              element={
                <RequireParent>
                  <ParentProgressScreen />
                </RequireParent>
              }
            />
            <Route
              path="/outfit-settings"
              element={
                <RequireParent>
                  <OutfitSettingsScreen />
                </RequireParent>
              }
            />
            <Route path="/family-room" element={<FamilyRoomScreen />} />
            <Route path="/info-feed" element={<InfoFeedScreen />} />
            <Route path="/weekend" element={<WeekendScreen />} />
            <Route path="*" element={<NotFoundScreen />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </FamilyProvider>
  )
}

export default App
