# Teste de fidelidade

Estes scripts comparam, quadro a quadro, a lógica deste port com o **bytecode original**
do MIDlet rodando numa JVM comum (as APIs MIDP / Siemens são substituídas por stubs mínimos).

- `mkstubs.py` gera os stubs de `javax.microedition.*` e `com.siemens.mp.*`.
- `Harness.java` instancia a classe de jogo original (`e`) e executa o corpo do loop de `run()` sem os
  `sleep`, despejando todo o estado (personagem, guindastes, as 84 caixas, pontuação…) a cada quadro.
- `jsharness.mjs` faz o mesmo com `js/game.js`, usando o mesmo `java.util.Random` (reimplementado bit a bit).
- `genscript.mjs` gera uma sequência determinística de teclas usada pelos dois lados.
- `run.sh` compila, roda N partidas (níveis e personagens variados) e compara as saídas.
- `fuzz.mjs` roda centenas de partidas aleatórias procurando exceções / estados impossíveis.
- `savestate.mjs` confere que salvar → restaurar um estado reproduz a partida exatamente.

O `.jar` original **não** faz parte do repositório: descompacte o seu e aponte `JAR_DIR` para a pasta.

```bash
JAR_DIR=~/stackattack2 ECJ=~/ecj-3.33.0.jar ./run.sh 36
```

Resultado na versão 1.0.0: 36/36 partidas idênticas (~130 mil quadros).
