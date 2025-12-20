import { supabaseAdmin, hasAdminAccess } from '@/integrations/supabase/client';

/**
 * Utilitário para operações administrativas no banco de dados
 * 
 * ⚠️ ATENÇÃO: Estas funções bypassam Row Level Security (RLS)
 * Use apenas para operações administrativas e migrations
 */

// ============================================================================
// VERIFICAÇÃO DE CONFIGURAÇÃO
// ============================================================================

/**
 * Verifica se o cliente administrativo está configurado
 */
export function checkAdminConfig(): boolean {
    const hasAccess = hasAdminAccess();

    if (!hasAccess) {
        console.error(
            '❌ Service Role Key não configurada!\n' +
            'Adicione VITE_SUPABASE_SERVICE_ROLE_KEY ao arquivo .env\n' +
            'Obtenha a chave em: Settings → API → service_role key'
        );
    }

    return hasAccess;
}

// ============================================================================
// OPERAÇÕES DDL (Data Definition Language)
// ============================================================================

/**
 * Executa SQL arbitrário (DDL ou DML)
 * Use para migrations, alterações de schema, etc.
 */
export async function executeSQL(query: string): Promise<{ success: boolean; error?: any }> {
    if (!checkAdminConfig()) {
        return { success: false, error: 'Admin access not configured' };
    }

    try {
        console.log('🔧 Executando SQL:', query.substring(0, 100) + '...');

        const { data, error } = await supabaseAdmin!.rpc('execute_sql', { query });

        if (error) {
            console.error('❌ Erro ao executar SQL:', error);
            return { success: false, error };
        }

        console.log('✅ SQL executado com sucesso');
        return { success: true };
    } catch (error) {
        console.error('❌ Exceção ao executar SQL:', error);
        return { success: false, error };
    }
}

/**
 * Adiciona uma coluna a uma tabela existente
 */
export async function addColumn(
    table: string,
    columnName: string,
    columnType: string,
    options: {
        notNull?: boolean;
        defaultValue?: string;
        unique?: boolean;
    } = {}
): Promise<{ success: boolean; error?: any }> {
    const constraints: string[] = [];

    if (options.notNull) constraints.push('NOT NULL');
    if (options.defaultValue) constraints.push(`DEFAULT ${options.defaultValue}`);
    if (options.unique) constraints.push('UNIQUE');

    const query = `
    ALTER TABLE ${table} 
    ADD COLUMN IF NOT EXISTS ${columnName} ${columnType} ${constraints.join(' ')};
  `;

    return executeSQL(query);
}

/**
 * Cria um índice em uma tabela
 */
export async function createIndex(
    table: string,
    columns: string[],
    options: {
        name?: string;
        unique?: boolean;
    } = {}
): Promise<{ success: boolean; error?: any }> {
    const indexName = options.name || `idx_${table}_${columns.join('_')}`;
    const unique = options.unique ? 'UNIQUE' : '';

    const query = `
    CREATE ${unique} INDEX IF NOT EXISTS ${indexName} 
    ON ${table}(${columns.join(', ')});
  `;

    return executeSQL(query);
}

// ============================================================================
// OPERAÇÕES DE DADOS (Bypass RLS)
// ============================================================================

/**
 * Lista todos os registros de uma tabela (todos os tenants)
 */
export async function getAllRecords<T = any>(
    table: string,
    options: {
        select?: string;
        limit?: number;
        orderBy?: { column: string; ascending?: boolean };
    } = {}
): Promise<{ data: T[] | null; error: any }> {
    if (!checkAdminConfig()) {
        return { data: null, error: 'Admin access not configured' };
    }

    let query = supabaseAdmin!.from(table).select(options.select || '*');

    if (options.limit) {
        query = query.limit(options.limit);
    }

    if (options.orderBy) {
        query = query.order(options.orderBy.column, {
            ascending: options.orderBy.ascending ?? true
        });
    }

    const { data, error } = await query;

    if (error) {
        console.error(`❌ Erro ao buscar registros de ${table}:`, error);
    }

    return { data, error };
}

