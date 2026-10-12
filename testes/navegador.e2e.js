// Roteiro de navegador da área de pedidos, em 1280 px e 390 px.
// O login do Google e o Apps Script são simulados: o "backend" é o próprio apps-script/Codigo.gs
// rodando no Node com planilha falsa. O js/conta.js é servido com a configuração de teste trocada.
// Rodar: node testes/navegador.e2e.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/Heleno/OneDrive/Documentos/GitHub/memberstars-video/node_modules/playwright-core');
const { iniciar } = require('./servidor');
const { criarScriptFalso, tokenFalso } = require('./apps-script-falso');

const PORTA = 8081;
const BASE = 'http://localhost:' + PORTA + '/';
const URL_FALSA = 'https://script.teste/exec';
const CONTA_JS = fs.readFileSync(path.join(__dirname, '..', 'js', 'conta.js'), 'utf8');
const GIS_FALSO = `window.google = { accounts: { id: {
  initialize: function (o) { window.__gis = o; },
  renderButton: function (el) {
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Entrar (Google de teste)';
    b.setAttribute('data-google-falso', ''); b.onclick = function () { window.__gis.callback({ credential: window.__tokenTeste }); };
    el.appendChild(b);
  },
  disableAutoSelect: function () {}
} } };`;
const KAREN = { email: 'karen@teste.com', name: 'Karen Souza' };
const ADMIN = { email: 'admin@teste.com', name: 'Adm' };

function contaJsDeTeste(ligado) {
  return CONTA_JS
    .replace(/var GOOGLE_CLIENT_ID = '[^']*'/, `var GOOGLE_CLIENT_ID = '${ligado ? 'cliente-teste' : ''}'`)
    .replace(/var URL_SCRIPT = '[^']*'/, `var URL_SCRIPT = '${ligado ? URL_FALSA : ''}'`);
}

async function novaPagina(navegador, largura, { usuario, script, ligado = true, scriptFora = false }) {
  const contexto = await navegador.newContext({ viewport: { width: largura, height: largura < 500 ? 844 : 900 } });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', e => erros.push(e.message));
  pagina.on('dialog', d => { erros.push('alert/confirm inesperado: ' + d.message()); d.dismiss(); });
  await contexto.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: GIS_FALSO }));
  await contexto.route('**/js/conta.js', r => r.fulfill({ contentType: 'text/javascript', body: contaJsDeTeste(ligado) }));
  await contexto.route(URL_FALSA, r => {
    if (scriptFora) return r.abort();
    const corpo = JSON.parse(r.request().postData());
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(script.chamar(corpo.acao, corpo.token, corpo.dados)) });
  });
  if (usuario) await pagina.addInitScript(t => { window.__tokenTeste = t; }, tokenFalso(usuario));
  return { pagina, erros, contexto };
}

async function semRolagemLateral(pagina) {
  assert.strictEqual(await pagina.evaluate(() => document.documentElement.scrollWidth === innerWidth), true, 'rolagem para os lados');
}
async function abrePopup(pagina) { await pagina.click('#inicio [data-contato]'); }
const visivel = sel => sel + ':not([hidden])';

