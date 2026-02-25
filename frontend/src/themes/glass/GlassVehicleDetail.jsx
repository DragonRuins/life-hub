/**
 * GlassVehicleDetail.jsx - Glass Theme Vehicle Detail
 *
 * Wraps the standard VehicleDetail component. The glass CSS overrides
 * (.glass-theme .card, .btn, input, etc.) handle the visual
 * transformation automatically. The tab bar gets glass-specific
 * capsule styling via the wrapper.
 */
import VehicleDetail from '../../pages/VehicleDetail'

export default function GlassVehicleDetail() {
  return <VehicleDetail />
}
