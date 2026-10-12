// Testa as funções puras da área de pedidos (js/conta.js).
// Rodar: node testes/conta.test.js
const assert = require('assert');
const { ETAPAS, digitosNacionais, celularValido, formatarCelular, indiceEtapa, lerToken, formatarData } = require('../js/conta.js');

assert.deepStrictEqual(ETAPAS, ['Recebido', 'Em produção', 'Acertos finais', 'Concluído']);
assert.strictEqual(indiceEtapa('Recebido'), 0);
assert.strictEqual(indiceEtapa('Concluído'), 3);
assert.strictEqual(indiceEtapa('Finalizado'), -1);

// celular: com e sem máscara, com +55, fixo de 10 dígitos
assert.strictEqual(digitosNacionais('+55 (31) 98731-0965'), '31987310965');
assert.strictEqual(digitosNacionais('(55) 98731-0965'), '55987310965', 'DDD 55 (RS) não é confundido com o código do país');
for (const ok of ['31987310965', '(31) 98731-0965', '+55 31 98731-0965', '(31) 3333-4444', '(55) 99999-0000'])
  assert.strictEqual(celularValido(ok), true, ok);
for (const ruim of ['', '98731-0965', '(01) 98731-0965', '(10) 98731-0965', '(31) 18731-0965', '(31) 98731-09651', '(31) 1333-4444', 'abc'])
  assert.strictEqual(celularValido(ruim), false, ruim);

// máscara progressiva (vai sendo aplicada enquanto a pessoa digita)
const mascara = [
  ['', ''], ['3', '(3'], ['31', '(31'], ['319', '(31) 9'], ['3198731', '(31) 9873-1'],
  ['3133334444', '(31) 3333-4444'], ['31987310965', '(31) 98731-0965'],
  ['319873109651234', '(31) 98731-0965'], ['+55 31 98731-0965', '(31) 98731-0965'],
];
for (const [entrada, esperado] of mascara) assert.strictEqual(formatarCelular(entrada), esperado, entrada);

// token do Google: lê o meio do JWT (base64url, com acento)
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = b64({ alg: 'RS256' }) + '.' + b64({ email: 'ze@teste.com', name: 'Zé Ávila', picture: 'https://x/y.png', exp: 2000000000 }) + '.assinatura';
assert.deepStrictEqual(lerToken(jwt), { email: 'ze@teste.com', nome: 'Zé Ávila', foto: 'https://x/y.png', exp: 2000000000 });
assert.strictEqual(lerToken('lixo'), null);
assert.strictEqual(lerToken(''), null);
assert.strictEqual(lerToken(b64({}) + '.' + b64({ name: 'sem e-mail' }) + '.x'), null);

assert.match(formatarData('2026-10-12T17:32:00.000Z'), /^\d{2}\/\d{2}, \d{2}:\d{2}$/);
assert.strictEqual(formatarData(''), '');
assert.strictEqual(formatarData('ontem'), '');

console.log('TODOS OS TESTES PASSARAM');
