export type Continuity = {
  persistence?: { ok?: boolean; at?: number; database?: string; backup_root?: string; daily_archive?: string; error?: string; free_bytes?: number }
  runtime_health?: { at?: number; continuous?: boolean; neural_ready?: boolean }
}

export function RuntimeContinuity({ status }: { status: Continuity }) {
  const saved = status.persistence
  const health = status.runtime_health
  const stamp = (at?: number) => at ? new Date(at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '准备中'
  const stale = !health?.at || Date.now() / 1000 - health.at > 15
  return <details className="fv-continuity">
    <summary><span>{health?.continuous ? '宿主后台运行' : '当前会话运行'}</span><span>{stale ? '等待后台心跳' : '后台在线 · 关网页仍运行'}</span><span>{saved?.ok === false ? '存档异常 · 暂停新增开仓' : saved?.ok ? '本地落盘 · 每日归档' : '正在建立本地备份'}</span></summary>
    <p>记录实时保存；每 15 分钟更新备份，按上海日期归档。行情、成交中的柜台交易日另行保留。服务器重启或进程恢复后先核对账户；休市或报价过期时等待，不补造离线交易。</p>
    <dl><dt>最近后台心跳</dt><dd>{stamp(health?.at)}</dd><dt>最近校验备份</dt><dd>{stamp(saved?.at)}</dd><dt>运行数据库</dt><dd>{saved?.database || '准备中'}</dd><dt>备份目录</dt><dd>{saved?.backup_root || '准备中'}</dd><dt>当日记录</dt><dd>{saved?.daily_archive || '准备中'}</dd><dt>数据盘剩余空间</dt><dd>{saved?.free_bytes != null ? `${(saved.free_bytes / 1024 ** 3).toFixed(1)} GB` : '正在检测'}</dd></dl>
    {saved?.error && <p role="alert">{saved.error}</p>}
    <p>记录和检查点不自动删除。硬盘故障仍需备份恢复；历史上没有采集的时段无法补回。停止交易建议使用看板的观察按钮；暂停生活使用暂停按钮。退出 QuantStudio 宿主会停止后台并保存，重启后交易建议保持关闭。</p>
  </details>
}
