import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { LatLngBoundsExpression } from 'leaflet'
import type { DemoDriver, DemoLocation } from '../demo/types'
import { DEMO_DRIVER_LOCATIONS, getMapLocationForZone, type DemoMapLocation, type MapPoint } from '../demo/map-locations'
import { getDemoRouteGeometry } from '../demo/map-routes'

type RealMapProps = {
  origin?: DemoLocation | null
  destination?: DemoLocation | null
  driver?: DemoDriver | null
  drivers?: DemoDriver[]
  showDrivers?: boolean
  routeGeometry?: MapPoint[] | null
  driverRouteGeometry?: MapPoint[] | null
  className?: string
  caption?: string
  originLabel?: string
  destinationLabel?: string
  driverLabel?: string
}

function resolveLocation(location?: DemoLocation | null, fallbackLabel?: string): DemoMapLocation | null {
  return location ? getMapLocationForZone(location.zoneId) : getMapLocationForZone(fallbackLabel ? 'centro' : null)
}

function BoundsUpdater({ points }: { points: MapPoint[] }) {
  const map = useMap()
  const key = points.map(([lat, lng]) => `${lat},${lng}`).join('|')
  useEffect(() => {
    if (points.length > 1) {
      const bounds: LatLngBoundsExpression = points.map(([lat, lng]) => [lat, lng])
      map.fitBounds(bounds, { padding: [34, 34], maxZoom: 14, animate: false })
    } else if (points[0]) {
      map.setView(points[0], 14, { animate: false })
    }
  }, [key, map])
  return null
}

class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Keep a map failure local to this visual. */ }
  render() {
    return this.state.failed
      ? <div className="real-map-fallback" role="status">El mapa no está disponible ahora. Podés continuar con la solicitud demo.</div>
      : this.props.children
  }
}

function MapContents({ origin, destination, driver, drivers = [], showDrivers = false, routeGeometry, driverRouteGeometry, onTilesUnavailable }: RealMapProps & { origin: DemoMapLocation | null; destination: DemoMapLocation | null; driver: DemoDriver | null; onTilesUnavailable: () => void }) {
  const selectedDriver = driver ? DEMO_DRIVER_LOCATIONS[driver.id] : null
  const fleetLocations = showDrivers ? drivers.flatMap((item) => {
    const location = DEMO_DRIVER_LOCATIONS[item.id]
    return location ? [{ driver: item, location }] : []
  }) : []
  const primaryRoute = routeGeometry ?? getDemoRouteGeometry(origin?.zoneId, destination?.zoneId)
  const points = useMemo(() => {
    const result: MapPoint[] = []
    if (origin) result.push([origin.lat, origin.lng])
    if (destination) result.push([destination.lat, destination.lng])
    if (selectedDriver) result.push([selectedDriver.lat, selectedDriver.lng])
    fleetLocations.forEach(({ location }) => result.push([location.lat, location.lng]))
    primaryRoute?.forEach((point) => result.push(point))
    driverRouteGeometry?.forEach((point) => result.push(point))
    return result.length ? result : [[-23.8179733, -64.7926023] as MapPoint]
  }, [origin, destination, selectedDriver, drivers, showDrivers, primaryRoute, driverRouteGeometry])
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  const handleTileError = () => {
    if (!tilesUnavailable) {
      setTilesUnavailable(true)
      onTilesUnavailable()
    }
  }
  return <>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      eventHandlers={{ tileerror: handleTileError }}
    />
    <BoundsUpdater points={points} />
    {primaryRoute && primaryRoute.length > 1 && <Polyline positions={primaryRoute} pathOptions={{ color: '#1769e8', weight: 5, opacity: 0.84, lineCap: 'round', lineJoin: 'round' }} />}
    {driverRouteGeometry && driverRouteGeometry.length > 1 && <Polyline positions={driverRouteGeometry} pathOptions={{ color: '#5b77a6', weight: 4, opacity: 0.9, dashArray: '8 8' }} />}
    {fleetLocations.map(({ driver: fleetDriver, location }) => <CircleMarker key={fleetDriver.id} center={[location.lat, location.lng]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: fleetDriver.color, fillOpacity: 1 }}><Tooltip>{fleetDriver.name} · {fleetDriver.availability === 'AVAILABLE' ? 'Disponible' : fleetDriver.availability === 'BUSY' ? 'Ocupado' : 'No disponible'}</Tooltip></CircleMarker>)}
    {origin && <CircleMarker center={[origin.lat, origin.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#16a36a', fillOpacity: 1 }}><Tooltip permanent direction="top">Origen</Tooltip></CircleMarker>}
    {destination && <CircleMarker center={[destination.lat, destination.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#d94e58', fillOpacity: 1 }}><Tooltip permanent direction="top">Destino</Tooltip></CircleMarker>}
    {selectedDriver && <CircleMarker center={[selectedDriver.lat, selectedDriver.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: driver?.color ?? '#1769e8', fillOpacity: 1 }}><Tooltip permanent direction="bottom">Móvil</Tooltip></CircleMarker>}
    {tilesUnavailable && <div className="real-map-tile-notice" role="status">No cargó el mapa base; el recorrido demo sigue disponible.</div>}
  </>
}

export function RealMap(props: RealMapProps) {
  const origin = resolveLocation(props.origin, props.originLabel)
  const destination = resolveLocation(props.destination, props.destinationLabel)
  const center = origin ? [origin.lat, origin.lng] as [number, number] : [-23.8179733, -64.7926023] as [number, number]
  const [tilesUnavailable, setTilesUnavailable] = useState(false)
  return <MapErrorBoundary>
    <div className={`real-map ${props.className ?? ''}`} aria-label={props.caption ?? 'Mapa de Libertador General San Martín y Calilegua'}>
      <MapContainer center={center} zoom={14} scrollWheelZoom={false} zoomControl className="real-map-leaflet">
        <MapContents {...props} origin={origin} destination={destination} driver={props.driver ?? null} onTilesUnavailable={() => setTilesUnavailable(true)} />
      </MapContainer>
      {tilesUnavailable && <span className="real-map-attribution-note">La base cartográfica externa no respondió.</span>}
    </div>
  </MapErrorBoundary>
}
