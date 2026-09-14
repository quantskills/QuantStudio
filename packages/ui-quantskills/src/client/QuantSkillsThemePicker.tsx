import type { CSSProperties } from 'react'
import { MINIMAL_THEMES, minimalThemeStyle, minimalBackgroundImage } from './minimal-themes.ts'
import { CapabilityIcon } from './CapabilityIcon.tsx'
import {
  ImageSquareIcon as ImageSquare, MoonIcon as Moon, SunIcon as Sun,
} from '@phosphor-icons/react'
import type {
  QuantSkillsColorScheme, QuantSkillsDarkBackground, QuantSkillsLightBackground,
} from '../appearance-settings.ts'
import { THEME_PRESETS, useThemePreset, setThemePreset } from './theme-presets.ts'
import { useBackgroundMotion, setBackgroundMotion } from './animated-background.ts'
import css from './QuantSkillsApp.module.css'
import {
  QUANTSKILLS_DARK_BACKGROUNDS, QUANTSKILLS_LIGHT_BACKGROUNDS,
} from './theme-backgrounds.ts'

/** Props for the QuantSkills-owned light and dark appearance picker. */
export interface QuantSkillsThemePickerProps {
  /** Current QuantSkills palette. */
  scheme: QuantSkillsColorScheme
  /** Background saved for the light palette. */
  lightBackground: QuantSkillsLightBackground
  /** Background saved for the dark palette. */
  darkBackground: QuantSkillsDarkBackground
  /** Whether Host preferences are writable. */
  disabled: boolean
  /** Persist the selected QuantSkills palette. */
  onChange: (scheme: QuantSkillsColorScheme) => void
  /** Persist the selected light-palette background. */
  onLightBackgroundChange: (background: QuantSkillsLightBackground) => void
  /** Persist the selected dark-palette background. */
  onDarkBackgroundChange: (background: QuantSkillsDarkBackground) => void
}

/**
 * Render the two QuantSkills palettes without changing the Host theme.
 * @param props - Current selection, writable state, and change callback.
 * @returns An accessible two-option appearance picker.
 */
