// Testa apps-script/Codigo.gs rodando no Node com uma planilha falsa (testes/apps-script-falso.js).
// Rodar: node testes/apps-script.test.js
const assert = require('assert');
const { criarScriptFalso, tokenFalso } = require('./apps-script-falso');
const site = require('../js/site.js');
const conta = require('../js/conta.js');

const karen = tokenFalso({ email: 'Karen@Teste.com', name: 'Karen Souza' });
const bruno = tokenFalso({ email: 'bruno@teste.com', name: 'Bruno' });
const adm = tokenFalso({ email: 'admin@teste.com', name: 'Adm' });
const base = { grupo: 'Futebol de Quinta', esporte: 'Futebol / society', celular: '(31) 98731-0965' };
const com = extra => Object.assign({}, base, extra);

// 1. As cópias do código do site no .gs dão o mesmo resultado
{
  const s = criarScriptFalso();
  for (const nome of ['Vôlei de Terça', '  Pelada do Zé & Cia ', 'ÁÉÍÓÚ ÇÃÕ', '🏐🔥', 'a'.repeat(39) + ' bcd', 'Os Craques da Rua Sete de Setembro do Bairro Funcionários'])
    assert.strictEqual(s.contexto.enderecoDoGrupo(nome), site.enderecoDoGrupo(nome), nome);
  for (const cel of ['31987310965', '+55 31 98731-0965', '(55) 99999-0000', '(01) 98731-0965', '(31) 1333-4444', ''])
    assert.strictEqual(s.contexto.celularValido(cel), conta.celularValido(cel), cel);
  assert.strictEqual(Array.from(s.contexto.ETAPAS).join('|'), conta.ETAPAS.join('|'));
}

// 2. Token: sem token, lixo, vencido, de outro app, e-mail não verificado. Ação desconhecida.
{
  const s = criarScriptFalso();
  const ruins = [undefined, 'lixo', tokenFalso({ email: 'x@teste.com', exp: 1000 }), tokenFalso({ email: 'x@teste.com', aud: 'outro-app' }), tokenFalso({ email: 'x@teste.com', email_verified: false })];
  for (const t of ruins) {
    const r = s.chamar('meusPedidos', t);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.codigo, 'login', JSON.stringify(r));
  }
  assert.strictEqual(s.chamar('apagarTudo', karen).ok, false);
  assert.strictEqual(s.chamar('constructor', karen).ok, false, 'nada de propriedades herdadas do objeto de ações');
  assert.strictEqual(s.chamar('toString', karen).ok, false);
}