async function roteiroPopup(navegador, largura) {
  const script = criarScriptFalso();
  let { pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: KAREN, script });

  // pedido completo; clique duplo grava uma vez só
  await pagina.goto(BASE);
  await abrePopup(pagina);
  await pagina.click(visivel('[data-passo="entrar"]') + ' [data-google-falso]');
  await pagina.waitForSelector(visivel('[data-passo="form"]'));
  assert.strictEqual(await pagina.textContent('[data-nome-conta]'), 'Karen Souza');
  await pagina.fill('#pedido-grupo', 'Pelada <b>do</b> Zé');
  await pagina.click('label:has(input[value="Futebol / society"])');
  await pagina.fill('#pedido-celular', '31987310965');
  assert.strictEqual(await pagina.inputValue('#pedido-celular'), '(31) 98731-0965');
  await semRolagemLateral(pagina);
  await pagina.dblclick('[data-envia]');
  await pagina.waitForSelector(visivel('[data-passo="pronto"]'));
  assert.strictEqual(await pagina.textContent('[data-numero]'), 'MS-0001');
  assert.strictEqual(await pagina.locator('[data-pronto-tempo] .tempo-passo.atual').count(), 1);
  assert.ok((await pagina.getAttribute('[data-pronto-whats]', 'href')).includes(encodeURIComponent('*MS-0001*')));
  assert.strictEqual(script.linhas().length, 2, 'cabeçalho + 1 pedido');
  assert.strictEqual(script.linhas()[1][4], '5531987310965');

  // celular inválido não sai do formulário
  await pagina.click('[data-fecha]');
  await abrePopup(pagina);
  await pagina.waitForSelector(visivel('[data-passo="form"]'));   // já logada: pula o passo "Entrar"
  await pagina.fill('#pedido-grupo', 'Vôlei de Domingo');
  await pagina.click('label:has(input[value="Vôlei"])');
  await pagina.fill('#pedido-celular', '9873');
  await pagina.click('[data-envia]');
  await pagina.waitForSelector(visivel('[data-erro-celular]'));
  assert.strictEqual(await pagina.getAttribute('#pedido-celular', 'aria-invalid'), 'true');

  // sessão vence com o formulário preenchido: login de novo e nada se perde
  await pagina.fill('#pedido-celular', '(31) 3333-4444');
  await pagina.evaluate(() => sessionStorage.clear());
  await pagina.click('[data-envia]');
  await pagina.click(visivel('[data-passo="entrar"]') + ' [data-google-falso]');
  await pagina.waitForSelector(visivel('[data-passo="form"]'));
  assert.strictEqual(await pagina.inputValue('#pedido-grupo'), 'Vôlei de Domingo');
  await pagina.click('[data-envia]');
  await pagina.waitForSelector(visivel('[data-passo="pronto"]'));
  assert.strictEqual(await pagina.textContent('[data-numero]'), 'MS-0002');

  // terceiro pedido: limite de 2 em andamento, com saída pelo WhatsApp
  await pagina.goto(BASE + 'index.html#pedir');   // caminho diferente: força carregar a página (só o # não recarrega)
  await pagina.waitForSelector(visivel('[data-passo="form"]'));
  await pagina.fill('#pedido-grupo', 'Basquete da Firma');
  await pagina.click('label:has(input[value="Basquete"])');
  await pagina.fill('#pedido-celular', '31987310965');
  await pagina.click('[data-envia]');
  await pagina.waitForSelector(visivel('[data-erro-envio]'));
  assert.ok((await pagina.textContent('[data-erro-envio]')).includes('2 pedidos em andamento'));
  assert.ok(await pagina.isVisible('[data-whats-erro]'));
  assert.ok(await pagina.isVisible(largura > 900 ? '.topo-links a[href="pedidos/"]' : '.menu-btn'));
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // Apps Script fora do ar: erro + WhatsApp
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: { email: 'novo@teste.com', name: 'Novo' }, script, scriptFora: true }));
  await pagina.goto(BASE);
  await abrePopup(pagina);
  await pagina.click(visivel('[data-passo="entrar"]') + ' [data-google-falso]');
  await pagina.fill('#pedido-grupo', 'Time Novo');
  await pagina.click('label:has(input[value="Vôlei"])');
  await pagina.fill('#pedido-celular', '31987310965');
  await pagina.click('[data-envia]');
  await pagina.waitForSelector(visivel('[data-erro-envio]'));
  assert.ok((await pagina.textContent('[data-erro-envio]')).includes('servidor'));
  assert.ok(await pagina.isVisible('[data-whats-erro]'));
  assert.strictEqual(await pagina.isDisabled('[data-envia]'), false, 'botão destrava depois do erro');
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // área desligada (site publicado antes da configuração): fluxo antigo do WhatsApp
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { script, ligado: false }));
  await pagina.goto(BASE);
  await abrePopup(pagina);
  await pagina.waitForSelector(visivel('[data-passo="form"]'));
  assert.strictEqual(await pagina.isVisible('#pedido-celular'), false);
  assert.ok((await pagina.textContent('[data-envia]')).includes('WhatsApp'));
  assert.strictEqual(await pagina.locator('.topo-links a[href="pedidos/"]').isVisible(), false);
  assert.deepStrictEqual(erros, []);
  await contexto.close();
}

