import { describe, it, expect } from 'vitest'
import { listVineyards, createVineyard, getVineyard, deleteVineyard } from './vineyards'

describe('vineyards api', () => {
  it('listVineyards returns array', async () => {
    const list = await listVineyards()
    expect(Array.isArray(list)).toBe(true)
    expect(list[0].name).toBe('Testberg')
  })

  it('createVineyard returns new vineyard', async () => {
    const v = await createVineyard({ name: 'Neu' })
    expect(v.id).toBe('vineyard-1')
  })

  it('getVineyard returns vineyard by id', async () => {
    const v = await getVineyard('vineyard-1')
    expect(v.name).toBe('Testberg')
  })

  it('deleteVineyard resolves without error', async () => {
    await expect(deleteVineyard('vineyard-1')).resolves.toBeUndefined()
  })
})