// 3. Fluxo completo: cria, numera, limita, reserva endereço, lista, admin muda etapa
{
  const s = criarScriptFalso();
  const r1 = s.chamar('criarPedido', karen, base);
  assert.ok(r1.ok, JSON.stringify(r1));
  assert.strictEqual(r1.dados.numero, 'MS-0001');
  assert.strictEqual(r1.dados.etapa, 'Recebido');
  assert.strictEqual(r1.dados.endereco, 'futebol-de-quinta');
  assert.strictEqual(r1.dados.celular, undefined, 'cliente não recebe celular de volta');
  assert.strictEqual(r1.dados.email, undefined, 'cliente não recebe e-mail de volta');
  assert.match(r1.dados.criadoEm, /^\d{4}-\d{2}-\d{2}T/);
  assert.strictEqual(s.linhas()[0].join('|'), 'Número|Criado em|E-mail|Nome Google|Celular|Grupo|Endereço|Esporte|Etapa|Atualizado em|Recado');
  const l1 = s.linhas()[1];
  assert.strictEqual(l1[0], 'MS-0001');
  assert.strictEqual(l1[2], 'karen@teste.com', 'e-mail em minúsculas');
  assert.strictEqual(l1[3], 'Karen Souza');
  assert.strictEqual(l1[4], '5531987310965');
  assert.strictEqual(l1[8], 'Recebido');

  const r2 = s.chamar('criarPedido', karen, com({ grupo: 'Vôlei de Domingo', esporte: 'handebol', celular: '+55 (31) 3333-4444' }));
  assert.strictEqual(r2.dados.numero, 'MS-0002');
  assert.strictEqual(r2.dados.esporte, 'Outro: handebol');
  assert.strictEqual(s.linhas()[2][4], '553133334444');

  // mesmo grupo da mesma pessoa: avisa o número (vem antes do limite)
  const dup = s.chamar('criarPedido', karen, com({ grupo: 'futebol DE quinta!' }));
  assert.strictEqual(dup.ok, false);
  assert.ok(dup.erro.includes('MS-0001'), dup.erro);
  // limite de 2 em andamento
  const r3 = s.chamar('criarPedido', karen, com({ grupo: 'Basquete da Firma' }));
  assert.strictEqual(r3.ok, false);
  assert.ok(r3.erro.includes('2 pedidos em andamento'), r3.erro);
  // endereço de outra pessoa e endereço de grupo real
  assert.ok(s.chamar('criarPedido', bruno, com({ grupo: 'FUTEBOL de quinta' })).erro.includes('já é de outro grupo'));
  assert.ok(s.chamar('criarPedido', bruno, com({ grupo: 'Vôlei' })).erro.includes('já é de outro grupo'));

  assert.deepStrictEqual(s.chamar('meusPedidos', karen).dados.map(p => p.numero), ['MS-0002', 'MS-0001']);
  assert.deepStrictEqual(s.chamar('meusPedidos', bruno).dados, []);

  assert.strictEqual(s.chamar('todosPedidos', karen).codigo, 'admin');
  assert.strictEqual(s.chamar('mudarEtapa', karen, { numero: 'MS-0001', etapa: 'Concluído' }).codigo, 'admin');
  const todos = s.chamar('todosPedidos', adm).dados;
  assert.strictEqual(todos.length, 2);
  assert.strictEqual(todos[1].numero, 'MS-0001');
  assert.strictEqual(todos[1].celular, '5531987310965');
  assert.strictEqual(todos[1].email, 'karen@teste.com');
  assert.strictEqual(todos[1].nome, 'Karen Souza');

  assert.strictEqual(s.chamar('mudarEtapa', adm, { numero: 'MS-0001', etapa: 'Finalizado' }).ok, false);
  assert.strictEqual(s.chamar('mudarEtapa', adm, { numero: 'MS-9999', etapa: 'Concluído' }).ok, false);
  const m = s.chamar('mudarEtapa', adm, { numero: 'MS-0001', etapa: 'Concluído' });
  assert.ok(m.ok, JSON.stringify(m));
  assert.strictEqual(m.dados.etapa, 'Concluído');
  assert.strictEqual(s.linhas()[1][8], 'Concluído');
  // concluído libera vaga no limite
  assert.ok(s.chamar('criarPedido', karen, com({ grupo: 'Basquete da Firma', esporte: 'Basquete' })).ok);
}

// 4. Validação e proteção contra fórmula na planilha
{
  const s = criarScriptFalso();
  const erro = d => s.chamar('criarPedido', karen, com(d)).erro;
  for (const g of ['🏐🔥', 'A', '   ', 'x'.repeat(61)]) assert.ok(erro({ grupo: g }), 'grupo ' + g);
  for (const e of ['', 'x'.repeat(41)]) assert.ok(erro({ esporte: e }), 'esporte ' + e);
  for (const c of ['', '98731-0965', '(01) 98731-0965', '(31) 18731-0965', '(31) 98731-09651']) assert.ok(erro({ celular: c }), 'celular ' + c);
  assert.strictEqual(s.linhas().length, 0, 'nada gravado (nem a aba foi criada) com dado inválido');

  const r = s.chamar('criarPedido', karen, com({ grupo: '=HYPERLINK("http://x","oi")' }));
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(s.linhas()[1][5][0], "'", 'fórmula vira texto');
  const z = s.chamar('criarPedido', tokenFalso({ email: 'z@teste.com', name: '=1+1' }), com({ grupo: 'Grupo Z' }));
  assert.ok(z.ok);
  assert.strictEqual(s.linhas()[2][3], "'=1+1");
}

// 5. Planilha que já tem pedidos (datas e celular como o Sheets devolve)
{
  const s = criarScriptFalso({ linhas: [
    ['MS-0041', new Date('2026-09-01T12:00:00Z'), 'ana@teste.com', 'Ana', 5531999990000, 'Ana FC', 'ana-fc', 'Vôlei', 'Concluído', new Date('2026-09-10T12:00:00Z')],
    ['', '', '', '', '', '', '', '', '', ''],
  ] });
  const r = s.chamar('criarPedido', karen, base);
  assert.strictEqual(r.dados.numero, 'MS-0042');
  const ana = s.chamar('todosPedidos', adm).dados.find(p => p.numero === 'MS-0041');
  assert.strictEqual(ana.celular, '5531999990000');
  assert.strictEqual(ana.atualizadoEm, '2026-09-10T12:00:00.000Z');
}

