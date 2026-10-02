# Acompanhamento Gerencial

Projeto web para coleta online do valor total de vendas diárias de representantes comerciais.

## O que já está pronto

- Supabase real configurado
- Login com e-mail e senha
- Primeiro administrador por auto cadastro
- Convites para representantes
- Cada representante vê apenas os próprios dados
- Administrador vê toda a equipe
- Lançamento diário simples: data + valor + observação
- Um único lançamento por representante por data
- Correção do mesmo dia via atualização
- Meta mensal individual
- Indicador de quem já lançou hoje
- Painel gerencial por mês
- Recuperação de senha
- Segurança RLS no banco

## Banco configurado

Projeto Supabase: Acompanhamento Gerencial
Região: São Paulo

O `config.js` já está apontando para o projeto criado.

## Como testar localmente

Sirva a pasta com qualquer servidor HTTP. Exemplo:

```bash
python -m http.server 8080
```

Depois abra:
http://localhost:8080

## Primeiro acesso

1. Abra o sistema.
2. Clique em `Primeiro acesso`.
3. Cadastre seu nome, e-mail e senha.
4. Se o Supabase solicitar confirmação de e-mail, confirme e faça login.
5. O primeiro perfil válido pode se tornar administrador usando a função segura de bootstrap.

## Como cadastrar representantes

1. Entre como administrador.
2. Em `Gerar convite de representante`, informe nome e meta.
3. Copie o código.
4. Envie o código ao representante.
5. O representante abre a aba `Representante`, informa código, e-mail e senha.
6. O perfil é criado automaticamente.

## Publicação

A pasta está pronta para publicação estática em Vercel, Netlify ou GitHub Pages.
Para publicar pela Vercel, conecte o plugin Vercel no ChatGPT e o projeto poderá ser implantado por lá.


## Evolução gerencial v2

- Ranking mensal automático
- Evolução diária em gráfico
- Contagem de representantes ativos, lançados e pendentes
- Meta restante e média necessária por dia útil
- Edição de nome/meta pelo administrador
- Desativação de representante sem perder histórico
- Exportação CSV do mês
- Barra de progresso individual da meta


## Evolução v3

- Crédito na tela de login: **Projeto pessoal — Especialista Escobar-PB**
- Crédito também no rodapé do sistema
- Comparação de vendas de hoje x ontem
- Projeção de fechamento do mês
- Valor restante para a meta
- Necessidade média por dia útil restante
- Histórico administrativo de lançamentos
- Correção de valor/observação pelo administrador
- Filtro do histórico por data
- Arquivo `vercel.json` pronto para publicação
- `package.json` incluído para facilitar testes e deploy


## Evolução v4
- Status diário corrigido: R$ 0,00 conta como informado
- Status Com venda / Sem venda / Pendente
- Contador Já informaram hoje corrigido
- Datas locais para evitar diferença de UTC
- Recuperação de senha com nova senha
- Filtros por representante e período
- Exportação Excel .xlsx
- Relatório para impressão/PDF


## Correção v4.1

- Corrigido erro que escondia a tela de login após o deploy.
- Adicionada a tela de recuperação de senha que estava referenciada pelo JavaScript, mas ausente no HTML.
- `showOnly()` agora é tolerante a elementos opcionais ausentes, evitando que a interface inteira seja ocultada por erro de JavaScript.


## Evolução v4.2 — Subadministrador

- Novo perfil `sub_admin` no Supabase.
- Administrador principal pode gerar convite para **Representante** ou **Subadministrador**.
- Subadministrador acessa o painel gerencial completo de vendas.
- Subadministrador pode consultar histórico, filtrar, exportar e corrigir lançamentos.
- Cadastro, edição, desativação de usuários e geração de novos acessos permanecem exclusivos do administrador principal.
- O mesmo formulário de cadastro por código de convite é usado para o segundo gestor.


## Evolução v4.3 — Gestão de usuários e metas por item

### Gestão de usuários
- Administrador Geral pode alterar, depois do cadastro:
  - nome;
  - cargo/função exibido;
  - perfil de acesso (Representante ou Subadministrador);
  - meta mensal em R$ para representantes;
  - status ativo/inativo.
- Subadministrador não altera perfis de acesso nem usuários.

### Metas por item
- Administrador Geral e Subadministrador podem criar metas por produto/item.
- Cada meta possui quantidade-alvo e período de vigência.
- O painel gerencial mostra quantidade realizada, percentual e quantos especialistas responderam no dia.
- Metas podem ser encerradas ou reativadas.

