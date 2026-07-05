import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'client-relations',
  title: 'Property Group — Client Relations',
  version: '0.1.0',
  description:
    'Grupy klientów (holdingi deweloperskie), NPS klienta, przypisanie teamów wg województwa i kokpit handlowca. Rozszerza natywny moduł customers.',
  author: 'Property Group',
  license: 'Proprietary',
  ejectable: true,
}

export { features } from './acl'
