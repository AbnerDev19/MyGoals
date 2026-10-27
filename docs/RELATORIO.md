# Relatório final — evolução do MyGoals (v2 → v3)

> Resultados abaixo são os **realmente obtidos** no ambiente de desenvolvimento. O APK **não** foi compilado aqui (ver seção 7).

## 1. Resumo
Estabilização do build Android, correção das regras de negócio (inclusive o bug que apagava a semana inteira),
nova gamificação auditável (livro-razão idempotente), armazenamento versionado com migração não destrutiva,
backup validado em duas fases, redesign completo, refatoração do HTML único em 14 módulos, testes e CI.

## 2. Arquivos
**Modificados:** `AndroidManifest.xml`, `app/build.gradle`, `MainActivity.java`, `index.html` (reescrito, modular),
`manifest.webmanifest`, `sw.js`, `.github/workflows/build-apk.yml`, `.gitignore`, `README.md`.
**Criados:** `www/css/{base,components,pages}.css`; `www/js/{util,dates,schema,storage,habits,tasks,gamification,calendar,backup,actions,icons,views,sheets,app}.js`;
`res/values-night/styles.xml`; `tests/*` (6 arquivos); `scripts/{static-check.js,check_manifest.py}`; `package.json` (+lock, só para testes); `docs/*`.
**Preservados:** ícones, `settings.gradle`, `build.gradle` raiz, `gradle.properties`, `proguard-rules.pro`.
O `index.html` original (v2) não foi mantido no pacote; todos os dados e funções dele foram migrados.

## 3. Problemas corrigidos
| Gravidade | Problema | Correção |
|---|---|---|
| Crítico | Manifest com `usesCleartextTraffic` duplicado (build quebrava; reproduzido) | Removida a duplicata; `false`; verificador no CI |
| Crítico | Desmarcar meta semanal apagava os 7 dias | Remove só o registro do dia (teste de regressão) |
| Alto | XP não revertia ao desfazer; farm infinito com notas/tarefas | Livro-razão com estornos, limites diários |
| Alto | Importar backup substituía dados sem validar | Validação em 2 fases + cópia de segurança + confirmação |
| Alto | "Carregar exemplo" apagava dados sem confirmar | Confirmação + cópia + restaurar |
| Alto | Falha de gravação silenciosa | Aviso persistente com "tentar de novo" e exportar |
| Médio | Semana começava em dias diferentes (Hoje × Agenda) | Domingo em todo o app |
| Médio | Dia não virava com o app aberto; retroativo contava como hoje | `hoje` dinâmico; datas por atividade |
| Médio | Tarefas fora de 6h–22h invisíveis na grade | Grade expande ao necessário |
| Médio | Tema não persistia; cor/foto importadas sem validação (XSS) | Persistido; validação por regex |
| Médio | WebView sem restrições; `FileChooser` só imagens; Voltar fechava o app | Restrito a assets, sem rede; seletor genérico; Voltar fecha camadas → Hoje → sai |
| Baixo | Sem `adjustResize`/ciclo de vida/barras do sistema no escuro | Implementados |

## 4. Melhorias visuais
Design tokens e tema claro/escuro; ícones SVG (sem emoji funcional); Hoje reorganizada (saudação, progresso, próxima ação,
tarefas/hábitos/metas, concluídos recolhidos, estado "tudo em dia"); hábitos (anel + faixa colorida) × tarefas (caixa quadrada,
prioridade e atraso em texto); edição de hábitos e tarefas; agenda com visão diária em lista e grade semanal; Jornada com
nível, missões por estado (inclui expiradas), conquistas com critério, histórico de XP e mapa de evolução; diário com busca e etiquetas;
ajustes com backup, regras de XP e privacidade; confirmações para ações destrutivas; estados vazios.

## 5. Gamificação
Ver `docs/GAMIFICACAO.md`. Valores de XP **mantidos**; adicionados: estorno com rastro, retroativo a 50%, limites diários,
bônus de retomada, melhor sequência persistente, expiração de missões, sequência derivada dos dados.

## 6. Testes executados (resultado real)
- `npm test`: **57 testes, 57 aprovados, 0 falhas** (datas, hábitos, XP/níveis, tarefas, missões, sequências, duplicação,
  backup inválido/válido, migração v2→v3, armazenamento cheio/corrompido, e 14 testes de interface em jsdom).
- `node scripts/static-check.js`: OK. `python3 scripts/check_manifest.py`: OK (e detecta o erro original, testado por mutação).
- `javac --release 17` de `MainActivity.java` contra `android.jar` (API 33): **0 erros** (apenas avisos de APIs depreciadas).

## 7. Situação da compilação do APK
**Não executada neste ambiente**: o Gradle precisa baixar o Android Gradle Plugin e o SDK de servidores do Google, inacessíveis aqui.
O workflow foi validado só quanto à sintaxe YAML. A primeira execução real será no seu GitHub Actions; se falhar, o log indicará o passo.

## 8. Pendências / não verificado
- Build Gradle, `lintDebug` e instalação do APK.
- Aparência real: a interface foi testada por estrutura (jsdom), **não foi vista em tela**; layout, contraste (valores escolhidos, não medidos),
  toque, teclado virtual, TalkBack, exportação para arquivo e seletor de arquivos precisam de teste manual em aparelho.
- Sem testes instrumentados Android (Espresso).
- Valores de XP não foram "balanceados" com dados de uso real, só estimados.

## 9. Como testar no aparelho
1. Instale **por cima** da versão antiga: o aviso de "dados atualizados para a versão 3" deve aparecer e hábitos/XP continuam iguais.
2. Hoje: crie hábito e tarefa, conclua, desfaça; veja o aviso de XP e o estorno em Jornada › Histórico.
3. Meta semanal: marque, desmarque e confirme que só o dia clicado muda.
4. Agenda: alterne Dia/Semana; crie tarefa às 05:30 e veja na grade.
5. Ajustes: exporte para arquivo; importe um texto inválido (deve recusar); importe o válido; use "Restaurar cópia anterior".
6. Gire a tela, ative o modo escuro, abra o teclado em formulários, use o botão Voltar.

## 10. Próximos passos
Rodar o workflow e instalar; checar contraste e TalkBack; considerar APK assinado (release); testes Espresso; ajustar XP com uso real.