export function QuantSkillsThemePicker({
  scheme, lightBackground, darkBackground, disabled, onChange,
  onLightBackgroundChange, onDarkBackgroundChange,
}: QuantSkillsThemePickerProps) {
  const preset = useThemePreset()
  const motion = useBackgroundMotion()
  const backgrounds = scheme === 'light' ? QUANTSKILLS_LIGHT_BACKGROUNDS : QUANTSKILLS_DARK_BACKGROUNDS
  const selectedBackground = scheme === 'light' ? lightBackground : darkBackground
  const themeSections = [
    { id: 'glass', title: '玻璃与自然', detail: '完整主题 · 浅色与深色', description: '清透水波、雨窗微光、墨色山岚。移动鼠标留下波纹，轻点唤起涟漪；导航、按钮、文字和蒙层一起切换。' },
    { id: 'minimal', title: '极简流光', detail: '完整主题 · 深色', description: '流体光带、星尘与流星。移动鼠标聚拢粒子，点击泛起涟漪，滚动时光带随之流转。' },
  ] as const
  return <fieldset className={css.themePicker}>
    <legend>让工作空间更像你</legend>
    <p>从界面到图标，一起换个氛围。</p>
    {themeSections.map(section => <section key={section.id} className={css.minimalThemeSection}>
      <header><h3>{section.title}</h3><span>{section.detail}</span></header>
      <p>{section.description}</p>
      <div className={css.minimalThemeGrid}>
        {MINIMAL_THEMES.filter(theme => theme.id.startsWith(`${section.id}-`)).map(theme => <button type="button" key={theme.id}
          className={css.minimalThemeCard} data-theme-scene={theme.scene} data-theme-scheme={theme.scheme} aria-label={`应用${theme.label}主题`}
          aria-pressed={scheme === theme.scheme && selectedBackground === theme.background}
          style={minimalThemeStyle(theme) as CSSProperties} disabled={disabled}
          onClick={() => {
            setThemePreset(theme.id); onChange(theme.scheme)
            if (theme.scheme === 'light') onLightBackgroundChange(theme.background)
            else onDarkBackgroundChange(theme.background)
          }}>
          <span className={css.minimalThemePreview} style={{ backgroundImage: minimalBackgroundImage(theme) }} aria-hidden="true">
            <span className={css.previewRail}>{(['skill', 'agent', 'agent-team'] as const).map(kind => <CapabilityIcon key={kind} kind={kind} family={theme.family} size={17} bare/>)}</span>
            <span className={css.previewContent}><span className={css.previewHeading}>专注于你的下一步</span><span className={css.previewPanel}><span>研究工作空间</span><i/><i/><em>开始研究 <span>↗</span></em></span></span>
          </span>
          <span className={css.minimalThemeCaption}><b>{theme.label}</b><span className={css.themeSelected}>{scheme === theme.scheme && selectedBackground === theme.background ? '已启用' : '应用主题'}</span></span>
          <small>{theme.description}</small><small className={css.themeIconLegend}>{theme.iconLabel}</small>
        </button>)}
      </div>
    </section>)}
    {(['light', 'dark'] as const).map(group => <section key={group} className={css.presetSection}><h3>{group === 'light' ? '明亮系列' : '深色系列'}</h3><div className={css.presetGrid}>
      {THEME_PRESETS.filter(theme => theme.scheme === group && !MINIMAL_THEMES.some(profile => profile.id === theme.id)).map(theme => <button type="button" key={theme.id} className={css.presetCard}
        data-preset={theme.id} aria-pressed={preset === theme.id && scheme === theme.scheme && selectedBackground === 'none'}
        disabled={disabled} onClick={() => {
          setThemePreset(theme.id)
          onChange(theme.scheme)
          if (theme.scheme === 'light') onLightBackgroundChange('none')
          else onDarkBackgroundChange('none')
        }}>
        <span className={css.presetSwatch}>{theme.scheme === 'dark' ? <Moon size={26} weight="duotone"/> : <Sun size={26} weight="duotone"/>}</span>
        <b>{theme.label}</b><small>{theme.description}</small>
      </button>)}
    </div></section>)}
    <div className={css.themeChoices} aria-label="明暗模式">
      <button type="button" className={css.themeChoice} disabled={disabled} aria-pressed={scheme === 'light'} onClick={() => { onChange('light') }}><Sun size={18}/><span>明亮</span></button>
      <button type="button" className={css.themeChoice} disabled={disabled} aria-pressed={scheme === 'dark'} onClick={() => { onChange('dark') }}><Moon size={18}/><span>深色</span></button>
    </div>
    <div className={css.backgroundPickerHeader}>
      <b>{scheme === 'light' ? '明亮背景' : '深色背景'}</b>
      <small>明亮和深色模式分别保存；动态场景也会切换配色与图标</small>
    </div>
    <label className={css.motionToggle}><span><b>背景动效</b><small>切换到后台或系统开启减少动态效果时自动暂停</small></span><input type="checkbox" role="switch" aria-label="背景动效" checked={motion} onChange={event => setBackgroundMotion(event.target.checked)}/></label>
    <div className={css.backgroundChoices}>
      {backgrounds.filter(background => !MINIMAL_THEMES.some(theme => theme.background === background.id)).map(background => <button
        key={background.id}
        type="button"
        className={css.backgroundChoice}
        aria-label={background.id === 'none' ? '不使用背景图片' : `使用${background.label}背景`}
        aria-pressed={background.id === selectedBackground}
        disabled={disabled}
        onClick={() => {
          if (scheme === 'light') onLightBackgroundChange(background.id as QuantSkillsLightBackground)
          else onDarkBackgroundChange(background.id as QuantSkillsDarkBackground)
        }}
      >
        {background.url === undefined
          ? <span className={css.backgroundChoiceEmpty} aria-hidden="true"><ImageSquare size={24}/></span>
          : <img src={background.url} style={{ objectPosition: background.position }} alt="" aria-hidden="true" />}
        <span>{background.label}{background.id.startsWith('motion-') && <small> · 动态</small>}</span>
      </button>)}
    </div>
  </fieldset>
}
