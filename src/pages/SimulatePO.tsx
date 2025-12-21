import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generatePOsFromQuote } from '@/lib/generatePOsFromQuote';
import { getCurrentTenantId } from '@/lib/purchase-order-helpers';
import { useNavigate } from 'react-router-dom';

export default function SimulatePO() {
    const [status, setStatus] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const navigate = useNavigate();

    const addLog = (message: string) => {
        setStatus(prev => [...prev, message]);
    };

    const runSimulation = async () => {
        setLoading(true);
        setStatus([]);
        setResult(null);

        try {
            addLog("Iniciando simulação...");

            // 1. Obter Tenant
            const tenantId = await getCurrentTenantId();
            if (!tenantId) throw new Error("Usuário não autenticado ou sem Tenant ID.");
            addLog(`Tenant ID: ${tenantId}`);

            // 2. Criar Produtos de Teste
            addLog("Criando produtos de teste...");
            const { data: product1 } = await supabase.from('products').insert({
                tenant_id: tenantId,
                name: `Produto Teste A ${Date.now()}`,
                active: true
            }).select().single();

            const { data: product2 } = await supabase.from('products').insert({
                tenant_id: tenantId,
                name: `Produto Teste B ${Date.now()}`,
                active: true
            }).select().single();

            if (!product1 || !product2) throw new Error("Falha ao criar produtos.");
            addLog(`Produtos criados: ID ${product1.id}, ID ${product2.id}`);

            // 3. Criar Fornecedores de Teste
            addLog("Criando fornecedores de teste...");
            const { data: supplier1 } = await supabase.from('suppliers').insert({
                tenant_id: tenantId,
                name: `Fornecedor Alpha ${Date.now()}`,
                email: 'alpha@test.com',
                active: true
            }).select().single();

            const { data: supplier2 } = await supabase.from('suppliers').insert({
                tenant_id: tenantId,
                name: `Fornecedor Beta ${Date.now()}`,
                email: 'beta@test.com',
                active: true
            }).select().single();

            if (!supplier1 || !supplier2) throw new Error("Falha ao criar fornecedores.");
            addLog(`Fornecedores criados: ID ${supplier1.id}, ID ${supplier2.id}`);

            // 4. Criar Cotação
            addLog("Criando cotação...");
            const { data: quote, error: quoteError } = await supabase.from('quotes').insert({
                tenant_id: tenantId,
                title: `Cotação Simulada ${new Date().toLocaleTimeString()}`,
                status: 'open',
                deadline_at: new Date(Date.now() + 86400000).toISOString()
            }).select().single();

            if (quoteError || !quote) throw new Error("Falha ao criar cotação: " + quoteError?.message);
            addLog(`Cotação criada: ID ${quote.id} - ${quote.title}`);

            // 5. Adicionar Itens
            addLog("Adicionando itens à cotação...");
            const { data: item1 } = await supabase.from('quote_items').insert({
                quote_id: quote.id,
                product_id: product1.id,
                requested_qty: 10,
                sort_order: 0
            }).select().single();

            const { data: item2 } = await supabase.from('quote_items').insert({
                quote_id: quote.id,
                product_id: product2.id,
                requested_qty: 5,
                sort_order: 1
            }).select().single();

            if (!item1 || !item2) throw new Error("Falha ao criar itens.");

            // 6. Associar Fornecedores
            addLog("Associando fornecedores...");
            const { data: qs1, error: err1 } = await supabase.from('quote_suppliers').insert({
                quote_id: quote.id,
                supplier_id: supplier1.id
            }).select().single();

            if (err1) {
                console.error("Erro Fornecedor 1:", err1);
                throw new Error(`Erro ao associar fornecedor 1: ${err1.message} (${err1.details || 'sem detalhes'})`);
            }

            const { data: qs2, error: err2 } = await supabase.from('quote_suppliers').insert({
                quote_id: quote.id,
                supplier_id: supplier2.id
            }).select().single();

            if (err2) {
                console.error("Erro Fornecedor 2:", err2);
                throw new Error(`Erro ao associar fornecedor 2: ${err2.message}`);
            }

            if (!qs1 || !qs2) throw new Error("Falha ao associar fornecedores (dados nulos).");

            // 7. Simular Respostas (Preços)
            addLog("Simulando respostas dos fornecedores...");

            // Fornecedor 1 ganha Item 1 (Preço menor)
            const { data: resp1 } = await supabase.from('quote_responses').insert({
                quote_id: quote.id,
                quote_item_id: item1.id,
                quote_supplier_id: qs1.id,
                price: 100.00,
                delivery_days: 5
            }).select().single();

            await supabase.from('quote_responses').insert({
                quote_id: quote.id,
                quote_item_id: item1.id,
                quote_supplier_id: qs2.id, // Fornecedor 2 mais caro
                price: 120.00,
                delivery_days: 3
            });

            // Fornecedor 2 ganha Item 2
            await supabase.from('quote_responses').insert({
                quote_id: quote.id,
                quote_item_id: item2.id,
                quote_supplier_id: qs1.id,
                price: 55.00,
            });

            const { data: resp4 } = await supabase.from('quote_responses').insert({
                quote_id: quote.id,
                quote_item_id: item2.id,
                quote_supplier_id: qs2.id, // Fornecedor 2 mais barato
                price: 50.00,
                delivery_days: 2
            }).select().single();

            // 8. Definir Vencedores
            addLog("Definindo vencedores...");

            // Item 1 -> Fornecedor 1
            await supabase.from('quote_items').update({
                winner_supplier_id: supplier1.id,
                winner_response_id: resp1.id,
                winner_reason: 'Simulação - Menor Preço'
            }).eq('id', item1.id);

            // Item 2 -> Fornecedor 2
            await supabase.from('quote_items').update({
                winner_supplier_id: supplier2.id,
                winner_response_id: resp4.id,
                winner_reason: 'Simulação - Menor Preço'
            }).eq('id', item2.id);

            // 9. Fechar Cotação
            addLog("Encerrando cotação...");
            await supabase.from('quotes').update({ status: 'closed' }).eq('id', quote.id);

            // 10. Gerar POs
            addLog(">>> GERANDO PROCESSOS DE COMPRA (POs)...");
            const genResult = await generatePOsFromQuote(quote.id);

            if (genResult.success) {
                setResult(genResult);
                addLog("SUCESSO! POs gerados.");
            } else {
                throw new Error(genResult.error);
            }

        } catch (error: any) {
            console.error(error);
            addLog(`ERRO FATAL: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-8 max-w-3xl">
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl">Simulador de Fluxo de Compras</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                        <p className="font-semibold mb-2">O que exatamente será feito:</p>
                        <ol className="list-decimal list-inside space-y-1">
                            <li>Criar 2 produtos e 2 fornecedores de teste</li>
                            <li>Criar uma nova cotação e adicionar os itens</li>
                            <li>Simular respostas (preços) dos fornecedores</li>
                            <li>Definir vencedores automaticamente</li>
                            <li>Encerrar a cotação</li>
                            <li><strong>Executar a geração automática de Purchase Orders</strong></li>
                        </ol>
                    </div>

                    <Button
                        size="lg"
                        onClick={runSimulation}
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Executando Simulação...
                            </>
                        ) : (
                            <>
                                <Play className="mr-2 h-4 w-4" />
                                Iniciar Simulação Agora
                            </>
                        )}
                    </Button>

                    <div className="space-y-2 font-mono text-sm bg-black text-green-400 p-4 rounded-md h-[300px] overflow-y-auto">
                        {status.length === 0 && <span className="text-gray-500">Aguardando início...</span>}
                        {status.map((log, i) => (
                            <div key={i}>&gt; {log}</div>
                        ))}
                    </div>

                    {result && result.success && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h3 className="flex items-center gap-2 font-bold text-green-800 mb-2">
                                <CheckCircle className="h-5 w-5" />
                                Simulação Concluída com Sucesso!
                            </h3>
                            <p className="text-green-700 mb-4">
                                Foram gerados {result.pos.length} pedidos de compra.
                            </p>
                            <Button onClick={() => navigate('/purchase-orders')} variant="outline" className="w-full">
                                Ver Pedidos Gerados
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
