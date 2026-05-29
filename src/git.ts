import { simpleGit, SimpleGit } from 'simple-git'

export interface BranchInfo {
  name: string
  unmergedCount: number
}

export class GitService {
  private git: SimpleGit

  constructor(cwd: string = process.cwd()) {
    this.git = simpleGit(cwd)
  }

  async listLocalBranches(): Promise<string[]> {
    const summary = await this.git.branchLocal()
    return summary.all
  }

  async getCurrentBranch(): Promise<string> {
    const summary = await this.git.branchLocal()
    return summary.current
  }

  async countUnmerged(target: string, branch: string): Promise<number> {
    if (target === branch) return 0
    const result = await this.git.raw(['rev-list', '--count', `${target}..${branch}`])
    return Number.parseInt(result.trim(), 10) || 0
  }

  async listUnmergedCommitTitles(target: string, branch: string, limit: number): Promise<string[]> {
    if (target === branch || limit <= 0) return []
    const out = await this.git.raw([
      'log',
      `${target}..${branch}`,
      `-n`,
      String(limit),
      '--pretty=format:%s',
    ])
    return out
      .split(/\r?\n/)
      .map((s) => s.replace(/^\s+/, '').replace(/\s+$/, ''))
      .filter(Boolean)
  }

  async checkout(branch: string): Promise<void> {
    await this.git.checkout(branch)
  }

  async findWorktreeForBranch(branch: string): Promise<string | null> {
    const out = await this.git.raw(['worktree', 'list', '--porcelain'])
    const blocks = out
      .split(/\r?\n\r?\n/)
      .map((b) => b.trim())
      .filter(Boolean)
    for (const block of blocks) {
      const lines = block.split(/\r?\n/)
      let wp: string | null = null
      let br: string | null = null
      for (const line of lines) {
        if (line.startsWith('worktree ')) wp = line.slice('worktree '.length).trim()
        else if (line.startsWith('branch ')) br = line.slice('branch '.length).trim()
      }
      if (wp && br === `refs/heads/${branch}`) return wp
    }
    return null
  }

  async addWorktree(path: string, branch: string): Promise<void> {
    await this.git.raw(['worktree', 'add', path, branch])
  }

  async removeWorktree(path: string): Promise<void> {
    await this.git.raw(['worktree', 'remove', '--force', path])
  }

  async push(
    remote: string,
    branch: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await this.git.push(remote, branch)
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: String(err?.message ?? err) }
    }
  }

  async deleteLocalBranch(branch: string): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await this.git.raw(['branch', '-D', branch])
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: String(err?.message ?? err) }
    }
  }

  async deleteRemoteTrackingBranch(
    remote: string,
    branch: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await this.git.raw(['branch', '-d', '-r', `${remote}/${branch}`])
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: String(err?.message ?? err) }
    }
  }

  async deleteRemoteBranch(
    remote: string,
    branch: string,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await this.git.push([remote, '--delete', branch])
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: String(err?.message ?? err) }
    }
  }

  async merge(
    branch: string,
  ): Promise<{ ok: true } | { ok: false; conflict: boolean; message: string }> {
    try {
      await this.git.merge([branch])
      return { ok: true }
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      const status = await this.git.status()
      const conflict = status.conflicted.length > 0 || /conflict/i.test(msg)
      return { ok: false, conflict, message: msg }
    }
  }
}