async function roteiroPedidos(navegador, largura) {
  const script = criarScriptFalso();
  const tKaren = tokenFalso(KAREN), tAdmin = tokenFalso(ADMIN);
  const pedido = (grupo, esporte) => script.chamar('criarPedido', tKaren, { grupo, esporte, celular: '31987310965' });
  assert.ok(pedido('Pelada <b>do</b> Zé', 'Futebol / society').ok);
  assert.ok(pedido('Vôlei de Domingo', 'Vôlei').ok);
  script.chamar('mudarEtapa', tAdmin, { numero: 'MS-0001', etapa: 'Concluído' });

  let { pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: KAREN, script });
  await pagina.goto(BASE + 'pedidos/');
  await pagina.click(visivel('[data-estado="entrar"]') + ' [data-google-falso]');
  await pagina.waitForSelector(visivel('[data-estado="lista"]'));
  assert.strictEqual(await pagina.locator('.cartoes .cartao').count(), 2);   // fora o esqueleto de carregamento
  assert.strictEqual(await pagina.textContent('.cartao:first-child .cartao-num'), 'MS-0002');
  // HTML no nome do grupo aparece como texto, não vira marcação
  assert.strictEqual(await pagina.textContent('.cartao:last-child .cartao-grupo'), 'Pelada <b>do</b> Zé');
  assert.strictEqual(await pagina.locator('.cartao-grupo b').count(), 0);
  // MS-0002 em Recebido; MS-0001 concluído com "Abrir meu app"
  assert.strictEqual(await pagina.textContent('.cartao:first-child .tempo-passo.atual .tempo-nome'), 'Recebido');
  assert.strictEqual(await pagina.locator('.cartao:last-child .tempo-passo.feito').count(), 4);
  const abrir = pagina.locator('.cartao:last-child a:has-text("Abrir meu app")');
  assert.strictEqual(await abrir.getAttribute('href'), 'https://memberstars.com/pelada-b-do-b-ze/');
  assert.strictEqual(await pagina.locator('.cartao:first-child a:has-text("Abrir meu app")').count(), 0);
  assert.strictEqual(await pagina.textContent('[data-nome]'), 'Karen Souza');
  await semRolagemLateral(pagina);

  // admin muda a etapa; "Atualizar" mostra sem recarregar a página
  script.chamar('mudarEtapa', tAdmin, { numero: 'MS-0002', etapa: 'Acertos finais' });
  await pagina.click('[data-atualizar]');
  await pagina.waitForSelector('.cartao:first-child .tempo-passo.atual .tempo-nome:has-text("Acertos finais")');

  // sair volta ao botão do Google
  await pagina.click('[data-sair]');
  await pagina.waitForSelector(visivel('[data-estado="entrar"]'));
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // conta sem pedido: estado vazio com o atalho para o pop-up
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: { email: 'vazio@teste.com', name: 'Vazio' }, script }));
  await pagina.goto(BASE + 'pedidos/');
  await pagina.click('[data-google-falso]');
  await pagina.waitForSelector(visivel('[data-estado="vazio"]'));
  await pagina.click(visivel('[data-estado="vazio"]') + ' a');
  await pagina.waitForSelector('#pedido[open]');
  assert.strictEqual(new URL(pagina.url()).hash, '', 'o #pedir sai do endereço');
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // servidor recusa o login (token de outro Client ID, ou CLIENT_ID errado no script): a mensagem aparece
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: { email: 'karen@teste.com', name: 'Karen', aud: 'outro-app' }, script }));
  await pagina.goto(BASE + 'pedidos/');
  await pagina.click('[data-google-falso]');
  await pagina.waitForSelector(visivel('[data-estado="entrar"]') + ' ' + visivel('[data-erro-login]'));
  assert.ok((await pagina.textContent('[data-erro-login]')).includes('Entre de novo'));
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // área desligada
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { script, ligado: false }));
  await pagina.goto(BASE + 'pedidos/');
  await pagina.waitForSelector(visivel('[data-estado="desligado"]'));
  assert.deepStrictEqual(erros, []);
  await contexto.close();
}

