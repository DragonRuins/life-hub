/**
 * GlassFuelEconomy.jsx - Glass Theme Fuel Analytics
 *
 * Wraps the standard FuelEconomy component. Charts will use
 * Apple system colors when the glass theme context is available.
 * The glass CSS overrides handle visual transformation.
 */
import FuelEconomy from '../../pages/FuelEconomy'

export default function GlassFuelEconomy() {
  return <FuelEconomy />
}
