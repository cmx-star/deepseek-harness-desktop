import type { HostContext } from '../../../../dsh-tauri/src/host/types'
import type { AgentLike, ToolSchemaLike } from '../types'
import type { ToolRouter } from './tool-router'
import { REQUEST_MCP_TOOLS_NAME, REQUEST_TOOLS_NAME } from '../../shared/constants'

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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** Register the two always-visible expansion tools. They change only the next request's schemas. */
export function registerToolRequest(ctx: HostContext, router: ToolRouter): () => void {
  const disposeRequestTools = ctx.tools.register({
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

  const disposeRequestMcpTools = ctx.tools.register({
    name: REQUEST_MCP_TOOLS_NAME,
    description: 'Make matching configured MCP tools available on the next request. Use the user request as query; specify serverName only when it is known.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          description: 'The task or capability to match against MCP tool names and descriptions.',
        },
        serverName: {
          type: 'string',
          description: 'Optional configured MCP server name when the intended server is known.',
        },
      },
      required: ['query'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          tools: { type: 'array', items: { type: 'string' } },
        },
        required: ['ok', 'tools'],
      },
      render: (_args: unknown, value: { ok: boolean, tools: string[] }) => textBlock(
        value.ok
          ? `Matching MCP tools are available on the next request: ${value.tools.join(', ') || 'none'}.`
          : 'MCP tools could not be loaded without an active agent.',
      ),
    },
    async execute(args: { query?: unknown, serverName?: unknown }, execution: { agent?: AgentLike }) {
      if (!execution.agent)
        return { ok: false, tools: [] }
      const query = stringValue(args.query) ?? ''
      const serverName = stringValue(args.serverName)
      const schemas = ctx.tools.schemas(execution.agent as never) as ToolSchemaLike[]
      const tools = router.expandMcp(execution.agent, query, serverName, schemas)
      return { ok: true, tools }
    },
  }) ?? (() => {})

  return () => {
    disposeRequestMcpTools()
    disposeRequestTools()
  }
}
