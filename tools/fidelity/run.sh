#!/usr/bin/env bash
# Differential test: original MIDlet bytecode (JVM + API stubs) vs. this port, frame by frame.
# Usage: JAR_DIR=/path/to/extracted/stackattack2.jar ECJ=/path/to/ecj.jar ./run.sh [runs]
# JAR_DIR is the folder where YOUR stackattack2.jar was unzipped (classes + StackAttack2/ resources).
set -e
cd "$(dirname "$0")"
ROOT="$(cd ../.. && (pwd -W 2>/dev/null || pwd))"
JAVA="${JAVA:-java}"
: "${JAR_DIR:?set JAR_DIR to the unzipped stackattack2.jar}"
: "${ECJ:?set ECJ to ecj.jar (org.eclipse.jdt:ecj) or use JAVAC}"
SEP=":"; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) SEP=";"; export MSYS2_ARG_CONV_EXCL="*";; esac
RUNS="${1:-24}"
mkdir -p build runs
python3 mkstubs.py build/stubs >/dev/null
"$JAVA" -jar "$ECJ" -source 1.8 -target 1.8 -nowarn -d build/classes -cp "$JAR_DIR" $(find build/stubs -name '*.java') Harness.java
pass=0; fail=0
for i in $(seq 1 "$RUNS"); do
  seed=$((i * 7919 + 17)); lvl=$((i % 3)); ch=$((i % 6)); unl=$(( (i / 6) % 6 )); [ $unl -lt $ch ] && unl=$ch
  node genscript.mjs $i 6000 runs/keys.txt $((i % 4 == 0 ? 1 : 0))
  "$JAVA" -cp "build/classes${SEP}$JAR_DIR" Harness "$JAR_DIR" $seed $lvl $ch $unl 6000 runs/keys.txt runs/java.txt
  node jsharness.mjs "$ROOT" $seed $lvl $ch $unl 6000 runs/keys.txt runs/js.txt 2>/dev/null
  tr -d '\r' < runs/java.txt > runs/java.lf
  if cmp -s runs/java.lf runs/js.txt; then pass=$((pass+1)); echo "OK   seed=$seed level=$lvl char=$ch frames=$(wc -l < runs/js.txt)"
  else fail=$((fail+1)); echo "DIFF seed=$seed level=$lvl char=$ch"; diff runs/java.lf runs/js.txt | head -2 | cut -c1-240; fi
done
echo "identical: $pass / $((pass+fail))"
