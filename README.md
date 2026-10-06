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


## Evolução v4.8 — Automação dos pedidos e metas individuais

### Pedidos como fonte das vendas
- O representante não precisa mais lançar o total diário manualmente.
- Cada pedido salvo entra automaticamente na soma do dia.
- O Supabase recalcula automaticamente:
  - total diário do representante;
  - total mensal;
  - total por distribuidora;
  - painel gerencial.
- Alterações futuras em pedidos também podem ser refletidas pelo mecanismo de sincronização do banco.

### Metas por item individualizadas
- Administrador Geral e Subadministrador passam a criar a meta por item escolhendo o representante.
- Cada meta possui:
  - representante;
  - item;
  - quantidade-alvo;
  - período.
- O gerencial mostra meta, realizado, percentual e se o representante informou o item no dia.
- O representante vê claramente a sua meta de cada item e o progresso acumulado.

### Painel do representante
- Novo resumo de vendas por distribuidora com valores de hoje e do mês.
- Ranking por CNPJ foi movido para o final do painel para melhorar a organização visual.
- O lançamento manual do total do dia foi removido; o resumo passa a ser automático pelos pedidos.


## Correção v4.9.1

- Restaurado o formulário completo de criação de meta por item na parte superior do painel ADM.
- Campos restaurados:
  - representante;
  - item/produto;
  - meta de quantidade;
  - data inicial;
  - data final;
  - botão Criar meta por item.
- Mantidos os KPIs das metas por item no topo.
- Mantida a seção Metas ativas e acompanhamento abaixo do Histórico e Correção.
- Mantidas as opções de editar, desativar e apagar distribuidoras conforme permissão.


## Evolução v5.0 — Contagem por item e exportação do representante

### Painel gerencial
- Nova tabela **Desempenho das metas por item**.
- Produtos iguais são agrupados e contados separadamente dos demais itens.
- Exemplo: B12 ORODISPERSÍVEL, COENZIMA Q10 200MG, BILIPLEX ABACAXI e BILIPLEX BOLDO aparecem em linhas independentes.
- Para cada produto o painel mostra:
  - número de representantes com meta;
  - meta total em unidades;
  - quantidade vendida;
  - quanto falta;
  - percentual atingido.
- A tabela é ordenada pelo percentual atingido, facilitando identificar os itens que estão alcançando a meta mais rápido.

### Painel do representante
- Nova tabela **Contagem das minhas metas por item**, com Meta, Realizado, Falta e % atingido.
- A contagem fica separada para cada produto.
- Adicionados botões **Exportar CSV** e **Exportar PDF** na área de pedidos.
- Os arquivos exportados incluem Data, CNPJ, Razão Social, Distribuidora, Número do Pedido, Valor e total geral.


## Evolução v5.1 — Convites corrigidos + cidade/estado dos clientes

- Corrigida a política RLS de `representative_invites`.
- Administrador Geral pode criar convites de Representante e Subadministrador.
- Subadministrador pode criar apenas convites de Representante.
- Incluídos Cidade e Estado no acompanhamento de pedidos.
- Cidade e Estado ficam salvos no cadastro do cliente e são autopreenchidos nos próximos pedidos.
- Cidade e Estado aparecem na listagem dos pedidos e nas exportações CSV/PDF.


## Evolução v5.2 — Guia lateral Base Clientes

### Nova guia lateral do representante
- Criada uma navegação lateral separando:
  - **Acompanhamento de vendas**
  - **Base Clientes**
- A Base Clientes fica fora do fluxo de vendas e pedidos.

### Cadastro da Base Clientes
Campos:
- CNPJ
- Razão Social
- Definição: Independente ou Rede
- Comprador
- Telefone
- Nome da Rede

Quando a definição for **Rede**:
- o representante informa se a unidade é **Matriz** ou **Filial**;
- se for Filial, deve selecionar qual Matriz está vinculada.

### Contadores
No topo da Base Clientes:
- **Cadastros válidos** = Independentes + Matrizes
- **Contador geral** = Independentes + Matrizes + Filiais
- também são exibidos contadores separados de Matrizes e Filiais.

### Gestão
- O representante pode editar ou excluir clientes da própria base.
- Cada representante acessa somente a própria Base Clientes.
- Administradores podem consultar os registros via políticas gerenciais do Supabase.


## Evolução v5.3 — Gerentes Regionais + reset administrativo de senha

### Gerente Regional
- Novo perfil de acesso **Gerente Regional**.
- Cada representante pode receber um Estado (ex.: PB, CE, PE).
- Cada Gerente Regional pode receber um ou vários estados (ex.: PB, PE, RN).
- O Gerente Regional acessa o painel gerencial, porém visualiza somente representantes e números pertencentes aos estados atribuídos a ele.
- O filtro de região é aplicado também no Supabase/RLS, não apenas visualmente no navegador.
- Acesso regional é somente para consulta: sem alteração de metas, correções, distribuidoras, usuários ou reset geral.
- O Administrador Geral continua com visão nacional/completa.

