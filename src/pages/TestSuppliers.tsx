import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function TestSuppliers() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const testQuery = async () => {
        setLoading(true);
        console.clear();
        console.log('🧪 ========== TESTE DE FORNECEDORES ==========');

        try {
            // Teste 1: Query básica
            console.log('\n📋 TESTE 1: Select * sem filtros');
            const { data: data1, error: error1, count: count1 } = await supabase
                .from('suppliers')
                .select('*', { count: 'exact' });

            console.log('Resultado:', {
                count: count1,
                registros: data1?.length,
                data: data1,
                error: error1
            });

            // Teste 2: Só IDs
            console.log('\n📋 TESTE 2: Select apenas id, name');
            const { data: data2, error: error2 } = await supabase
                .from('suppliers')
                .select('id, name');

            console.log('Resultado:', {
                registros: data2?.length,
                data: data2,
                error: error2
            });

            // Teste 3: Com filtro deleted_at
            console.log('\n📋 TESTE 3: Com filtro deleted_at IS NULL');
            const { data: data3, error: error3 } = await supabase
                .from('suppliers')
                .select('id, name, deleted_at')
                .is('deleted_at', null);

            console.log('Resultado:', {
                registros: data3?.length,
                data: data3,
                error: error3
            });

            // Teste 4: Verificar usuário atual
            console.log('\n📋 TESTE 4: Usuário atual');
            const { data: { user } } = await supabase.auth.getUser();
            console.log('User:', user);

            // Teste 5: Verificar tenant do usuário
            console.log('\n📋 TESTE 5: Tenant do usuário');
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', user?.id)
                .single();

            console.log('Profile/Tenant:', profile);

            // Teste 6: Fornecedores do tenant específico
            if (profile?.tenant_id) {
                console.log(`\n📋 TESTE 6: Fornecedores do tenant ${profile.tenant_id}`);
                const { data: data6, error: error6 } = await supabase
                    .from('suppliers')
                    .select('*')
                    .eq('tenant_id', profile.tenant_id);

                console.log('Resultado:', {
                    registros: data6?.length,
                    data: data6,
                    error: error6
                });
            }

            console.log('\n✅ Testes concluídos! Veja os resultados acima.');

            setResult({
                semFiltro: data1,
                comFiltro: data3,
                user: user,
                tenant: profile?.tenant_id
            });

        } catch (err: any) {
            console.error('❌ Erro nos testes:', err);
            setResult({ error: err.message });
        }

        setLoading(false);
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle>🧪 Teste de Fornecedores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                        <p className="text-sm text-yellow-800">
                            <strong>Instruções:</strong>
                        </p>
                        <ol className="text-sm text-yellow-800 mt-2 space-y-1 list-decimal list-inside">
                            <li>Abra o Console do navegador (F12 → Console)</li>
                            <li>Clique no botão abaixo</li>
                            <li>Veja os logs DETALHADOS no console</li>
                            <li>Copie e cole os resultados para análise</li>
                        </ol>
                    </div>

                    <Button
                        onClick={testQuery}
                        disabled={loading}
                        size="lg"
                        className="w-full"
                    >
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        🧪 Executar Teste de Fornecedores
                    </Button>

                    {result && (
                        <div className="mt-4 p-4 bg-gray-50 rounded border">
                            <p className="font-semibold mb-2">Resumo:</p>
                            <pre className="text-xs overflow-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    )}

                    <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded">
                        <p>ℹ️ Este teste executa 6 queries diferentes para identificar o problema:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>SELECT * sem filtros</li>
                            <li>SELECT id, name apenas</li>
                            <li>SELECT com filtro deleted_at IS NULL</li>
                            <li>Verificação do usuário atual</li>
                            <li>Verificação do tenant do usuário</li>
                            <li>SELECT do tenant específico</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
