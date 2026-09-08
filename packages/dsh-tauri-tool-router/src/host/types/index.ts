export interface ToolRouterConfig {
  enabled?: boolean
}

export interface ToolSchemaLike {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

export interface AgentLike {
  session?: { id?: string }
}

export interface ToolRouterState {
  full: boolean
  groups: Set<string>
  mcpTools: Set<string>
}
