function escapeWifiField(value) {
  return String(value || '').replace(/([\\;,:"])/g, '\\$1')
}

export function buildQrData(type, inputs) {
  switch (type) {
    case 'text':
      return inputs.text || ''
    case 'url':
      return inputs.url || ''
    case 'wifi':
      return `WIFI:T:${inputs.encryption || 'WPA'};S:${escapeWifiField(inputs.ssid)};P:${escapeWifiField(inputs.password)};;`
    case 'email':
      return 'mailto:' + (inputs.email || '')
    case 'phone':
      return 'tel:' + (inputs.phone || '')
    default:
      return ''
  }
}
