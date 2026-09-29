import { useState } from 'react'
import { FlaskIcon, TrophyIcon } from '@phosphor-icons/react'
import type { ComponentProps } from 'react'
import { ContestPage } from './ContestPage.tsx'
import { FactorContestPage } from './FactorContestPage.tsx'
import type { FactorContestAccess } from './factor-contest.ts'
import styles from './FactorContestPage.module.css'

export function CompetitionHub(props: ComponentProps<typeof ContestPage> & { factorAccess?: FactorContestAccess | undefined }) {
  const [kind, setKind] = useState(() => sessionStorage.getItem('quantstudio-competition') === 'factor' ? 'factor' : 'futures')
  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  return <div className={styles.hub}><nav className={styles.selector} aria-label="选择比赛" hidden={workspaceOpen && kind === 'futures'}>
    {([['futures', '期货模拟赛'], ['factor', '第四届因子大赛']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={kind === value}
      onClick={() => { sessionStorage.setItem('quantstudio-competition', value); setKind(value) }}>{value === 'futures' ? <TrophyIcon size={21}/> : <FlaskIcon size={21}/>}<span>{label}</span></button>)}
  </nav><div className={styles.body}>{kind === 'factor' ? <FactorContestPage access={props.factorAccess}/> : <ContestPage {...props} onWorkspaceChange={setWorkspaceOpen}/>}</div></div>
}
