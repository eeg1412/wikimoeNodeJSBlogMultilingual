import http from './http'

export const getDashboardSummaryApi = () => http.get('/dashboard/summary')