### Obrigatoriedade no painel do especialista
- Para cada meta por item ativa na data escolhida, o especialista é obrigado a responder:
  - **Vendi** → informar quantidade maior que zero;
  - **Não vendi** → quantidade registrada como zero.
- A venda diária em R$ só é salva depois que todos os itens ativos forem respondidos.
- As respostas podem ser corrigidas fazendo novo lançamento na mesma data.


## Evolução v4.4 — Permissões e reset

### Administrador Geral
- Pode resetar o painel operacional com confirmação dupla.
- O reset apaga:
  - vendas diárias;
  - metas por item;
  - respostas das metas por item;
  - convites;
  - metas mensais em R$ dos usuários.
- O reset preserva:
  - usuários;
  - logins;
  - perfil de acesso;
  - cargo/função;
  - status do Administrador Geral.
- Continua podendo alterar nome, cargo, perfil de acesso, meta mensal e status.

### Subadministrador
- Pode definir a **meta mensal de vendas em R$** dos cadastrados.
- Pode definir ou alterar o **cargo/função** dos cadastrados.
- Pode criar e acompanhar **metas por item**.
- Não pode promover/rebaixar perfil de acesso, ativar/desativar usuários ou resetar o painel.

### Demais cargos
- Cargo/função é apenas identificação profissional.
- Quem não é Administrador Geral ou Subadministrador permanece com perfil comum e acessa somente:
  - suas próprias vendas;
  - sua própria meta mensal;
  - seus próprios itens de meta;
  - seu próprio histórico.


## Evolução v4.5 — Vendas por distribuidora

### Especialista
- O lançamento diário agora é detalhado por distribuidora.
- Pode adicionar uma ou várias distribuidoras no mesmo dia.
- Informa o valor vendido em cada distribuidora.
- O **total vendido do dia é calculado automaticamente** pela soma das distribuidoras.
- Não é permitido repetir a mesma distribuidora no mesmo lançamento.
- Um dia sem vendas continua podendo ser informado com total R$ 0,00.

### Administrador Geral e Subadministrador
- Podem cadastrar e ativar/desativar distribuidoras.
- Novo painel **Vendas por distribuidora** com:
  - total de hoje;
  - total do mês;
  - participação percentual no total do mês.
- O histórico gerencial passa a mostrar a divisão da venda entre as distribuidoras.

### Dados
- Criadas as tabelas `distributors` e `daily_sales_distributors`.
- O total diário continua gravado em `daily_sales` para preservar os dashboards existentes.
- O salvamento da venda e da divisão por distribuidora é feito por RPC transacional no Supabase.
- O reset do painel limpa também os lançamentos por distribuidora, preservando o cadastro das distribuidoras.


## Evolução v4.6 — Representante por distribuidora

- Novo quadro gerencial **Vendas por representante e distribuidora**.
- Para cada representante, o gestor visualiza:
  - distribuidora;
  - valor vendido hoje;
  - valor vendido no mês;
  - participação daquela distribuidora nas vendas do representante.
- Na tabela principal da equipe, cada representante passa a exibir um resumo de quanto vendeu em cada distribuidora.
- O histórico de lançamentos mantém o detalhamento por distribuidora.
- Exportação Excel e relatório PDF incluem a coluna **Distribuidoras**.


## Evolução v4.7 — Pedidos detalhados por cliente/CNPJ

### Painel do especialista
- Novo acompanhamento de pedidos com CNPJ, Razão Social, Valor do Pedido, Número do Pedido, Distribuidora e Data.
- Clientes ficam salvos por especialista para autopreenchimento em pedidos futuros.
- Autopreenchimento funciona por CNPJ ou Razão Social.
- Histórico dos últimos pedidos do mês.
- Ranking próprio por CNPJ, somando todos os pedidos de cada cliente.

### Painel gerencial
- Ranking consolidado por CNPJ no mês selecionado.
- Mostra quantidade de pedidos, quantidade de representantes que venderam ao cliente e total vendido.
- Administrador Geral e Subadministrador podem visualizar o consolidado da equipe.

### Segurança
- Especialistas veem apenas seus próprios clientes e pedidos.
- Gestores podem visualizar todos os clientes e pedidos.
- O reset operacional apaga os pedidos detalhados, mas preserva a carteira de clientes para manter o autopreenchimento.
