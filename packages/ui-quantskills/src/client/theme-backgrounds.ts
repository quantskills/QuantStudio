import { MINIMAL_THEMES, minimalBackgroundImage } from './minimal-themes.ts'
import motionCosmosUrl from './assets/motion-cosmos.webp'
import motionOceanUrl from './assets/motion-ocean.webp'
import motionMeadowUrl from './assets/motion-meadow.webp'
import motionJiangnanUrl from './assets/motion-jiangnan.webp'
import motionCyberUrl from './assets/motion-cyber.webp'
import type {
  QuantSkillsColorScheme, QuantSkillsDarkBackground, QuantSkillsLightBackground,
} from '../appearance-settings.ts'
import darkAstronautVisorUrl from './assets/background-dark-astronaut-visor.webp'
import darkMoonObserverUrl from './assets/background-dark-moon-observer.webp'
import darkMoonwalkerUrl from './assets/background-dark-moonwalker.webp'
import darkOrbitalRingsUrl from './assets/background-dark-orbital-rings.webp'
import lightAstronautUrl from './assets/background-light-astronaut.webp'
import lightAstronautVisorUrl from './assets/background-light-astronaut-visor.webp'
import lightLaunchUrl from './assets/background-light-launch.webp'
import lightNetworkSphereUrl from './assets/background-light-network-sphere.webp'

/** One real background asset exposed by the QuantSkills appearance picker. */
export interface QuantSkillsBackgroundOption<Id extends string> {
  /** Stable preference value. */
  readonly id: Id
  /** Short user-facing name. */
  readonly label: string
  /** Imported browser asset URL; absent means the palette has no image. */
  readonly url?: string
  /** Code-native gradient for interactive theme profiles. */
  readonly gradient?: string
  /** Focal point retained when the viewport crops the image. */
  readonly position: string
}

export const MOTION_BACKGROUNDS = [
  { id: 'motion-cosmos', label: '宇宙星辰', url: motionCosmosUrl, position: 'center center' },
  { id: 'motion-ocean', label: '深海', url: motionOceanUrl, position: 'center center' },
  { id: 'motion-meadow', label: '青青草原', url: motionMeadowUrl, position: 'center center' },
  { id: 'motion-jiangnan', label: '江南武侠', url: motionJiangnanUrl, position: 'center center' },
  { id: 'motion-cyber', label: '赛博朋克', url: motionCyberUrl, position: 'center center' },
] as const

/** Light-palette backgrounds selected for the v0.1.19 visual refresh. */
export const QUANTSKILLS_LIGHT_BACKGROUNDS: readonly QuantSkillsBackgroundOption<QuantSkillsLightBackground>[] = [
  ...MINIMAL_THEMES.filter(theme => theme.scheme === 'light').map(theme => ({ id: theme.background, label: theme.label, gradient: minimalBackgroundImage(theme), position: 'center center' })),
  ...MOTION_BACKGROUNDS,
  { id: 'none', label: '无背景', position: 'center center' },
  { id: 'launch', label: '云端启航', url: lightLaunchUrl, position: 'center center' },
  { id: 'network-sphere', label: '智能星网', url: lightNetworkSphereUrl, position: 'center center' },
  { id: 'astronaut-visor', label: '逐光视界', url: lightAstronautVisorUrl, position: 'left center' },
  { id: 'astronaut', label: '太空探索', url: lightAstronautUrl, position: 'right center' },
]

/** Dark-palette backgrounds selected for the v0.1.19 visual refresh. */
export const QUANTSKILLS_DARK_BACKGROUNDS: readonly QuantSkillsBackgroundOption<QuantSkillsDarkBackground>[] = [
  ...MINIMAL_THEMES.filter(theme => theme.scheme === 'dark').map(theme => ({ id: theme.background, label: theme.label, gradient: minimalBackgroundImage(theme), position: 'center center' })),
  ...MOTION_BACKGROUNDS,
  { id: 'none', label: '无背景', position: 'center center' },
  { id: 'moon-observer', label: '静夜守望', url: darkMoonObserverUrl, position: 'center center' },
  { id: 'moonwalker', label: '月面远征', url: darkMoonwalkerUrl, position: 'center center' },
  { id: 'orbital-rings', label: '环轨星际', url: darkOrbitalRingsUrl, position: 'center center' },
  { id: 'astronaut-visor', label: '星河观测', url: darkAstronautVisorUrl, position: 'right center' },
]

/** Resolve the currently visible background from both durable palette selections. */
export function resolveQuantSkillsBackground(
  scheme: QuantSkillsColorScheme,
  lightBackground: QuantSkillsLightBackground,
  darkBackground: QuantSkillsDarkBackground,
): QuantSkillsBackgroundOption<QuantSkillsLightBackground | QuantSkillsDarkBackground> {
  const options = scheme === 'light' ? QUANTSKILLS_LIGHT_BACKGROUNDS : QUANTSKILLS_DARK_BACKGROUNDS
  const selected = scheme === 'light' ? lightBackground : darkBackground
  return options.find(option => option.id === selected) ?? options[0]!
}
