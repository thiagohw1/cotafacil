export interface Notification {
    id: number;
    user_id: string;
    tenant_id: number;
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}
