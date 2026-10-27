# MyGoals — hábitos, tarefas, agenda e diário com gamificação

Aplicativo Android (WebView + interface HTML/CSS/JS) 100% offline. Os dados ficam só no aparelho.

## Estrutura
```
app/src/main/java/.../MainActivity.java   WebView restrito, ponte mínima, seletor de arquivos, Voltar
app/src/main/assets/www/
  index.html                               casca da interface
  css/ base.css · components.css · pages.css
  js/  util · dates · schema · storage · habits · tasks · gamification · calendar · backup · actions   (regras, sem DOM)
       icons · views · sheets · app                                                                    (interface)
tests/            testes automatizados (node:test + jsdom)
scripts/          verificações estáticas
docs/             GAMIFICACAO.md · RELATORIO.md
.github/workflows/build-apk.yml            testes → build → APK
```

## Como subir para o GitHub e gerar o APK
**Pelo site (mais simples)**
1. Em github.com, clique em **New repository**, dê um nome (ex.: `MyGoals`) e crie (pode ser privado).
2. Na página do repositório vazio, clique em **uploading an existing file**.
3. Descompacte este projeto no computador e arraste **o conteúdo da pasta** (incluindo a pasta oculta `.github`) para a página. Se a pasta oculta não aparecer, use o Git pelo terminal (abaixo).
4. Clique em **Commit changes**.

**Pelo terminal**
```bash
cd MyGoals-Android-GitHub
git init && git add -A && git commit -m "MyGoals v3"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/MyGoals.git
git push -u origin main
```
**Gerar o APK:** aba **Actions → Build MyGoals APK → Run workflow** (também roda a cada push).
Ao terminar (verde), abra a execução e baixe o APK em **Artifacts** (`MyGoals-v3.0.0-buildN-…-debug`).
Se o job *Testes e verificações* ficar vermelho, o APK não é compilado: abra o log, o erro aparece com o nome do arquivo.

Instalar: copie o APK para o celular e permita "instalar apps desconhecidos". **Para manter seus dados antigos, instale por cima do app já instalado** (mesmo pacote `com.abner.mygoals`); desinstalar apaga os dados.

## Desenvolvimento
```bash
npm install        # só para os testes (jsdom)
npm test           # 57 testes
npm run check      # verificações estáticas
python3 scripts/check_manifest.py
```
Para ver a interface no computador, abra `app/src/main/assets/www/index.html` no navegador.

## Armazenamento e limitações
- Dados no `localStorage` do WebView (alguns MB). A foto de perfil é reduzida para ≤ 400 KB.
- Sem sincronização entre aparelhos: use **Ajustes › Backup**.
- A URL do app (`file:///android_asset/www/index.html`) não deve mudar, ou o WebView trataria como outro site e os dados "sumiriam".
- Detalhes das regras de XP: `docs/GAMIFICACAO.md`.