/**
 * Atualização em massa (todos os tenants)
 */
export async function bulkUpdate(
    table: string,
    updates: Record<string, any>,
    where?: { column: string; value: any }
): Promise<{ success: boolean; count?: number; error?: any }> {
    if (!checkAdminConfig()) {
        return { success: false, error: 'Admin access not configured' };
    }

    try {
        let query = supabaseAdmin!.from(table).update(updates);

        if (where) {
            query = query.eq(where.column, where.value);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error(`❌ Erro ao atualizar ${table}:`, error);
            return { success: false, error };
        }

        console.log(`✅ ${count || 0} registros atualizados em ${table}`);
        return { success: true, count: count || 0 };
    } catch (error) {
        console.error(`❌ Exceção ao atualizar ${table}:`, error);
        return { success: false, error };
    }
}

/**
 * Deletar registros (todos os tenants)
 */
export async function bulkDelete(
    table: string,
    where: { column: string; value: any }
): Promise<{ success: boolean; count?: number; error?: any }> {
    if (!checkAdminConfig()) {
        return { success: false, error: 'Admin access not configured' };
    }

    try {
        const { data, error, count } = await supabaseAdmin!
            .from(table)
            .delete()
            .eq(where.column, where.value);

        if (error) {
            console.error(`❌ Erro ao deletar de ${table}:`, error);
            return { success: false, error };
        }

        console.log(`✅ ${count || 0} registros deletados de ${table}`);
        return { success: true, count: count || 0 };
    } catch (error) {
        console.error(`❌ Exceção ao deletar de ${table}:`, error);
        return { success: false, error };
    }
}

// ============================================================================
// ESTATÍSTICAS E MANUTENÇÃO
// ============================================================================

/**
 * Obtém estatísticas de uma tabela
 */
export async function getTableStats(table: string): Promise<{
    totalRows?: number;
    tableSize?: string;
    error?: any;
}> {
    if (!checkAdminConfig()) {
        return { error: 'Admin access not configured' };
    }

    try {
        // Contar linhas
        const { count, error: countError } = await supabaseAdmin!
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (countError) {
            return { error: countError };
        }

        // Tamanho da tabela
        const { data: sizeData, error: sizeError } = await supabaseAdmin!.rpc('execute_sql', {
            query: `
        SELECT pg_size_pretty(pg_total_relation_size('${table}')) as size;
      `
        });

        return {
            totalRows: count || 0,
            tableSize: sizeData?.[0]?.size || 'N/A'
        };
    } catch (error) {
        return { error };
    }
}

/**
 * Lista todas as tabelas do schema público
 */
export async function listAllTables(): Promise<{ tables: string[]; error?: any }> {
    if (!checkAdminConfig()) {
        return { tables: [], error: 'Admin access not configured' };
    }

    const query = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `;

    const { data, error } = await supabaseAdmin!.rpc('execute_sql', { query });

    if (error) {
        return { tables: [], error };
    }

    const tables = data?.map((row: any) => row.table_name) || [];
    return { tables };
}

// ============================================================================
// EXEMPLO DE USO
// ============================================================================

/**
 * Exemplo de script de migration
 */
export async function exampleMigration() {
    console.log('🚀 Iniciando migration de exemplo...');

    // 1. Adicionar coluna
    const { success: col1 } = await addColumn('products', 'sku', 'TEXT', {
        unique: true
    });

    if (!col1) return;

    // 2. Criar índice
    const { success: idx1 } = await createIndex('products', ['sku']);

    if (!idx1) return;

    // 3. Atualizar dados
    const { success: upd1 } = await bulkUpdate(
        'products',
        { active: true },
        { column: 'deleted_at', value: null }
    );

    console.log('✅ Migration concluída!');
}

// Exportar tudo
export default {
    checkAdminConfig,
    executeSQL,
    addColumn,
    createIndex,
    getAllRecords,
    bulkUpdate,
    bulkDelete,
    getTableStats,
    listAllTables,
    exampleMigration,
};
