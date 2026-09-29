import type { TicketTemplate } from '../../types/domain.js';

export const reactDashboardCardTemplate: TicketTemplate = {
  key: 'react-dashboard-card',
  category: 'frontend',
  difficulty: 'advanced',
  touchedFiles: [
    'src/components/ui/card.tsx',
    'src/pages/home-page.tsx',
    'src/app/routes.test.tsx',
  ],
  acceptanceCriteriaStructure: [
    'Compose a structured dashboard widget utilizing CardHeader, CardTitle, and CardContent',
    'Implement responsive layout and error/empty state fallbacks within the view',
  ],
  testChecklistStructure: [
    'Integration test verifies card component renders required headings and sections',
    'Test verifies state changes update the card content appropriately',
  ],
};
