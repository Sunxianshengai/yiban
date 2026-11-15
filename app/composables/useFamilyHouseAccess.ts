import { desktopBridge } from '~/utils/desktopBridge'

export function useFamilyHouseAccess() {
  const isMobile = useIsMobile()
  const agent = navigator as Navigator & { userAgentData?: { mobile?: boolean } }
  const isMobileDevice = agent.userAgentData?.mobile === true
    || /Android|iPhone|iPad|iPod/i.test(agent.userAgent)
    || (agent.platform === 'MacIntel' && agent.maxTouchPoints > 1)
  const isDesktopApp = Boolean(desktopBridge()) || /\bElectron\//i.test(agent.userAgent)

  return computed(() => !isMobile.value && !isMobileDevice && !isDesktopApp)
}
