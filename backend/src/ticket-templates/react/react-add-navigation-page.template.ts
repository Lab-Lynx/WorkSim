import type { TicketTemplate } from '../../types/domain.js';

export const reactAddNavigationPageTemplate: TicketTemplate = {
  key: 'react-add-navigation-page',
  category: 'frontend',
  difficulty: 'intermediate',
  touchedFiles: [
    'src/components/layout/app-layout.tsx',
    'src/app/routes.tsx',
    'src/app/routes.test.tsx',
  ],
  acceptanceCriteriaStructure: [
    'Define a new route in the router children array',
    'Add corresponding navigation link in AppLayout with active state indicator',
  ],
  testChecklistStructure: [
    'Test verifies navigation link renders with active aria-current state when at the route',
    'Test verifies navigating to the route renders the page without throwing 404',
  ],
};