async function roteiroAdmin(navegador, largura) {
  const script = criarScriptFalso();
  const tKaren = tokenFalso(KAREN);
  assert.ok(script.chamar('criarPedido', tKaren, { grupo: 'Pelada do Zé', esporte: 'Futebol / society', celular: '31987310965' }).ok);
  assert.ok(script.chamar('criarPedido', tKaren, { grupo: 'Vôlei de Domingo', esporte: 'Vôlei', celular: '3133334444' }).ok);

  // cliente comum é barrado
  let { pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: KAREN, script });
  await pagina.goto(BASE + 'admin/');
  await pagina.click('[data-google-falso]');
  await pagina.waitForSelector(visivel('[data-estado="negado"]'));
  assert.strictEqual(await pagina.locator('.adm-linha').count(), 0);
  assert.deepStrictEqual(erros, []);
  await contexto.close();

  // admin: lista, filtro, busca e troca de etapa
  ({ pagina, erros, contexto } = await novaPagina(navegador, largura, { usuario: ADMIN, script }));
  await pagina.goto(BASE + 'admin/');
  await pagina.click('[data-google-falso]');
  await pagina.waitForSelector(visivel('[data-estado="lista"]'));
  assert.strictEqual(await pagina.locator('.adm-linha').count(), 2);
  assert.strictEqual(await pagina.textContent('[data-filtros] .chip[aria-pressed="true"]'), 'Todos 2');
  assert.ok((await pagina.textContent('.adm-linha:last-child .adm-contato')).includes('(31) 98731-0965'));
  assert.strictEqual(await pagina.getAttribute('.adm-linha:last-child .adm-contato a[href^="https://wa.me/"]', 'href'), 'https://wa.me/5531987310965');
  await semRolagemLateral(pagina);

  await pagina.fill('[data-busca]', 'pelada');
  assert.strictEqual(await pagina.locator('.adm-linha').count(), 1);
  await pagina.fill('[data-busca]', '3333');   // busca pelos dígitos do celular
  assert.strictEqual(await pagina.locator('.adm-linha').count(), 1);
  await pagina.fill('[data-busca]', 'ninguem');
  assert.ok(await pagina.isVisible('[data-nenhum]'));
  await pagina.fill('[data-busca]', '');

  await pagina.selectOption('.adm-linha:last-child select', 'Em produção');
  await pagina.waitForSelector('.adm-linha:last-child [data-salvo]:has-text("Salvo")');
  assert.strictEqual(script.linhas()[1][8], 'Em produção');
  await pagina.click('[data-filtros] .chip:has-text("Em produção")');
  assert.strictEqual(await pagina.locator('.adm-linha').count(), 1);
  assert.strictEqual(await pagina.textContent('[data-filtros] .chip[aria-pressed="true"]'), 'Em produção 1');

  // falha ao salvar: a lista volta à etapa anterior e avisa
  await contexto.route(URL_FALSA, r => r.abort());
  await pagina.selectOption('.adm-linha select', 'Concluído');
  await pagina.waitForSelector('.adm-linha [data-salvo].erro');
  assert.strictEqual(await pagina.inputValue('.adm-linha select'), 'Em produção');
  assert.strictEqual(script.linhas()[1][8], 'Em produção');
  assert.deepStrictEqual(erros, []);
  await contexto.close();
}

const ROTEIROS = [roteiroPopup, roteiroPedidos, roteiroAdmin];

(async () => {
  const servidor = await iniciar(PORTA);
  const navegador = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const largura of [1280, 390]) {
      for (const roteiro of ROTEIROS) { await roteiro(navegador, largura); console.log('ok', roteiro.name, largura + ' px'); }
    }
    console.log('TODOS OS TESTES PASSARAM');
  } finally {
    await navegador.close();
    servidor.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
