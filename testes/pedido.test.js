// Testa o endereço gerado a partir do nome do grupo e a mensagem do WhatsApp (js/site.js).
// Rodar: node testes/pedido.test.js
const assert = require('assert');
const { enderecoDoGrupo, linkWhatsApp } = require('../js/site.js');

const casos = [
  ['Vôlei de Terça', 'volei-de-terca'],
  ['  Futebol   de Quinta!! ', 'futebol-de-quinta'],
  ['Pelada do Zé & Cia', 'pelada-do-ze-cia'],
  ['Beach Tennis BH 2026', 'beach-tennis-bh-2026'],
  ['ÁÉÍÓÚ ÇÃÕ', 'aeiou-cao'],
  ['---', ''],
  ['', ''],
  ['🏐🔥', ''],
  ['Os Craques da Rua Sete de Setembro do Bairro Funcionários', 'os-craques-da-rua-sete-de-setembro-do-ba'],
];
for (const [nome, esperado] of casos) {
  const s = enderecoDoGrupo(nome);
  assert.strictEqual(s, esperado, `${JSON.stringify(nome)} -> ${s}`);
  assert.ok(s.length <= 40 && !/^-|-$/.test(s), 'sem hífen sobrando nas pontas e no máximo 40 letras');
}
// corte em 40 que cairia num hífen não deixa hífen no fim
assert.ok(!/-$/.test(enderecoDoGrupo('a'.repeat(39) + ' bcd')));

const link = linkWhatsApp('Vôlei de Terça', 'Vôlei');
assert.ok(link.startsWith('https://wa.me/5531987310965?text='), link);
const texto = decodeURIComponent(link.split('?text=')[1]);
assert.ok(texto.includes('*Grupo:* Vôlei de Terça'));
assert.ok(texto.includes('*Esporte:* Vôlei'));
assert.ok(texto.includes('memberstars.com/volei-de-terca'));
console.log(texto);
console.log('TODOS OS TESTES PASSARAM');