// 6. O Sheets transforma "007" em 7 e "1/2" em data: as colunas de texto têm que ficar como texto
{
  const s = criarScriptFalso();
  const r = s.chamar('criarPedido', karen, com({ grupo: '007' }));
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(s.linhas()[1][5], '007', 'grupo continua texto');
  assert.strictEqual(s.linhas()[1][6], '007', 'endereço continua texto');
  assert.strictEqual(s.linhas()[1][4], '5531987310965', 'celular continua texto');
  assert.ok(s.chamar('criarPedido', bruno, com({ grupo: '007' })).erro.includes('já é de outro grupo'), 'o mesmo endereço não é dado duas vezes');
  const meio = s.chamar('criarPedido', karen, com({ grupo: '1/2' }));
  assert.ok(meio.ok, JSON.stringify(meio));
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].grupo, '1/2');
  // o apóstrofo contra fórmula não aparece de volta para o cliente
  const f = s.chamar('criarPedido', bruno, com({ grupo: '=Time', celular: '31987310965' }));
  assert.strictEqual(f.dados.grupo, '=Time');
  assert.strictEqual(s.chamar('meusPedidos', bruno).dados[0].grupo, '=Time');
}

// 7. Recado do admin para o cliente
{
  const s = criarScriptFalso();
  s.chamar('criarPedido', karen, base);
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, '', 'sem recado, vem vazio');
  assert.strictEqual(s.chamar('mudarRecado', karen, { numero: 'MS-0001', recado: 'oi' }).codigo, 'admin', 'cliente não grava recado');
  const limpo = 'Mandamos o link de teste no seu WhatsApp.\n\nConfira até sexta.';
  const r = s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: '  Mandamos o link de teste   no seu WhatsApp.\r\n\n\n\nConfira até sexta. ' });
  assert.ok(r.ok, JSON.stringify(r));
  assert.strictEqual(r.dados.recado, limpo, 'espaços limpos, quebra de linha mantida');
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, limpo);
  assert.strictEqual(s.chamar('todosPedidos', adm).dados[0].recado, limpo);
  assert.strictEqual(s.chamar('meusPedidos', bruno).dados.length, 0, 'recado não vaza para outra conta');
  assert.strictEqual(s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: 'x'.repeat(501) }).ok, false, 'até 500 caracteres');
  assert.strictEqual(s.chamar('mudarRecado', adm, { numero: 'MS-9999', recado: 'oi' }).ok, false);
  assert.ok(s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: '=IMPORTXML("x")' }).ok);
  assert.strictEqual(s.linhas()[1][10][0], "'", 'fórmula no recado vira texto');
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, '=IMPORTXML("x")');
  assert.strictEqual(s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: '0012' }).dados.recado, '0012', 'recado só de número continua texto');
  assert.ok(s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: '   ' }).ok);
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, '', 'recado em branco apaga');
}

// 8. Planilha criada antes da coluna Recado: o cabeçalho ganha a coluna sozinho
{
  const antigo = ['Número', 'Criado em', 'E-mail', 'Nome Google', 'Celular', 'Grupo', 'Endereço', 'Esporte', 'Etapa', 'Atualizado em'];
  const s = criarScriptFalso({ cabecalho: antigo, linhas: [
    ['MS-0001', new Date('2026-09-01T12:00:00Z'), 'karen@teste.com', 'Karen', '5531987310965', 'Velho FC', 'velho-fc', 'Vôlei', 'Recebido', new Date('2026-09-01T12:00:00Z')],
  ] });
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, '', 'linha antiga, de 10 colunas, lê recado vazio');
  assert.ok(s.chamar('mudarRecado', adm, { numero: 'MS-0001', recado: 'Bem-vindos' }).ok);
  assert.strictEqual(s.linhas()[0][10], 'Recado');
  assert.strictEqual(s.chamar('meusPedidos', karen).dados[0].recado, 'Bem-vindos');
}

console.log('TODOS OS TESTES PASSARAM');
