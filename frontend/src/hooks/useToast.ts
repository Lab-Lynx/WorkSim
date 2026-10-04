export function useToast() {
  return {
    toast: {
      error: (msg: string) => console.error(msg),
      success: (msg: string) => {
        void msg;
      },
    },
  };
}
