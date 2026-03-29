import chokidar, { FSWatcher } from 'chokidar'

type RefreshFn = () => void

export class SkillWatcher {
  private watcher: FSWatcher | null = null

  start(paths: string[], onRefresh: RefreshFn): void {
    this.stop()
    if (paths.length === 0) return

    this.watcher = chokidar.watch(paths, {
      persistent: false,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      ignored: /(^|[/\\])\../,
    })

    this.watcher.on('add', onRefresh)
    this.watcher.on('change', onRefresh)
    this.watcher.on('unlink', onRefresh)
    this.watcher.on('error', (err) => console.warn('[agentfiles] watcher error:', err))
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
  }
}
