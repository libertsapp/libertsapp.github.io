// Testa o sorteio de demonstração da landing (js/site.js) com muitas rodadas aleatórias.
// Rodar: node testes/sorteio.test.js
const assert = require('assert');
const { sortearTimes } = require('../js/site.js');

const ELENCO = [
  ['Ana', 5, 'F'], ['Bruno', 4, 'M'], ['Carla', 3, 'F'], ['Diego', 4, 'M'], ['Elisa', 4, 'F'], ['Felipe', 3, 'M'],
  ['Gabi', 5, 'F'], ['Hugo', 3, 'M'], ['Iara', 4, 'F'], ['João', 4, 'M'], ['Karen', 4, 'F'], ['Léo', 5, 'M']
].map(([nome, estrelas, sexo]) => ({ nome, estrelas, sexo }));

const amplitude = (xs) => Math.max(...xs) - Math.min(...xs);

function conferir(elenco, n, rodadas) {
  let piorEstrelas = 0;
  const resultados = new Set();
  for (let r = 0; r < rodadas; r++) {
    const times = sortearTimes(elenco, n);
    assert.strictEqual(times.length, n);
    const nomes = times.flatMap((t) => t.jogadores.map((p) => p.nome)).sort();
    assert.deepStrictEqual(nomes, elenco.map((p) => p.nome).sort(), 'cada jogador entra uma vez só');
    assert.ok(amplitude(times.map((t) => t.jogadores.length)) <= 1, 'tamanhos dos times diferem no máximo 1');
    assert.ok(amplitude(times.map((t) => t.mulheres)) <= 1, 'mulheres espalhadas (diferença máx. 1)');
    times.forEach((t) => assert.strictEqual(t.estrelas, t.jogadores.reduce((s, p) => s + p.estrelas, 0)));
    piorEstrelas = Math.max(piorEstrelas, amplitude(times.map((t) => t.estrelas)));
    resultados.add(times.map((t) => t.jogadores.map((p) => p.nome).sort().join(',')).sort().join('|'));
  }
  return { piorEstrelas, distintos: resultados.size };
}

for (const n of [2, 3, 4]) {
  const { piorEstrelas, distintos } = conferir(ELENCO, n, 500);
  console.log(`${n} times: pior diferença de estrelas ${piorEstrelas}, ${distintos} sorteios diferentes em 500`);
  assert.ok(piorEstrelas <= 3, 'diferença de estrelas pequena');
  assert.ok(distintos > 20, 'o sorteio varia de uma vez para outra');
}

// casos de borda: só homens, só mulheres, número ímpar, mais times que mulheres
const soHomens = ELENCO.map((p) => ({ ...p, sexo: 'M' }));
const soMulheres = ELENCO.map((p) => ({ ...p, sexo: 'F' }));
const impar = ELENCO.slice(0, 11);
const poucasMulheres = ELENCO.map((p, i) => ({ ...p, sexo: i < 2 ? 'F' : 'M' }));
for (const [nome, elenco] of [['só homens', soHomens], ['só mulheres', soMulheres], ['11 jogadores', impar], ['2 mulheres em 4 times', poucasMulheres]]) {
  for (const n of [2, 3, 4]) conferir(elenco, n, 200);
  console.log(`ok: ${nome}`);
}
console.log('TODOS OS TESTES PASSARAM');
