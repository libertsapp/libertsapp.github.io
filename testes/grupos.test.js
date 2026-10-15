// Testa as funções puras da seção "Grupos em quadra" e do caminho do vôlei (js/site.js).
// Rodar: node testes/grupos.test.js
const assert = require('assert');
const s = require('../js/site.js');

assert.strictEqual(s.URL_CRIAR_VOLEI, 'https://volei.memberstars.com/criar');
assert.strictEqual(s.URL_VITRINE, 'https://lzwmirrjpoqucwlhgkku.supabase.co/functions/v1/grupos-api?lista=grupos');

assert.strictEqual(s.fraseGrupos(12, 8), '12 grupos cadastrados, 8 jogaram no último mês');
assert.strictEqual(s.fraseGrupos(1, 1), '1 grupo cadastrado, 1 jogou no último mês');
assert.strictEqual(s.fraseGrupos(5, 0), '5 grupos cadastrados, nenhum jogou no último mês');
assert.deepStrictEqual(s.partesFraseGrupos(12, 8), [12, ' grupos cadastrados, ', 8, ' jogaram no último mês']);

assert.strictEqual(s.textoVolei(12), 'Nasceu numa quadra de terça à noite e hoje organiza 12 grupos de vôlei. Check-in, sorteio, ranking, caixa e o placar de cada rodada.');
assert.strictEqual(s.textoVolei(1), 'Nasceu numa quadra de terça à noite e hoje organiza 1 grupo de vôlei. Check-in, sorteio, ranking, caixa e o placar de cada rodada.');
assert.strictEqual(s.textoVolei(0), 'Nasceu numa quadra de terça à noite e hoje organiza grupos de vôlei toda semana. Check-in, sorteio, ranking, caixa e o placar de cada rodada.');

const iniciais = [['Vôlei de Terça', 'VT'], ['Vôlei Meme Brasil', 'VB'], ['Ácido', 'AC'], ['Os Craques da Rua', 'OR'], ['🏐', 'MS'], ['', 'MS'], [undefined, 'MS'], ['x', 'X']];
for (const [nome, esperado] of iniciais) assert.strictEqual(s.iniciaisDoGrupo(nome), esperado, String(nome));

assert.strictEqual(s.corSegura('#FFD700'), '#ffd700');
for (const ruim of ['red', '#fff', 'url(x)', '', null, '#12345g']) assert.strictEqual(s.corSegura(ruim), '#4d7cff', String(ruim));
assert.strictEqual(s.corDoTexto('#ffd700'), '#1a1405', 'cor clara: iniciais escuras');
assert.strictEqual(s.corDoTexto('#123456'), '#ffffff', 'cor escura: iniciais brancas');
assert.strictEqual(s.corDoTexto('lixo'), s.corDoTexto('#4d7cff'), 'cor inválida usa o azul padrão');

// iniciais sempre legíveis (contraste WCAG >= 4.5:1) em todas as cores que o app de vôlei oferece
// (cópia de PALETA em volei/backend/grupos-cadastro.js) e na cor padrão
const luminancia = (hex) => {
  const c = (i) => { const v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * c(1) + 0.7152 * c(3) + 0.0722 * c(5);
};
const contraste = (a, b) => { const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const cor of ['#ffd700', '#00f3ff', '#39ff9e', '#ff4d6d', '#b388ff', '#ff9f1c', '#4dabf7', '#f06595', '#4d7cff']) {
  const c = contraste(cor, s.corDoTexto(cor));
  assert.ok(c >= 4.5, cor + ': contraste ' + c.toFixed(2));
}

const bom = 'https://lzwmirrjpoqucwlhgkku.supabase.co/storage/v1/object/public/fotos-grupos/x/logo.png';
assert.strictEqual(s.logoSeguro(bom), bom);
for (const ruim of ['javascript:alert(1)', 'https://evil.com/storage/x.png', 'http://lzwmirrjpoqucwlhgkku.supabase.co/storage/x', '', null])
  assert.strictEqual(s.logoSeguro(ruim), '', String(ruim));

console.log('TODOS OS TESTES PASSARAM');