### Senha temporária e troca obrigatória
- Na Gestão de Equipe, o Administrador Geral ganhou o botão **Resetar senha**.
- O reset define a senha temporária: `redefinirsenha`.
- O usuário fica marcado com **Troca de senha pendente**.
- No próximo login, Representante, Sub ADM ou Gerente Regional é direcionado para uma tela obrigatória de criação de nova senha.
- O painel só é liberado depois que uma senha diferente da temporária for salva.
- A operação administrativa é feita por uma Supabase Edge Function protegida e validada como Administrador Geral.


## Evolução v5.4 — Base Clientes com Cidade/Estado, exportação e validação CNPJ × Razão

### Base Clientes
- Incluídos **Cidade** e **Estado** no cadastro, edição e listagem.
- Cidade e Estado passam a ser gravados no Supabase.
- Adicionados botões **Exportar CSV** e **Exportar PDF** para toda a Base Clientes.
- Exportações incluem CNPJ, Razão Social, Cidade, Estado, Definição, Unidade, Matriz, Comprador, Telefone e Rede.

### Validação de pedidos
- Ao lançar pedido, o sistema consulta a **Base Clientes**.
- Se o CNPJ estiver cadastrado com outra Razão Social, o pedido é bloqueado e o representante recebe a orientação para corrigir.
- Se a Razão Social estiver cadastrada com outro CNPJ, o pedido também é bloqueado.
- Quando o cadastro é válido, o sistema usa a Razão Social, Cidade e Estado oficiais da Base Clientes.
- Pedidos antigos do mês com divergência geram um alerta visível no Acompanhamento de Pedidos.
- A guia Base Clientes também mostra uma área de conflitos existentes comparando a base com cadastros/pedidos anteriores.

### Visualização
- A largura útil do site foi ampliada de 1180 px para **1540 px** em telas grandes.
- Tabelas e cartões receberam mais espaço para facilitar a leitura de dados extensos.


## Evolução v5.5 — Gerente Regional com permissões de Sub ADM + Gerente Divisional

### Gerente Regional
- Continua identificado no painel como **Gerente Regional**.
- Passa a ter as mesmas permissões operacionais do Sub ADM:
  - definir cargo/função;
  - alterar meta mensal;
  - criar e acompanhar metas por item;
  - cadastrar/editar/ativar distribuidoras;
  - corrigir lançamentos;
  - gerar convites de representantes.
- Essas permissões ficam limitadas aos especialistas dos estados atribuídos ao Gerente Regional.
- O controle de acesso foi reforçado também nas políticas RLS do Supabase.

### Gerente Divisional
- Novo perfil de acesso: **Gerente Divisional**.
- Enxerga os dados gerais de todas as regiões e todos os especialistas.
- Não possui permissão de edição.
- Novo quadro **Visão por Gerente Regional** mostra:
  - gerente;
  - estados;
  - número de especialistas;
  - vendas do mês;
  - meta da região;
  - percentual da meta.
- A tabela geral da equipe continua exibindo todos os especialistas individualmente.

### Exportações
- Tabelas do painel passam a receber automaticamente opções de:
  - **Exportar CSV**
  - **Exportar PDF**
- O mecanismo respeita os dados que o perfil tem permissão para visualizar.


## Evolução v5.6 — Painel exclusivo do Gerente Divisional

As alterações abaixo são aplicadas somente quando o usuário logado possui o perfil **Gerente Divisional**.

### Mantido / incluído no painel Divisional
- Resultado geral das vendas por Estado.
- Resultado individual de cada Especialista.
- Resultado geral por Gerente Regional.
- Gráfico de evolução acumulada de cada Estado.
- Gráfico de evolução acumulada de cada Gerente Regional.
- Resumo simples do total vendido por Distribuidora.
- Quadro de metas por item por Estado/Região.
- Gráfico percentual das metas por item por Estado.
- Exportação PDF e CSV nas tabelas, aproveitando o mecanismo geral de exportação da v5.5.
- Perfil continua somente leitura, sem permissões de edição.

### Removido somente da visão Divisional
- Ranking por CNPJ.
- Convites.
- Ranking do mês.
- Vendas por representante e distribuidora.
- Metas ativas e acompanhamento.
- Histórico e correção de lançamentos.
- Formulários de criação/edição e gestão de usuários/distribuidoras.

Os outros perfis (Administrador Geral, Sub ADM e Gerente Regional) mantêm o painel e os recursos já existentes.
