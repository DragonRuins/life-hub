/**
 * Component type definitions for vehicles.
 * Each type has an icon, suggested positions, and common fields.
 */

export const COMPONENT_TYPES = [
  {
    value: 'tire',
    label: 'Tire',
    icon: '🔘',
    suggestedPositions: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right', 'Spare'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage', 'purchase_price'],
  },
  {
    value: 'battery',
    label: 'Battery',
    icon: '🔋',
    suggestedPositions: ['Engine Bay', 'Trunk', 'Under Seat'],
    commonFields: ['brand', 'model', 'part_number', 'purchase_date', 'warranty_info'],
  },
  {
    value: 'brake_pad',
    label: 'Brake Pads',
    icon: '🛞',
    suggestedPositions: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage'],
  },
  {
    value: 'brake_rotor',
    label: 'Brake Rotor',
    icon: '⭕',
    suggestedPositions: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right'],
    commonFields: ['brand', 'model', 'part_number'],
  },
  {
    value: 'oil_filter',
    label: 'Oil Filter',
    icon: '🔧',
    suggestedPositions: ['Engine Bay'],
    commonFields: ['brand', 'part_number'],
  },
  {
    value: 'engine_oil',
    label: 'Engine Oil',
    icon: '🛢️',
    suggestedPositions: ['Engine'],
    commonFields: ['brand', 'model', 'purchase_price'],
  },
  {
    value: 'air_filter',
    label: 'Air Filter',
    icon: '💨',
    suggestedPositions: ['Engine Bay', 'Cabin'],
    commonFields: ['brand', 'part_number'],
  },
  {
    value: 'fuel_filter',
    label: 'Fuel Filter',
    icon: '⛽',
    suggestedPositions: ['Fuel Line', 'Engine Bay'],
    commonFields: ['brand', 'part_number'],
  },
  {
    value: 'spark_plug',
    label: 'Spark Plug',
    icon: '⚡',
    suggestedPositions: ['Cylinder 1', 'Cylinder 2', 'Cylinder 3', 'Cylinder 4', 'Cylinder 5', 'Cylinder 6', 'Cylinder 7', 'Cylinder 8', 'All'],
    commonFields: ['brand', 'part_number'],
  },
  {
    value: 'wiper_blade',
    label: 'Wiper Blade',
    icon: '🌧️',
    suggestedPositions: ['Driver Side', 'Passenger Side', 'Rear'],
    commonFields: ['brand', 'model', 'part_number'],
  },
  {
    value: 'headlight_bulb',
    label: 'Headlight Bulb',
    icon: '💡',
    suggestedPositions: ['Front Left', 'Front Right', 'Fog Left', 'Fog Right'],
    commonFields: ['brand', 'part_number'],
  },
  {
    value: 'shock_strut',
    label: 'Shock/Strut',
    icon: '🔩',
    suggestedPositions: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right'],
    commonFields: ['brand', 'model', 'part_number'],
  },
  {
    value: 'exhaust',
    label: 'Exhaust',
    icon: '💨',
    suggestedPositions: ['Full System', 'Muffler', 'Catalytic Converter', 'Pipes'],
    commonFields: ['brand', 'model', 'part_number'],
  },
  {
    value: 'transmission_oil',
    label: 'Transmission Oil',
    icon: '⚙️',
    suggestedPositions: ['Transmission'],
    commonFields: ['brand', 'model', 'purchase_price'],
  },
  {
    value: 'drive_chain',
    label: 'Drive Chain',
    icon: '⛓️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'drive_belt',
    label: 'Drive Belt',
    icon: '🔗',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'model', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'front_sprocket',
    label: 'Front Sprocket',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'rear_sprocket',
    label: 'Rear Sprocket',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'front_pulley',
    label: 'Front Pulley',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'rear_pulley',
    label: 'Rear Pulley',
    icon: '⚙️',
    suggestedPositions: ['Drivetrain'],
    commonFields: ['brand', 'part_number', 'install_mileage'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'stator',
    label: 'Stator',
    icon: '⚡',
    suggestedPositions: ['Engine'],
    commonFields: ['brand', 'part_number'],
    vehicleTypes: ['motorcycle'],
  },
  {
    value: 'other',
    label: 'Other',
    icon: '📦',
    suggestedPositions: [],
    commonFields: ['brand', 'part_number', 'notes'],
  },
]

/**
 * Get component type config by value.
 */
export function getComponentType(typeValue) {
  return COMPONENT_TYPES.find(t => t.value === typeValue) || COMPONENT_TYPES[COMPONENT_TYPES.length - 1]
}

/**
 * Get all unique position suggestions across all types.
 */
export function getAllPositions() {
  const positions = new Set()
  COMPONENT_TYPES.forEach(type => {
    type.suggestedPositions.forEach(pos => positions.add(pos))
  })
  return Array.from(positions).sort()
}

/**
 * Get component types filtered for a specific vehicle type.
 * Items with no vehicleTypes restriction are always included.
 * Items with a vehicleTypes array are only included if the vehicle type matches.
 */
export function getComponentTypesForVehicle(vehicleType) {
  if (!vehicleType) return COMPONENT_TYPES
  return COMPONENT_TYPES.filter(t =>
    !t.vehicleTypes || t.vehicleTypes.includes(vehicleType)
  )
}

/**
 * Common log types for component service history.
 */
export const LOG_TYPES = [
  'rotation',
  'inspection',
  'repair',
  'replacement',
  'cleaning',
  'adjustment',
  'testing',
  'other',
]
