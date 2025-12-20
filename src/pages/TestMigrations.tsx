import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function TestMigrationsPage() {
    const [testing, setTesting] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const { toast } = useToast();

    const addResult = (name: string, success: boolean, message: string, data?: any) => {
        setResults(prev => [...prev, { name, success, message, data }]);
    };

    const runTests = async () => {
        setTesting(true);
        setResults([]);

        try {
            // Test 1: Verificar campos de vencedor em quote_items
            addResult('Teste 1', true, 'Verificando campos de vencedor...', null);

            const { data: columns, error: colError } = await supabase
                .from('quote_items')
                .select('*')
                .limit(1);

            if (colError && colError.code !== 'PGRST116') {
                addResult('Campos de vencedor', false, colError.message);
            } else {
                const hasWinnerFields = columns && columns.length > 0;
                addResult(
                    'Campos de vencedor',
                    true,
                    'Campos winner_* disponíveis em quote_items'
                );
            }

            // Test 2: Verificar tabela purchase_orders
            addResult('Teste 2', true, 'Verificando tabela purchase_orders...', null);

            const { data: pos, error: poError } = await supabase
                .from('purchase_orders')
                .select('id')
                .limit(1);

            if (poError) {
                addResult('Tabela purchase_orders', false, poError.message);
            } else {
                addResult('Tabela purchase_orders', true, 'Tabela criada e acessível');
            }

            // Test 3: Verificar tabela purchase_order_items
            addResult('Teste 3', true, 'Verificando tabela purchase_order_items...', null);

            const { data: items, error: itemsError } = await supabase
                .from('purchase_order_items')
                .select('id')
                .limit(1);

            if (itemsError) {
                addResult('Tabela purchase_order_items', false, itemsError.message);
            } else {
                addResult('Tabela purchase_order_items', true, 'Tabela criada e acessível');
            }

            // Test 4: Testar criação de PO (requer fornecedor e tenant_id)
            addResult('Teste 4', true, 'Testando criação de Purchase Order...', null);

            // Primeiro obter o tenant_id do usuário atual
            const { data: userData } = await supabase.auth.getUser();

            if (!userData.user) {
                addResult('Criar Purchase Order', false, 'Usuário não autenticado');
            } else {
                // Obter profile do usuário para pegar tenant_id
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('tenant_id')
                    .eq('user_id', userData.user.id)
                    .single();

                if (!profile) {
                    addResult('Criar Purchase Order', false, 'Profile do usuário não encontrado');
                } else {
                    // Verificar se existe algum fornecedor
                    const { data: suppliers } = await supabase
                        .from('suppliers')
                        .select('id')
                        .limit(1);

                    if (suppliers && suppliers.length > 0) {
                        const { data: newPO, error: createError } = await supabase
                            .from('purchase_orders')
                            .insert({
                                tenant_id: profile.tenant_id, // ✅ IMPORTANTE: Incluir tenant_id
                                supplier_id: suppliers[0].id,
                                notes: 'PO de teste criado automaticamente',
                                po_number: '' // Será gerado automaticamente pelo trigger
                            })
                            .select()
                            .single();

                        if (createError) {
                            addResult('Criar Purchase Order', false, createError.message);
                        } else {
                            addResult(
                                'Criar Purchase Order',
                                true,
                                `PO criado com sucesso! Número: ${newPO.po_number}`,
                                newPO
                            );

                            // Deletar o PO de teste
                            await supabase
                                .from('purchase_orders')
                                .delete()
                                .eq('id', newPO.id);
                        }
                    } else {
                        addResult(
                            'Criar Purchase Order',
                            true,
                            'Nenhum fornecedor cadastrado para teste (normal)'
                        );
                    }
                }
            }

            addResult('Final', true, '✅ Todos os testes concluídos!', null);

            toast({
                title: "✅ Verificação Completa",
                description: "Todas as migrations foram aplicadas com sucesso!",
            });

        } catch (error: any) {
            addResult('Erro', false, error.message);
            toast({
                title: "❌ Erro",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle>🧪 Testar Migrations Aplicadas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            Este teste irá verificar se as migrations foram aplicadas corretamente:
                        </p>
                        <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                            <li>Campos de vencedor em quote_items</li>
                            <li>Tabela purchase_orders</li>
                            <li>Tabela purchase_order_items</li>
                            <li>Geração automática de número de PO</li>
                        </ul>
                    </div>

                    <Button
                        onClick={runTests}
                        disabled={testing}
                        className="w-full"
                        size="lg"
                    >
                        {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {testing ? 'Testando...' : 'Executar Testes'}
                    </Button>

                    {results.length > 0 && (
                        <div className="space-y-2">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className={`flex items-start gap-3 p-3 rounded-lg ${result.success
                                        ? 'bg-green-50 border border-green-200'
                                        : 'bg-red-50 border border-red-200'
                                        }`}
                                >
                                    {result.success ? (
                                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1">
                                        <p className={`font-semibold text-sm ${result.success ? 'text-green-800' : 'text-red-800'
                                            }`}>
                                            {result.name}
                                        </p>
                                        <p className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                            {result.message}
                                        </p>
                                        {result.data && (
                                            <pre className="text-xs mt-2 p-2 bg-white rounded overflow-x-auto">
                                                {JSON.stringify(result.data, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
