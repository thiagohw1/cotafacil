import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotifications } from "@/contexts/NotificationContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function Notifications() {
    const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();

    const handleNotificationClick = async (id: number, link?: string) => {
        await markAsRead(id);
        if (link) {
            navigate(link);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-8">
            <Header
                title="Notificações"
                description="Visualize e gerencie suas notificações."
                actions={
                    notifications.some((n) => !n.is_read) ? (
                        <Button onClick={markAllAsRead} variant="outline" size="sm">
                            <Check className="mr-2 h-4 w-4" />
                            Marcar todas como lidas
                        </Button>
                    ) : null
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Todas as Notificações
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {notifications.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Nenhuma notificação encontrada.
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification.id, notification.link)}
                                    className={cn(
                                        "flex flex-col gap-1 p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50",
                                        !notification.is_read ? "bg-muted/30 border-primary/20" : "bg-card"
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <h4 className={cn("font-medium", !notification.is_read && "text-primary")}>
                                            {notification.title}
                                        </h4>
                                        {!notification.is_read && (
                                            <span className="h-2 w-2 rounded-full bg-destructive shrink-0 mt-2" />
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                                    <span className="text-xs text-muted-foreground pt-1">
                                        {format(new Date(notification.created_at), "dd 'de' MMMM 'às' HH:mm", {
                                            locale: ptBR,
                                        })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
