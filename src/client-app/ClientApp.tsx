import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { ClientProvider, useClient } from './ClientProvider'
import { CLIENT_PATHS, resolveClientRedirect } from './domain/client-routes'
import { LoginScreen, RegisterScreen } from './screens/AuthScreens'
import { ConfirmTripScreen } from './screens/ConfirmTripScreen'
import { HomeScreen } from './screens/HomeScreen'
import { PlacePickerScreen } from './screens/PlacePickerScreen'
import { TripStatusScreen } from './screens/TripStatusScreen'
import './client.css'

// EL JAGUAR client Android target (VITE mode "client").
// Only the CLIENT surface exists here: no demo landing, role switcher,
// driver or central UI.

function ClientRouteGuard() {
  const { pathname } = useLocation()
  const { state } = useClient()
  const redirect = resolveClientRedirect(pathname, {
    authenticated: state.session !== null,
    tripStatus: state.trip?.status ?? null,
    hasPickup: state.draft.pickup !== null,
    hasDestination: state.draft.destination !== null,
  })
  return redirect ? <Navigate to={redirect} replace /> : <Outlet />
}

export default function ClientApp() {
  return <ClientProvider>
    <BrowserRouter>
      <div className="cl-app">
        <Routes>
          <Route element={<ClientRouteGuard />}>
            <Route path={CLIENT_PATHS.entry} element={null} />
            <Route path={CLIENT_PATHS.login} element={<LoginScreen />} />
            <Route path={CLIENT_PATHS.register} element={<RegisterScreen />} />
            <Route path={CLIENT_PATHS.home} element={<HomeScreen />} />
            <Route path={CLIENT_PATHS.pickup} element={<PlacePickerScreen key="pickup" kind="pickup" />} />
            <Route path={CLIENT_PATHS.destination} element={<PlacePickerScreen key="destination" kind="destination" />} />
            <Route path={CLIENT_PATHS.confirm} element={<ConfirmTripScreen />} />
            <Route path={CLIENT_PATHS.trip} element={<TripStatusScreen />} />
            <Route path="*" element={null} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  </ClientProvider>
}
