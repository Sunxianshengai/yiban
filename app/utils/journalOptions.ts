import {
  mdiAirplane, mdiBike, mdiCar, mdiEmoticonExcited, mdiEmoticonFrown, mdiEmoticonHappy,
  mdiEmoticonNeutral, mdiEmoticonSad, mdiRun, mdiSilverwareForkKnife, mdiSofa, mdiWalk,
} from '@mdi/js'

// Journey 6.0.1 evidence/derived/editor-options.json
export const sentiments = [
  { value: 'excited', label: '兴奋', code: 1.75, icon: mdiEmoticonExcited, color: '#2E7D32' },
  { value: 'happy', label: '开心', code: 1.25, icon: mdiEmoticonHappy, color: '#7CB342' },
  { value: 'neutral', label: '平静', code: 1, icon: mdiEmoticonNeutral, color: '#FBC02D' },
  { value: 'sad', label: '难过', code: 0.75, icon: mdiEmoticonSad, color: '#FF5722' },
  { value: 'down', label: '低落', code: 0.25, icon: mdiEmoticonFrown, color: '#B71C1C' },
]
export const activities = [
  { value: 'stationary', label: '静止', code: 1, icon: mdiSofa },
  { value: 'eating', label: '用餐', code: 2, icon: mdiSilverwareForkKnife },
  { value: 'walking', label: '步行', code: 3, icon: mdiWalk },
  { value: 'running', label: '跑步', code: 4, icon: mdiRun },
  { value: 'biking', label: '骑行', code: 5, icon: mdiBike },
  { value: 'automotive', label: '乘车', code: 6, icon: mdiCar },
  { value: 'flying', label: '飞行', code: 7, icon: mdiAirplane },
]

const oldSentiment: Record<string, string> = { calm: 'neutral', 'so-so': 'neutral', tired: 'down', angry: 'down', anxious: 'down' }
const oldActivity: Record<string, string> = { still: 'stationary', cycling: 'biking', driving: 'automotive' }
export function journalSentiment(value: unknown) {
  return sentiments.find(item => item.code === value || item.value === value || (typeof value === 'string' && item.value === oldSentiment[value]))
}
export function journalActivity(value: unknown) {
  return activities.find(item => item.code === value || item.value === value || (typeof value === 'string' && item.value === oldActivity[value]))
}
