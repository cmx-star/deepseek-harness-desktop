import { TOOL_ROUTER_PLUGIN_NAME } from './shared/constants'

export const name = TOOL_ROUTER_PLUGIN_NAME
export const inject = ['systemPrompt', 'tools']

export { apply } from './host/apply'
export type { ToolRouterConfig } from './host/types'
