import { Component, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { SERVICE_AREA_CENTER, type TripPlace } from './domain/places'

export type ClientMapProps = {
  pickup?: TripPlace | null
  destination?: TripPlace | null
  candidate?: TripPlace | null
  candidateKind?: 'pickup' | 'destination'
  referencePoints?: readonly TripPlace[]
  onReferencePointSelect?: (place: TripPlace) => void
  onMapTap?: (lat: number, lng: number) => void
}

type Point = [number, number]

const COLORS = { pickup: '#16a36a', destination: '#d94e58', reference: '#1769e8' }

function FitToPoints({ points }: { points: Point[] }) {
  const map = useMap()
  const key = points.map((point) => point.join(',')).join('|')
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 15, animate: false })
    else if (points.length === 1) map.setView(points[0], 15, { animate: false })
  }, [key, map])
  return null
}

function TapHandler({ onTap }: { onTap: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onTap(event.latlng.lat, event.latlng.lng) })
  return null
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? <div className="cl-map-fallback" role="status">El mapa no está disponible. Podés elegir un lugar de la lista.</div>
      : this.props.children
  }
}

function ClientMapContents({ pickup, destination, candidate, candidateKind = 'pickup', referencePoints = [], onReferencePointSelect, onMapTap, onTilesFailed }: ClientMapProps & { onTilesFailed: () => void }) {
  const points = useMemo(() => {
    const result: Point[] = []
    for (const place of [pickup, destination, candidate]) if (place) result.push([place.lat, place.lng])
    if (!result.length) referencePoints.forEach((place) => result.push([place.lat, place.lng]))
    return result
  }, [pickup, destination, candidate, referencePoints])
  const selectedIds = new Set([pickup?.id, destination?.id, candidate?.id])
  return <>
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      eventHandlers={{ tileerror: onTilesFailed }}
    />
    <FitToPoints points={points} />
    {onMapTap && <TapHandler onTap={onMapTap} />}
    {pickup && destination && <Polyline positions={[[pickup.lat, pickup.lng], [destination.lat, destination.lng]]} pathOptions={{ color: '#1769e8', weight: 4, opacity: 0.7, dashArray: '8 10' }} />}
    {referencePoints.filter((place) => !selectedIds.has(place.id)).map((place) =>
      <CircleMarker key={place.id} center={[place.lat, place.lng]} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS.reference, fillOpacity: 0.85 }}
        eventHandlers={onReferencePointSelect ? { click: (event) => { event.originalEvent.stopPropagation(); onReferencePointSelect(place) } } : undefined}>
        <Tooltip direction="top">{place.label}</Tooltip>
      </CircleMarker>)}
    {pickup && <CircleMarker center={[pickup.lat, pickup.lng]} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS.pickup, fillOpacity: 1 }}><Tooltip permanent direction="top">Origen</Tooltip></CircleMarker>}
    {destination && <CircleMarker center={[destination.lat, destination.lng]} radius={11} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS.destination, fillOpacity: 1 }}><Tooltip permanent direction="top">Destino</Tooltip></CircleMarker>}
    {candidate && <CircleMarker center={[candidate.lat, candidate.lng]} radius={12} pathOptions={{ color: '#fff', weight: 3, fillColor: COLORS[candidateKind], fillOpacity: 1 }}><Tooltip permanent direction="top">{candidateKind === 'pickup' ? 'Origen' : 'Destino'}</Tooltip></CircleMarker>}
  </>
}

export default function ClientMap(props: ClientMapProps) {
  const [tilesFailed, setTilesFailed] = useState(false)
  return <MapBoundary>
    <div className="cl-map">
      <MapContainer center={[SERVICE_AREA_CENTER[0], SERVICE_AREA_CENTER[1]]} zoom={13} scrollWheelZoom={false} className="cl-map-leaflet" attributionControl>
        <ClientMapContents {...props} onTilesFailed={() => setTilesFailed(true)} />
      </MapContainer>
      {tilesFailed && <div className="cl-map-notice" role="status">No se pudo cargar el mapa. Revisá tu conexión.</div>}
    </div>
  </MapBoundary>
}
