import {
  mdiAirplane, mdiBike, mdiCar, mdiEmoticonExcited, mdiEmoticonFrown, mdiEmoticonHappy,
  mdiEmoticonNeutral, mdiEmoticonSad, mdiRun, mdiSilverwareForkKnife, mdiSofa, mdiWalk,
} from '@mdi/js'

// Journey 6.0.1 evidence/derived/editor-options.json
export const sentiments = [
  { value: 'excited', label: 'Excited', code: 1.75, icon: mdiEmoticonExcited, color: '#2E7D32' },
  { value: 'happy', label: 'Happy', code: 1.25, icon: mdiEmoticonHappy, color: '#7CB342' },
  { value: 'neutral', label: 'Neutral', code: 1, icon: mdiEmoticonNeutral, color: '#FBC02D' },
  { value: 'sad', label: 'Sad', code: 0.75, icon: mdiEmoticonSad, color: '#FF5722' },
  { value: 'down', label: 'Down', code: 0.25, icon: mdiEmoticonFrown, color: '#B71C1C' },
]
export const activities = [
  { value: 'stationary', label: 'Stationary', code: 1, icon: mdiSofa },
  { value: 'eating', label: 'Eating', code: 2, icon: mdiSilverwareForkKnife },
  { value: 'walking', label: 'Walking', code: 3, icon: mdiWalk },
  { value: 'running', label: 'Running', code: 4, icon: mdiRun },
  { value: 'biking', label: 'Biking', code: 5, icon: mdiBike },
  { value: 'automotive', label: 'Automotive', code: 6, icon: mdiCar },
  { value: 'flying', label: 'Flying', code: 7, icon: mdiAirplane },
]

const oldSentiment: Record<string, string> = { calm: 'neutral', 'so-so': 'neutral', tired: 'down', angry: 'down', anxious: 'down' }
const oldActivity: Record<string, string> = { still: 'stationary', cycling: 'biking', driving: 'automotive' }
export function journalSentiment(value: unknown) {
  return sentiments.find(item => item.code === value || item.value === value || (typeof value === 'string' && item.value === oldSentiment[value]))
}
export function journalActivity(value: unknown) {
  return activities.find(item => item.code === value || item.value === value || (typeof value === 'string' && item.value === oldActivity[value]))
}
