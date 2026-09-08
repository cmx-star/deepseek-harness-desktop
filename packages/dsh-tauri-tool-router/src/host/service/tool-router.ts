import type { AgentLike, ToolRouterState, ToolSchemaLike } from '../types'
import { MCP_TOOL_PREFIX, REQUEST_MCP_TOOLS_NAME, REQUEST_TOOLS_NAME } from '../../shared/constants'

const TOOL_GROUPS: Record<string, readonly string[]> = {
  code: ['bash', 'read', 'glob', 'grep', 'todo_write'],
  edit: ['edit', 'write'],
  web: ['web_search', 'web_fetch'],
  browser: ['computer_observe', 'computer_action'],
  image: ['read_image'],
  worktree: ['create_worktree', 'checkout_worktree'],
  delegation: ['subagent', 'subagent_fork', 'workflow', 'ralph'],
  schedule: ['scheduler_create', 'scheduler_list', 'scheduler_run_now', 'scheduler_toggle', 'scheduler_delete'],
  planning: ['ask_user_question', 'exit_plan_mode', 'create_goal', 'get_goal', 'update_goal'],
  jobs: ['job_list', 'job_output', 'job_kill'],
}

const GROUP_PATTERNS: Array<[string, RegExp]> = [
  ['code', /\b(code|bug|test|build|compile|typescript|javascript|rust|python|react|vue|api|endpoint|repo|git)\b|代码|修复|测试|构建|编译|项目|仓库|接口/iu],
  ['edit', /\b(edit|write|create|update|delete|refactor|implement|fix)\b|修改|编辑|新增|删除|重构|实现|修复|写入/iu],
  ['web', /\b(search|research|online|web|internet|documentation|docs)\b|搜索|联网|网上|文档|资料|官网|查询/iu],
  ['browser', /\b(browser|chrome|website|page|ui|frontend|playwright)\b|浏览器|网页|页面|界面|前端|截图|点击/iu],
  ['image', /\b(image|screenshot|photo|picture)\b|图片|截图|图像|视觉/iu],
  ['worktree', /\b(worktree|checkout|branch)\b|工作树|检出|分支/iu],
  ['delegation', /\b(subagent|delegate|workflow|ralph)\b|子代理|委派|工作流|并行/iu],
  ['schedule', /\b(schedule|cron|daily|weekly|interval)\b|定时|每日|每周|周期|自动运行/iu],
  ['planning', /\b(plan|approval|question|ask)\b|计划|审批|确认|提问|问题/iu],
  ['jobs', /\b(job|background|process)\b|后台任务|进程|任务状态/iu],
]

const AMBIGUOUS_REQUEST = /\b(?:anything|everything|all tools|complex|help me)\b|全部工具|任何工具|复杂任务|帮我处理/iu

function emptyMcpTools(): Set<string> {
  return new Set()
}

function availableNames(schemas: readonly ToolSchemaLike[]): Set<string> {
  return new Set(schemas.map(schema => schema.name))
}

function isMcpTool(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX)
}

function selectGroupNames(groups: readonly string[], available: ReadonlySet<string>): Set<string> {
  const names = new Set<string>([REQUEST_TOOLS_NAME, REQUEST_MCP_TOOLS_NAME])
  for (const group of groups) {
    for (const name of TOOL_GROUPS[group] ?? []) {
      if (available.has(name))
        names.add(name)
    }
  }
  return names
}

function mcpToolsForRequest(query: string, serverName: string | undefined, schemas: readonly ToolSchemaLike[]): Set<string> {
  const requestedServer = serverName?.trim()
  const words = query.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{2,}/gu) ?? []
  const candidates = schemas.filter(schema => isMcpTool(schema.name))

  if (words.length === 0) {
    return new Set(candidates
      .filter(schema => requestedServer !== undefined && schema.name.startsWith(`${MCP_TOOL_PREFIX}${requestedServer}__`))
      .map(schema => schema.name))
  }

  const scored = candidates
    .filter(schema => requestedServer === undefined || schema.name.startsWith(`${MCP_TOOL_PREFIX}${requestedServer}__`))
    .map((schema) => {
      const haystack = `${schema.name} ${schema.description}`.toLocaleLowerCase()
      return { name: schema.name, score: words.filter(word => haystack.includes(word)).length }
    })
  const bestScore = Math.max(0, ...scored.map(candidate => candidate.score))
  return new Set(scored
    .filter(candidate => candidate.score === bestScore && candidate.score > 0)
    .map(candidate => candidate.name))
}

