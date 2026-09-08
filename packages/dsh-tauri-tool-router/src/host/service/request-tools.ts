import type { HostContext } from '../../../../dsh-tauri/src/host/types'
import type { AgentLike } from '../types'
import type { ToolRouter } from './tool-router'
import { REQUEST_TOOLS_NAME } from '../../shared/constants'

const TOOL_GROUPS = ['code', 'edit', 'web', 'browser', 'image', 'worktree', 'delegation', 'schedule', 'planning', 'jobs'] as const

type ToolGroup = typeof TOOL_GROUPS[number]

function textBlock(text: string): Array<{ type: 'text', text: string }> {
  return [{ type: 'text', text }]
}

function groupList(value: unknown): ToolGroup[] {
  if (!Array.isArray(value))
    return []
  return value.filter((group): group is ToolGroup => typeof group === 'string' && (TOOL_GROUPS as readonly string[]).includes(group))
}

/** Register the small, always-visible expansion tool. It changes only the next request's schemas. */
export function registerToolRequest(ctx: HostContext, router: ToolRouter): () => void {
  return ctx.tools.register({
    name: REQUEST_TOOLS_NAME,
    description: 'Load additional tool categories for the next request when the currently available tools are insufficient.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        categories: {
          type: 'array',
          items: { type: 'string', enum: TOOL_GROUPS },
          description: 'Tool categories to add: code, edit, web, browser, image, worktree, delegation, schedule, planning, jobs.',
        },
      },
      required: ['categories'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          categories: { type: 'array', items: { type: 'string' } },
        },
        required: ['ok', 'categories'],
      },
      render: (_args: unknown, value: { ok: boolean, categories: string[] }) => textBlock(
        value.ok
          ? `Additional tool categories are available on the next request: ${value.categories.join(', ') || 'none'}.`
          : 'Additional tool categories could not be loaded.',
      ),
    },
    async execute(args: { categories?: unknown }, execution: { agent?: AgentLike }) {
      const categories = groupList(args.categories)
      if (!execution.agent)
        return { ok: false, categories: [] }
      router.expand(execution.agent, categories)
      return { ok: true, categories }
    },
  }) ?? (() => {})
}
