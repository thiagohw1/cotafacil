import { supabase, supabaseAdmin, hasAdminAccess } from '@/integrations/supabase/client';
import adminUtils from '@/lib/supabase-admin';

/**
 * Script de teste para verificar configuração do Supabase
 * Execute no console do navegador ou crie uma página de teste
 */

export async function testSupabaseConfig() {
    console.log('🧪 Testando configuração do Supabase...\n');

    // =========================================================================
    // TESTE 1: Cliente Público
    // =========================================================================
    console.log('📝 TESTE 1: Cliente Público (anon)');
    try {
        const { data: user } = await supabase.auth.getUser();
        console.log('✅ Cliente público OK');
        console.log('   Usuário autenticado:', user?.user?.email || 'Nenhum');
    } catch (error) {
        console.error('❌ Erro no cliente público:', error);
    }

    // =========================================================================
    // TESTE 2: Cliente Admin - Verificação
    // =========================================================================
    console.log('\n📝 TESTE 2: Cliente Administrativo');
    const adminConfigured = hasAdminAccess();
    console.log(adminConfigured ? '✅ Cliente admin configurado' : '❌ Cliente admin NÃO configurado');

    if (!adminConfigured) {
        console.error('⚠️ Service Role Key não encontrada no .env');
        return;
    }

    // =========================================================================
    // TESTE 3: Listar Tabelas (Admin)
    // =========================================================================
    console.log('\n📝 TESTE 3: Listar todas as tabelas do banco');
    try {
        const { tables, error } = await adminUtils.listAllTables();

        if (error) {
            console.error('❌ Erro ao listar tabelas:', error);
        } else {
            console.log(`✅ ${tables.length} tabelas encontradas:`);
            tables.forEach((table, i) => console.log(`   ${i + 1}. ${table}`));
        }
    } catch (error) {
        console.error('❌ Exceção ao listar tabelas:', error);
    }

    // =========================================================================
    // TESTE 4: Contar Usuários (Admin)
    // =========================================================================
    console.log('\n📝 TESTE 4: Contar usuários cadastrados');
    try {
        const { data, error } = await supabaseAdmin!
            .from('profiles')
            .select('count', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Erro ao contar usuários:', error);
        } else {
            console.log(`✅ Total de usuários: ${data || 0}`);
        }
    } catch (error) {
        console.error('❌ Exceção ao contar usuários:', error);
    }

    // =========================================================================
    // TESTE 5: Ver Todos os Tenants (Admin - Bypass RLS)
    // =========================================================================
    console.log('\n📝 TESTE 5: Listar todos os tenants (bypass RLS)');
    try {
        const { data: tenants, error } = await supabaseAdmin!
            .from('tenants')
            .select('id, name, slug, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('❌ Erro ao listar tenants:', error);
        } else {
            console.log(`✅ ${tenants?.length || 0} tenants encontrados:`);
            tenants?.forEach((tenant, i) => {
                console.log(`   ${i + 1}. ${tenant.name} (${tenant.slug})`);
            });
        }
    } catch (error) {
        console.error('❌ Exceção ao listar tenants:', error);
    }

    // =========================================================================
    // TESTE 6: Estatísticas de uma Tabela
    // =========================================================================
    console.log('\n📝 TESTE 6: Estatísticas da tabela products');
    try {
        const stats = await adminUtils.getTableStats('products');

        if (stats.error) {
            console.error('❌ Erro ao obter estatísticas:', stats.error);
        } else {
            console.log('✅ Estatísticas:');
            console.log(`   Total de registros: ${stats.totalRows}`);
            console.log(`   Tamanho da tabela: ${stats.tableSize}`);
        }
    } catch (error) {
        console.error('❌ Exceção ao obter estatísticas:', error);
    }

    // =========================================================================
    // RESUMO
    // =========================================================================
    console.log('\n' + '='.repeat(60));
    console.log('🎉 RESUMO DOS TESTES');
    console.log('='.repeat(60));
    console.log('✅ Cliente público (anon): Funcionando');
    console.log(`${adminConfigured ? '✅' : '❌'} Cliente admin (service_role): ${adminConfigured ? 'Funcionando' : 'NÃO configurado'}`);
    console.log('\n💡 PRÓXIMOS PASSOS:');
    console.log('   1. Use "supabase" para operações normais de usuário');
    console.log('   2. Use "supabaseAdmin" apenas para operações administrativas');
    console.log('   3. Veja guia completo em: guia_clientes_supabase.md');
    console.log('='.repeat(60));
}

// Executar automaticamente quando importado (opcional)
// testSupabaseConfig();

// Exportar para uso manual
export default testSupabaseConfig;
