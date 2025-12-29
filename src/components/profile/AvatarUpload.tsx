import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImageCropper } from "./ImageCropper";

interface AvatarUploadProps {
    userId: string;
    avatarUrl: string | null;
    fullName: string | null;
    onAvatarUpdate: (url: string | null) => void;
}

export function AvatarUpload({ userId, avatarUrl, fullName, onAvatarUpdate }: AvatarUploadProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [cropperOpen, setCropperOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                setSelectedImage(reader.result as string);
                setCropperOpen(true);
            });
            reader.readAsDataURL(file);
            // Reset input so same file can be selected again if needed
            event.target.value = "";
        }
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setCropperOpen(false);
        setUploading(true);

        try {
            if (!userId) {
                throw new Error("Usuário não identificado. Tente recarregar a página.");
            }

            const filePath = `${userId}/avatar.webp`;
            console.log("Attempting upload to:", filePath);

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, croppedBlob, {
                    upsert: true,
                    contentType: 'image/webp'
                });

            if (uploadError) {
                console.error("Upload error details:", uploadError);
                throw uploadError;
            }

            // Get public URL
            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
            const publicUrl = data.publicUrl;

            // Add timestamp to force refresh
            const publicUrlWithTimestamp = `${publicUrl}?t=${new Date().getTime()}`;

            // Update profile
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ avatar_url: publicUrlWithTimestamp })
                .eq("user_id", userId);

            if (updateError) throw updateError;

            onAvatarUpdate(publicUrlWithTimestamp);
            toast({ title: "Foto de perfil atualizada!" });

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Erro ao atualizar foto",
                description: error.message || "Erro desconhecido",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
            setSelectedImage(null);
        }
    };

    const handleDelete = async () => {
        if (!avatarUrl) return;
        setUploading(true);

        try {
            // Optional: Delete file from storage if you want to clean up
            // await supabase.storage.from('avatars').remove([`${userId}/avatar.jpg`]);

            const { error } = await supabase
                .from("profiles")
                .update({ avatar_url: null })
                .eq("user_id", userId);

            if (error) throw error;

            onAvatarUpdate(null);
            toast({ title: "Foto removida com sucesso" });
        } catch (error: any) {
            toast({
                title: "Erro ao remover foto",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex items-center gap-6">
            <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-muted">
                    <AvatarImage src={avatarUrl || ""} alt="Avatar" className="object-cover" />
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                        {fullName?.charAt(0) || "U"}
                    </AvatarFallback>
                </Avatar>
                {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}
            </div>

            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        Alterar Foto
                    </Button>
                    {avatarUrl && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={handleDelete}
                            disabled={uploading}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground">
                    JPG, GIF ou PNG. Máximo de 2MB.
                </p>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileSelect}
                />
            </div>

            <ImageCropper
                imageSrc={selectedImage}
                open={cropperOpen}
                onClose={() => setCropperOpen(false)}
                onCropComplete={handleCropComplete}
            />
        </div>
    );
}
