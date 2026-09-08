import { describe, expect, it } from 'vitest'
import { selectToolsForMessage, ToolRouter, userMessageText } from './tool-router'

const schemas = [
  { name: 'bash', description: '' },
  { name: 'read', description: '' },
  { name: 'glob', description: '' },
  { name: 'grep', description: '' },
  { name: 'todo_write', description: '' },
  { name: 'edit', description: '' },
  { name: 'write', description: '' },
  { name: 'web_search', description: '' },
  { name: 'web_fetch', description: '' },
  { name: 'request_tools', description: '' },
  { name: 'request_mcp_tools', description: '' },
  { name: 'mcp__github__search_issues', description: 'Search GitHub repository issues.' },
  { name: 'mcp__github__create_issue', description: 'Create a GitHub repository issue.' },
  { name: 'mcp__linear__search_tickets', description: 'Search Linear tickets.' },
  { name: 'workflow', description: '' },
] as const

describe('tool router', () => {
  it('selects code and edit tools for a code change request', () => {
    const selection = selectToolsForMessage('Fix the React component and update its test.')
    expect(selection.full).toBe(false)
    expect(selection.groups).toEqual(new Set(['code', 'edit']))
    expect(selection.mcpTools).toEqual(new Set())
  })

  it('keeps all built-in tools for ambiguous requests', () => {
    expect(selectToolsForMessage('Help me handle this complex task.').full).toBe(true)
  })

  it('expands selected tools for the next request without unregistering other schemas', () => {
    const agent = {}
    const router = new ToolRouter()
    router.remember(agent, 'Fix the API handler.')
    expect(router.filter(agent, schemas).map(schema => schema.name)).toEqual([
      'bash',
      'read',
      'glob',
      'grep',
      'todo_write',
      'edit',
      'write',
      'request_tools',
      'request_mcp_tools',
    ])

    router.expand(agent, ['web'])
    expect(router.filter(agent, schemas).map(schema => schema.name)).toEqual([
      'bash',
      'read',
      'glob',
      'grep',
      'todo_write',
      'edit',
      'write',
      'web_search',
      'web_fetch',
      'request_tools',
      'request_mcp_tools',
    ])
    expect(schemas.map(schema => schema.name)).toContain('workflow')
  })

  it('keeps every MCP tool hidden until this agent requests matching capabilities', () => {
    const agent = {}
    const router = new ToolRouter()
    router.remember(agent, 'Help me handle this complex task.')

    expect(router.filter(agent, schemas).map(schema => schema.name)).not.toContain('mcp__github__search_issues')

    expect(router.expandMcp(agent, 'search repository issues', undefined, schemas)).toEqual([
      'mcp__github__search_issues',
    ])
    expect(router.filter(agent, schemas).map(schema => schema.name)).toContain('mcp__github__search_issues')
    expect(router.filter(agent, schemas).map(schema => schema.name)).not.toContain('mcp__github__create_issue')
  })

  it('activates every tool from an explicitly selected MCP server', () => {
    const agent = {}
    const router = new ToolRouter()

    expect(router.expandMcp(agent, '', 'github', schemas)).toEqual([
      'mcp__github__search_issues',
      'mcp__github__create_issue',
    ])
  })

  it('extracts text blocks without reading message metadata', () => {
    expect(userMessageText({
      source: { ignored: 'metadata' },
      content: [{ type: 'text', text: 'Search the API documentation.' }],
    })).toBe('Search the API documentation.')
  })
})
