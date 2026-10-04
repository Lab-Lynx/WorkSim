export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  BILLING: '/billing',
  BILLING_RETURN: '/billing/return',
  GITHUB: '/github',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  SUBMISSIONS: '/submissions',
  TICKET: '/tickets/:ticketId',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
} as const;

export const QUERY_KEYS = {
  USERS: 'users',
  PRODUCTS: 'products',
} as const;
