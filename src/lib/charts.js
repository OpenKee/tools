import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
)
Chart.defaults.font.family = "'Inter', system-ui, -apple-system, sans-serif"
Chart.defaults.font.size = 10

export { Bar, Line } from 'vue-chartjs'

export function chartTheme(theme) {
  const dark = theme === 'dark'
  return {
    text: dark ? '#f5f5f3' : '#122032',
    muted: dark ? '#9f9f99' : '#5a6778',
    line: dark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(18, 32, 50, 0.12)',
    panel: dark ? '#0a0a0a' : '#ffffff',
    tooltipBg: dark ? 'rgba(10, 10, 10, 0.96)' : 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(18, 32, 50, 0.14)',
    accent: dark ? '#5aa2f7' : '#1b74e4',
  }
}
