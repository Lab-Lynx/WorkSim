import type { TicketTemplate } from '../../types/domain.js';

export const reactAddButtonTemplate: TicketTemplate = {
  key: 'react-add-button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: [
    'src/components/ui/button.tsx',
    'src/pages/home-page.tsx',
  ],
  acceptanceCriteriaStructure: [
    'Add a new button variant or action with accessible styling',
    'Integrate the action into the HomePage component',
  ],
  testChecklistStructure: [
    'Smoke test verifies the button renders with appropriate variant classes on HomePage',
    'Accessible focus and disabled state interactions work correctly',
  ],
};
