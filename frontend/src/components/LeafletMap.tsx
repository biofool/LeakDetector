// frontend/src/components/LeafletMap.tsx — thin Leaflet wrapper.
// divIcon markers avoid the bundler's broken default-icon-URL problem.
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  colour?: string;
}

interface Props {
  centre: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  pin?: [number, number] | null;
  onPinMove?: (lat: number, lng: number) => void;
  onPick?: (lat: number, lng: number) => void;
  onMarkerClick?: (index: number) => void;
  className?: string;
}

// Basemap (#29): LINZ Basemaps when VITE_LINZ_BASEMAPS_KEY is set (site-
// restricted Developer key from basemaps@linz.govt.nz — the per-browser
// "individual" key is not licensed for public apps). OSM's public tile servers
// forbid production traffic, so the fallback is for local dev only.
const LINZ_KEY = import.meta.env.VITE_LINZ_BASEMAPS_KEY as string | undefined;
const LINZ_TILESET = (import.meta.env.VITE_LINZ_BASEMAPS_TILESET as string | undefined) || 'aerial';
const LINZ_ATTRIBUTION =
  '© <a href="https://www.linz.govt.nz/linz-copyright">LINZ CC BY 4.0</a> © <a href="https://www.linz.govt.nz/data/linz-data/linz-basemaps/data-attribution">Imagery Basemap contributors</a>';

function baseLayer(): L.TileLayer {
  if (LINZ_KEY) {
    return L.tileLayer(
      `https://basemaps.linz.govt.nz/v1/tiles/${LINZ_TILESET}/3857/{z}/{x}/{y}.webp?api=${encodeURIComponent(LINZ_KEY)}`,
      { maxZoom: 19, attribution: LINZ_ATTRIBUTION },
    );
  }
  console.warn('[LeafletMap] VITE_LINZ_BASEMAPS_KEY unset — using OpenStreetMap tiles (dev only, not for production traffic)');
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  });
}

const dot = (colour: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${colour};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

export default function LeafletMap({ centre, zoom = 17, markers = [], pin, onPinMove, onPick, onMarkerClick, className }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinRef = useRef<L.Marker | null>(null);
  const marksRef = useRef<L.Marker[]>([]);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { center: centre, zoom, attributionControl: true });
    baseLayer().addTo(map);
    mapRef.current = map;
    map.on('click', (e: L.LeafletMouseEvent) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (pin) {
      if (!pinRef.current) {
        pinRef.current = L.marker(pin, { draggable: Boolean(onPinMove), icon: dot('#dc2626') }).addTo(map);
        pinRef.current.on('dragend', () => {
          const ll = pinRef.current!.getLatLng();
          onPinMove?.(ll.lat, ll.lng);
        });
      } else {
        pinRef.current.setLatLng(pin);
      }
      map.panTo(pin);
    } else if (pinRef.current) {
      pinRef.current.remove();
      pinRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    marksRef.current.forEach((m) => m.remove());
    marksRef.current = markers.map((m, i) => {
      const mk = L.marker([m.lat, m.lng], { icon: dot(m.colour ?? '#0e7490') }).addTo(map);
      if (m.label) mk.bindTooltip(m.label);
      if (onMarkerClick) mk.on('click', () => onMarkerClick(i));
      return mk;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers]);

  return <div ref={divRef} className={className ?? 'h-72 w-full'} />;
}
