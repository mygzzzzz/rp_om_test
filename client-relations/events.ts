export const events = [
  { id: 'client-relations.client_group.created', label: 'Client Group Created', entity: 'client_group', category: 'crud' },
  { id: 'client-relations.client_group.updated', label: 'Client Group Updated', entity: 'client_group', category: 'crud' },
  { id: 'client-relations.nps_response.created', label: 'NPS Response Recorded', entity: 'nps_response', category: 'crud' },
] as const

export default events
