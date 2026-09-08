import type { HostContext } from '../../../dsh-tauri/src/host/types'
import type { AgentLike, ToolRouterConfig } from './types'
import { TOOL_ROUTER_PLUGIN_NAME } from '../shared/constants'
import { registerToolRequest } from './service/request-tools'
import { ToolRouter, userMessageText } from './service/tool-router'

/**
 * Select model-facing schemas from each Agent's queued user message.
 * Tool definitions remain registered, so permissions and runtime dispatch stay unchanged.
 */
export function apply(ctx: HostContext, config: ToolRouterConfig = {}): void {
  if (config.enabled === false)
    return

  const router = new ToolRouter()
  ctx.effect(() => {
    const disposeRequestTools = registerToolRequest(ctx, router)
    const disposeInbox = (ctx as any).on('agent/inbox/inserted', (payload: { agent?: AgentLike, message?: unknown }) => {
      const agent = payload.agent
      const text = userMessageText(payload.message)
      if (!agent || !text)
        return
      router.remember(agent, text)
    }) as () => void
    const disposeAssembly = (ctx as any).on('system-prompt/assemble', async (_assembly: unknown, context: { agent?: AgentLike }, next: () => Promise<{ tools?: unknown[] }>) => {
      const assembled = await next()
      const schemas = Array.isArray(assembled.tools) ? assembled.tools : []
      return {
        ...assembled,
        tools: router.filter(context.agent, schemas as any),
      }
    }) as () => void
    return () => {
      disposeAssembly()
      disposeInbox()
      disposeRequestTools()
    }
  }, `${TOOL_ROUTER_PLUGIN_NAME}: request routing`)
}
