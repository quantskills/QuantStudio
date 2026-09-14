import { useEffect, useMemo, useRef } from 'react'
import { DEFAULT_ARTIFACT_THEME, useArtifactTheme, type ArtifactTheme } from './artifact-theme.ts'
import { artifactThemeRuntime } from './artifact-theme-runtime.ts'

// No origin, navigation, popups, downloads, forms, workers or Host bridge grants.
// Both documents have opaque origins. The outer frame's frame-src policy also
// blocks the inner document from navigating itself to an external URL.
export const INTERACTIVE_HTML_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"

const escapeAttribute = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export function isolatedHtmlDocument(source: string, title: string, theme: ArtifactTheme = DEFAULT_ARTIFACT_THEME): string {
  // Construct a new head before any authored markup, never inject a policy
  // after a source-controlled head where earlier resources could execute.
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(INTERACTIVE_HTML_CSP)}"><meta name="referrer" content="no-referrer">`
  const serialized = JSON.stringify(theme).replaceAll('<', '\\u003c')
  const inner = `<!doctype html><html><head>${head}<meta name="viewport" content="width=device-width,initial-scale=1"><script>(${artifactThemeRuntime.toString()})(${serialized})</script></head><body>${source}</body></html>`
  return `<!doctype html><html><head>${head}<style>html,body{margin:0;height:100%;overflow:hidden}iframe{display:block;border:0;width:100%;height:100%;background:transparent}</style></head><body><iframe title="${escapeAttribute(title)}" sandbox="allow-scripts" referrerpolicy="no-referrer" srcdoc="${escapeAttribute(inner)}"></iframe><script>
    let theme=${serialized};const frame=document.querySelector('iframe');
    const send=()=>frame.contentWindow.postMessage({type:'quantskills:artifact-theme',theme},'*');
    frame.addEventListener('load',send);
    window.addEventListener('message',event=>{if(event.source===parent&&event.data?.type==='quantskills:artifact-theme'){theme=event.data.theme;send()}});
  </script></body></html>`
}

/** One shared isolation boundary for inline delivery and the right workbench. */
export function InteractiveHtml({ source, title, className }: { source: string; title: string; className?: string | undefined }) {
  const theme = useArtifactTheme()
  const latestTheme = useRef(theme)
  latestTheme.current = theme
  const frame = useRef<HTMLIFrameElement>(null)
  // Update colors by message, preserving chart state, input values and scroll position.
  const document = useMemo(() => isolatedHtmlDocument(source, title, latestTheme.current), [source, title])
  const serialized = JSON.stringify(theme)
  const sync = () => frame.current?.contentWindow?.postMessage({ type: 'quantskills:artifact-theme', theme: latestTheme.current }, '*')
  useEffect(sync, [serialized])
  return <iframe ref={frame} onLoad={sync} className={className} title={title} sandbox="allow-scripts" referrerPolicy="no-referrer"
    allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"
    srcDoc={document}/>
}
