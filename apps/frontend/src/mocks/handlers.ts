import { http, HttpResponse } from 'msw'
import type { User, Vineyard, AuthResponse, Row, Vine, Task, GrapeVariety, Harvest, WeatherData, PlantProtectionStatus } from '../types'

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'viewer',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockVineyard: Vineyard = {
  id: 'vineyard-1',
  name: 'Testberg',
  description: 'Ein Weinberg',
  boundary: {
    type: 'Polygon',
    coordinates: [[[7.5, 47.5], [7.6, 47.5], [7.6, 47.6], [7.5, 47.6], [7.5, 47.5]]],
  },
  ownerId: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockRow: Row = {
  id: 'row-1',
  vineyardId: 'vineyard-1',
  rowNumber: 1,
  variety: 'Riesling',
  status: 'confirmed',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockVine: Vine = {
  id: 'vine-1',
  rowId: 'row-1',
  vineNumber: 1,
  position: { type: 'Point', coordinates: [7.55, 47.55] },
  createdAt: '2024-01-01T00:00:00Z',
}

const mockVariety: GrapeVariety = {
  id: 'variety-1',
  name: 'Riesling',
  color: 'weiss',
  createdBy: 'user-1',
  createdAt: '2024-01-01T00:00:00Z',
}

const mockHarvest: Harvest = {
  id: 'harvest-1',
  vineyardId: 'vineyard-1',
  varietyId: 'variety-1',
  variety: { id: 'variety-1', name: 'Riesling', color: 'weiss', createdBy: 'user-1', createdAt: '2024-01-01T00:00:00Z' },
  harvestDate: '2024-09-15',
  weightKg: 450.5,
  oechsle: 82,
  createdBy: 'user-1',
  createdAt: '2024-09-15T00:00:00Z',
}

const mockWeather: WeatherData = {
  stationId: 42,
  stationName: 'Breisach',
  tempC: 14.2,
  humidityPct: 71,
  precipMm: 1.4,
  leafWetH: 2.5,
  fetchedAt: '2026-04-24T08:00:00Z',
}

const mockProtection: PlantProtectionStatus = {
  lastSprayDate: '2026-04-18',
  daysSinceSpray: 6,
  protectionPct: 50,
  level: 'gelb',
}

const mockTask: Task = {
  id: 'task-1',
  vineId: 'vine-1',
  title: 'Beschnitt',
  recordType: 'aufgabe',
  category: 'rebenpflege',
  status: 'offen',
  createdAt: '2024-01-01T00:00:00Z',
}

export const handlers = [
  http.post('/api/auth/register', () => HttpResponse.json(mockUser, { status: 201 })),
  http.post('/api/auth/login', () => {
    const resp: AuthResponse = { token: 'mock-jwt-token', user: mockUser }
    return HttpResponse.json(resp)
  }),
  http.get('/api/auth/me', () => HttpResponse.json(mockUser)),

  http.get('/api/vineyards', () => HttpResponse.json([mockVineyard])),
  http.post('/api/vineyards', () => HttpResponse.json(mockVineyard, { status: 201 })),
  http.get('/api/vineyards/:id', () => HttpResponse.json(mockVineyard)),
  http.put('/api/vineyards/:id', () => HttpResponse.json(mockVineyard)),
  http.delete('/api/vineyards/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/vineyards/:vineyardId/rows', () => HttpResponse.json([mockRow])),
  http.post('/api/vineyards/:vineyardId/rows', () => HttpResponse.json(mockRow, { status: 201 })),
  http.delete('/api/rows/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/rows/:rowId/vines', () => HttpResponse.json([mockVine])),
  http.post('/api/rows/:rowId/vines', () => HttpResponse.json(mockVine, { status: 201 })),
  http.get('/api/vines/nearby', () => HttpResponse.json([mockVine])),

  http.get('/api/varieties', () => HttpResponse.json([mockVariety])),
  http.post('/api/varieties', () => HttpResponse.json(mockVariety, { status: 201 })),
  http.delete('/api/varieties/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/vineyards/:vineyardId/harvests', () => HttpResponse.json([mockHarvest])),
  http.post('/api/vineyards/:vineyardId/harvests', () => HttpResponse.json(mockHarvest, { status: 201 })),
  http.put('/api/harvests/:id', () => HttpResponse.json(mockHarvest)),
  http.delete('/api/harvests/:id', () => new HttpResponse(null, { status: 204 })),

  http.get('/api/vines/:vineId/tasks', () => HttpResponse.json([mockTask])),
  http.get('/api/tasks', () => HttpResponse.json([mockTask])),
  http.post('/api/tasks', () => HttpResponse.json(mockTask, { status: 201 })),
  http.patch('/api/tasks/:id/status', () => HttpResponse.json({ ...mockTask, status: 'in_bearbeitung' })),

  http.get('/api/vineyards/:id/weather', () => HttpResponse.json(mockWeather)),
  http.get('/api/vineyards/:id/plant-protection-status', () => HttpResponse.json(mockProtection)),
]
