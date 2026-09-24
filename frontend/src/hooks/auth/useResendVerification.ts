export interface ResendError {
    message: string;
}

export const useResendVerification = () => {
    return {
        resend: (_email: string) => { },
        isPending: false,
        cooldownSeconds: 0,
        isCoolingDown: false,
        error: null as ResendError | null,
        message: null as string | null,
    };
};