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
  { name: 'workflow', description: '' },
] as const

describe('tool router', () => {
  it('selects code and edit tools for a code change request', () => {
    const selection = selectToolsForMessage('Fix the React component and update its test.')
    expect(selection.full).toBe(false)
    expect(selection.groups).toEqual(new Set(['code', 'edit']))
  })

  it('keeps all tools for ambiguous requests', () => {
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
    ])
    expect(schemas.map(schema => schema.name)).toContain('workflow')
  })

  it('extracts text blocks without reading message metadata', () => {
    expect(userMessageText({
      source: { ignored: 'metadata' },
      content: [{ type: 'text', text: 'Search the API documentation.' }],
    })).toBe('Search the API documentation.')
  })
})
