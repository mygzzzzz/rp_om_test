// Feature-based RBAC — flagi gate'ujące strony i API modułu.
// Przypisywane per rola / per użytkownik w panelu admina (Roles & ACL).
export const features = [
  {
    id: 'client-relations.view',
    title: 'View client groups & NPS',
    module: 'client-relations',
  },
  {
    id: 'client-relations.manage',
    title: 'Manage client groups & NPS',
    module: 'client-relations',
  },
  {
    id: 'client-relations.cockpit',
    title: 'Sales cockpit access',
    module: 'client-relations',
  },
] as const
