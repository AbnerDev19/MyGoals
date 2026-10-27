# Regras de gamificação do MyGoals (versão 3)

Todas as regras vivem em `app/src/main/assets/www/js/gamification.js` (única fonte de verdade) e
são cobertas por testes em `tests/gamification.test.js`.

## Como era na versão 2 (diagnóstico)

| Aspecto | Comportamento antigo | Problema |
|---|---|---|
| XP | `baseXp` + soma de `awards`; chaves em `claimedKeys` | Desfazer uma ação **não** devolvia o XP e a chave nunca era liberada |
| Notas | +5 XP por nota criada, sem limite | Criar/apagar notas em loop gerava XP infinito |
| Tarefas | +15 XP; sem limite | Criar e concluir tarefas em loop gerava XP infinito |
| Dia ativo | Gravado no momento do prêmio, sempre com a data de **hoje** | Registro retroativo contava como atividade de hoje |
| Sequência | Só dias com prêmio recebido depois da atualização | Histórico anterior não contava |
| Meta semanal | Desmarcar apagava **os 7 dias** da semana | Perda de dados do usuário |
| Semana | Metas e agenda começavam no domingo, a faixa da tela Hoje na segunda | Semana inconsistente |
| "Hoje" | Calculado uma vez ao abrir o app | App aberto na virada do dia ficava com a data velha |
| Tema | Não era salvo | Voltava a "automático" a cada abertura |

## Regras atuais

**XP total = soma do livro-razão** (`game.ledger`). Nenhum valor é recalculado "por fora".

| Evento | XP |
|---|---|
| Hábito diário concluído (dia) | +10 |
| Meta semanal concluída (semana) | +50 |
| Tarefa concluída | +15 |
| Nova nota | +5 |
| Primeira atividade **de hoje** | +5 (uma vez por dia) |
| Retomada (primeira atividade após 3+ dias sem nada) | +10 (uma vez por dia) |
| Missões diárias | 25 / 20 / 15 |
| Missões semanais | 80 / 60 / 45 |
| Conquistas | 10 a 300 (cada uma, uma vez) |

Nível = ⌊√(XP ÷ 50)⌋ + 1 (nível 2 com 50 XP, 3 com 200, 5 com 800, 10 com 4.050).

### Idempotência
Cada recompensa tem uma **chave estável** (`task:<id>`, `goalday:<id>:<data>`, `goalweek:<id>:<domingo>`,
`mission:<id>`, `achievement:<id>`, `daily-bonus:<data>`, `comeback:<data>`). Enquanto a chave está
"ativa" não rende XP de novo. Cada lançamento tem `id` único.

### Desfazer (reversão com rastro)
Desfazer uma conclusão **não apaga** o lançamento original: grava um lançamento negativo
(`kind: "reversal"`, `ref` = id do original) e libera a chave. Refazer gera nova recompensa.
Marcar → desmarcar → marcar rende o XP uma única vez (líquido).

- **Excluir tarefa concluída** ou **nota**: estorna o XP delas (evita farmar criando e apagando).
- **Excluir hábito**: remove os registros, mas o XP já ganho **permanece** no histórico (o esforço foi real).
- **Não são estornados**: bônus diário/retomada, missões já resgatadas, conquistas já desbloqueadas
  (são marcos históricos, concedidos uma vez por ID/período).

### Atividade retroativa
Registrar um dia anterior rende **metade** do XP (mínimo 1), marcado como "Retroativo", sem bônus diário.
Datas futuras são recusadas. A atividade conta no dia a que se refere, não no dia em que foi digitada.

### Metas semanais
Marcar completa a semana somando o que falta **no dia escolhido**. Desmarcar remove **apenas o registro desse dia**.
Se os outros dias já bastarem, a meta continua concluída e o app avisa.

### Sequências
- **Dia ativo** = qualquer registro de hábito, tarefa concluída ou nota naquele dia (derivado dos dados reais).
- **Sequência atual** = dias ativos consecutivos terminando hoje; se hoje ainda não teve atividade, ontem conta.
- **Melhor sequência** é guardada e nunca diminui.
- Não há "punição" por perder um dia: o bônus de retomada incentiva voltar.

### Limites diários anti-abuso
15 recompensas de hábito, 10 de tarefa e 3 de nota por dia. O que passar do limite é concluído normalmente, só não rende XP.

### Missões
Diárias e semanais (semana de domingo a sábado) renovam sozinhas: o identificador inclui a data do período.
Missões prontas só podem ser resgatadas **dentro do período**. As do período anterior não resgatadas aparecem como **Expiradas**.

## Avaliação de equilíbrio (valores mantidos)
Um dia "completo" (4 hábitos, 1 tarefa, 1 nota, bônus, 3 missões) rende ≈ 40 + 15 + 5 + 5 + 60 = **125 XP**;
uma semana consistente soma ≈ 185 XP de missões semanais. Nível 10 (4.050 XP) em ~5 semanas de uso intenso;
nível 20 (18.050 XP) em ~5 meses. As missões respondem por mais da metade do XP de um dia ativo, o que
recompensa constância mais do que volume. Por isso **os valores originais foram mantidos**; só foram
adicionados limites diários e as regras de reversão/retroatividade.

## Migração da v2
O XP total é preservado **exatamente** (há teste). Cada recompensa antiga vira um lançamento individual
(reversível); a diferença entre o saldo antigo e a soma desses lançamentos fica em um lançamento
"Saldo inicial migrado". Conquistas, missões resgatadas e dias ativos antigos são mantidos.
Os dados antigos (`mygoals-v2`) **nunca são apagados**.