/** Classify one user request. Ambiguous requests deliberately retain all built-in tools. */
export function selectToolsForMessage(message: string): ToolRouterState {
  const text = message.trim()
  if (!text || AMBIGUOUS_REQUEST.test(text))
    return { full: true, groups: new Set(), mcpTools: emptyMcpTools() }

  const groups = GROUP_PATTERNS
    .filter(([, pattern]) => pattern.test(text))
    .map(([group]) => group)

  if (groups.length === 0) {
    // A standalone question normally needs no tools; vague imperatives should not lose capability.
    if (/^[^\n]{1,180}[?？]$/u.test(text))
      return { full: false, groups: new Set(), mcpTools: emptyMcpTools() }
    return { full: true, groups: new Set(), mcpTools: emptyMcpTools() }
  }

  return { full: false, groups: new Set(groups), mcpTools: emptyMcpTools() }
}

/** Keep per-Agent routing state without retaining disposed Agent instances. */
export class ToolRouter {
  private readonly states = new WeakMap<object, ToolRouterState>()

  remember(agent: AgentLike, message: string): void {
    if (typeof agent !== 'object' || agent === null)
      return
    this.states.set(agent, selectToolsForMessage(message))
  }

  expand(agent: AgentLike, groups: readonly string[]): ToolRouterState {
    if (typeof agent !== 'object' || agent === null)
      return { full: true, groups: new Set(), mcpTools: emptyMcpTools() }
    const previous = this.states.get(agent)
    if (previous?.full)
      return previous
    const state = {
      full: false,
      groups: new Set([...previous?.groups ?? [], ...groups]),
      mcpTools: previous?.mcpTools ?? emptyMcpTools(),
    }
    this.states.set(agent, state)
    return state
  }

  expandMcp(agent: AgentLike, query: string, serverName: string | undefined, schemas: readonly ToolSchemaLike[]): string[] {
    if (typeof agent !== 'object' || agent === null)
      return []
    const previous = this.states.get(agent) ?? { full: true, groups: new Set<string>(), mcpTools: emptyMcpTools() }
    const matched = mcpToolsForRequest(query, serverName, schemas)
    const state = {
      ...previous,
      mcpTools: new Set([...previous.mcpTools, ...matched]),
    }
    this.states.set(agent, state)
    return [...matched]
  }

  filter(agent: AgentLike | undefined, schemas: readonly ToolSchemaLike[]): ToolSchemaLike[] {
    const state = agent && typeof agent === 'object' ? this.states.get(agent) : undefined
    const names = state === undefined || state.full
      ? availableNames(schemas)
      : selectGroupNames([...state.groups], availableNames(schemas))

    return schemas.filter((schema) => {
      if (isMcpTool(schema.name))
        return state?.mcpTools.has(schema.name) === true
      return names.has(schema.name)
    })
  }
}

/** Extract user-visible text from DSH's structured UserMessage shape without trusting metadata. */
export function userMessageText(message: unknown): string {
  const texts: string[] = []
  collectText(message, texts, 0)
  return texts.join('\n').trim()
}

function collectText(value: unknown, texts: string[], depth: number): void {
  if (depth > 5 || value === null || value === undefined)
    return
  if (typeof value === 'string') {
    texts.push(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value)
      collectText(item, texts, depth + 1)
    return
  }
  if (typeof value !== 'object')
    return
  const record = value as Record<string, unknown>
  if (typeof record.text === 'string')
    texts.push(record.text)
  for (const key of ['content', 'blocks']) {
    if (record[key] !== undefined)
      collectText(record[key], texts, depth + 1)
  }
}
