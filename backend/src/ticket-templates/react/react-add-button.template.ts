import type { TicketTemplate } from '../../types/domain.js';

export const reactAddButtonTemplate: TicketTemplate = {
  key: 'react-add-button',
  category: 'frontend',
  difficulty: 'beginner',
  touchedFiles: ['src/App.tsx', 'src/components/Button.tsx'],
  acceptanceCriteriaStructure: ['Add a reusable button', 'Wire it into the page'],
  testChecklistStructure: ['Unit test the button', 'Smoke-test the page'],
};
