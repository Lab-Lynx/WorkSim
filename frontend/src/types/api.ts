// frontend/src/types/api.ts
export interface Payment {
    id: string;
    amount: string;
    currency: string;
    status: 'completed' | 'pending' | 'failed' | string;
    createdAt: string;
}