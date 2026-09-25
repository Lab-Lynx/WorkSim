export interface User {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
}

export const useMe = () => {
  return {
    data: null as User | null,
    isLoading: false,
    error: null,
  };
};
