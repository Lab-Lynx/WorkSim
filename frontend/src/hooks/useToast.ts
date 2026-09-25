export function useToast() {
    return {
        toast: {
            error: (msg: string) => console.error(msg),
            success: (msg: string) => console.log(msg),
        },
    };
}