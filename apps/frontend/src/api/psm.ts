import type { PsmProduct, PsmSubstance } from '../types'

const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

export async function searchProducts(q: string, limit = 20): Promise<PsmProduct[]> {
  const res = await fetch(`/api/psm/products?q=${encodeURIComponent(q)}&limit=${limit}`, {
    headers: auth(),
  })
  if (!res.ok) throw new Error('Produkte konnten nicht geladen werden')
  return res.json()
}

export async function getProduct(id: string): Promise<PsmProduct> {
  const res = await fetch(`/api/psm/products/${encodeURIComponent(id)}`, {
    headers: auth(),
  })
  if (!res.ok) throw new Error('Produkt konnte nicht geladen werden')
  return res.json()
}

export async function searchSubstances(q: string, limit = 20): Promise<PsmSubstance[]> {
  const res = await fetch(`/api/psm/substances?q=${encodeURIComponent(q)}&limit=${limit}`, {
    headers: auth(),
  })
  if (!res.ok) throw new Error('Wirkstoffe konnten nicht geladen werden')
  return res.json()
}
