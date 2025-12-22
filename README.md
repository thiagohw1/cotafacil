# CotaFácil - Sistema de Gestão de Cotações e Compras

O **CotaFácil** é uma aplicação web completa desenvolvida para otimizar o processo de compras e cotações de empresas. O sistema permite gerenciar produtos, fornecedores, criar cotações interativas, receber propostas online e gerar pedidos de compra automaticamente, tudo em uma interface moderna e intuitiva.

## 🚀 Tecnologias Utilizadas

- **Frontend**: React, Vite, TypeScript
- **UI/UX**: Tailwind CSS, Shadcn/UI, Lucide Icons
- **Backend/Database**: Supabase (PostgreSQL, Auth, Realtime, Edge Functions)
- **Gerenciamento de Estado**: React Query, Context API
- **Outros**: Recharts (Gráficos), React Router DOM (Navegação)

---

## 📦 Módulos e Funcionalidades

### 1. 📊 Dashboards
Visão geral estratégica do negócio.
- **Dashboard Principal**: Resumo de cotações em aberto, pedidos pendentes, e alertas de estoque/preço.
- **Dashboard de Compras (PO)**: Métricas específicas de pedidos de compra, incluindo gastos por período, status dos pedidos e top fornecedores.

### 2. 📝 Cadastros Gerais
Gestão da base de dados essencial para o funcionamento do sistema.
- **Produtos**:
  - Cadastro completo com suporte a múltiplas embalagens (ex: Unidade, Caixa com 12, Fardo com 20).
  - Definição de embalagem padrão de compra.
  - Categorização e gestão de status (ativo/inativo).
- **Fornecedores**:
  - Gestão de contatos e dados comerciais.
  - Histórico de fornecimento.
- **Listas de Produtos**:
  - Criação de listas de compras recorrentes para agilizar a criação de cotações.

### 3. 💰 Gestão de Cotações
O coração do sistema, focado em obter o melhor preço.
- **Criação de Cotação**:
  - Adição rápida de produtos (busca inteligente).
  - Importação de itens via Listas de Produtos.
  - Definição de prazos e observações.
- **Portal do Fornecedor**:
  - Link externo seguro para fornecedores enviarem seus preços sem necessidade de login no sistema.
  - Interface simplificada e responsiva para preenchimento de preços e observações pelo fornecedor.
- **Análise de Propostas**:
  - Matriz de comparação de preços lado a lado.
  - Destaque automático para o menor preço por item.
  - Funcionalidade de "Auto-selecionar Vencedores" baseada no menor custo.

### 4. 🛒 Pedidos de Compra (Purchase Orders)
Transformação de cotações em pedidos formais.
- **Geração Automática**: Criação de POs a partir dos itens vencedores de uma cotação.
- **Gestão de Status**: Acompanhamento do ciclo de vida (Rascunho, Enviado, Confirmado, Entregue, Cancelado).
- **Exportação**: Geração de PDF do pedido para envio ao fornecedor.
- **Validações**: Prevenção de duplicidade de itens e controle de quantidades.

### 5. 📈 Relatórios e Histórico
Inteligência de dados para tomada de decisão.
- **Histórico de Preços**: Acompanhamento da evolução do preço de produtos ao longo do tempo.
- **Performance de Fornecedores**: Análise de quem vence mais cotações e histórico de fornecimento.
- **Logs de Atividade**: Rastreabilidade de ações importantes no sistema (quem fez o que e quando).

### 6. 🔔 Sistema e Notificações
- **Notificações em Tempo Real**: Alertas sobre respostas de fornecedores, prazos de cotação e status de pedidos.
- **Multi-tenancy**: Arquitetura preparada para suportar múltiplas organizações/empresas com dados isolados.
- **Permissões**: Controle de acesso baseado em funções (Admin/Usuário).

---

## 🛠️ Instalação e Execução

### Pré-requisitos
- Node.js (v18+)
- Conta no Supabase

### Passos
1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/cotafacil.git
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Configure as variáveis de ambiente (`.env`):
   ```env
   VITE_SUPABASE_URL=sua_url_supabase
   VITE_SUPABASE_ANON_KEY=sua_key_supabase
   ```
4. Execute o projeto localmente:
   ```bash
   npm run dev
   ```

## 📄 Estrutura do Banco de Dados (Supabase)
O sistema utiliza um banco PostgreSQL robusto com as seguintes tabelas principais:
- `tenants`: Organizações.
- `profiles`: Perfis de usuários.
- `products` / `product_packages`: Catálogo.
- `quotes` / `quote_items`: Cotações.
- `quote_suppliers`: Vínculo e status de resposta dos fornecedores.
- `purchase_orders` / `purchase_order_items`: Pedidos finais.
