/* MemberStars: conta Google e área de pedidos (usado pelo index, /pedidos/ e /admin/).
   Topo: configuração e funções puras, testadas no Node (testes/conta.test.js).
   Embaixo: o objeto Conta, que só existe no navegador. */

// Preencher depois de criar o Client ID e publicar o Apps Script (passo a passo em apps-script/LEIAME.md).
// Vazios = área de pedidos desligada: o pop-up volta a mandar direto para o WhatsApp, como antes.
var GOOGLE_CLIENT_ID = '986000653553-d5ri8n0k3kg6f1iii2e8c3v3854uuk3d.apps.googleusercontent.com';
var URL_SCRIPT = 'https://script.google.com/macros/s/AKfycbxLqvxp8p0QKCbdAXP7VVgXLubw1eoDfoLXl2Ymp6dKI0aqOLnetzIrRofTccC-fdTyhQ/exec';

// Mesma ordem e grafia de apps-script/Codigo.gs (o teste do Apps Script confere que batem).
var ETAPAS = ['Recebido', 'Em produção', 'Acertos finais', 'Concluído'];

/* Só os dígitos do número brasileiro. Quem cola "+55 31 9..." fica com 13 dígitos: tira o 55 do país.
   Com até 11 dígitos o 55 fica, porque pode ser o DDD do Rio Grande do Sul. */
function digitosNacionais(texto) {
  var d = String(texto || '').replace(/\D/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  return d;
}

// DDD sem zero (11 a 99) + celular de 9 dígitos começando com 9, ou fixo de 8 dígitos (2 a 8).
function celularValido(texto) {
  return /^[1-9]{2}(9\d{8}|[2-8]\d{7})$/.test(digitosNacionais(texto));
}

// Máscara aplicada enquanto a pessoa digita: (31) 9873-1 ... (31) 98731-0965.
function formatarCelular(texto) {
  var d = digitosNacionais(texto).slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  var ddd = '(' + d.slice(0, 2) + ') ', resto = d.slice(2);
  if (resto.length <= 4) return ddd + resto;
  var corte = resto.length === 9 ? 5 : 4;
  return ddd + resto.slice(0, corte) + '-' + resto.slice(corte);
}

function indiceEtapa(etapa) { return ETAPAS.indexOf(etapa); }

/* Lê nome, e-mail, foto e validade do ID token do Google, só para mostrar na tela.
   Quem confere a assinatura de verdade é o Apps Script: aqui nada é usado para decidir acesso. */
function lerToken(jwt) {
  try {
    var parte = String(jwt).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (parte.length % 4) parte += '=';
    var bytes = atob(parte);
    var json = decodeURIComponent(bytes.split('').map(function (c) {
      return '%' + ('0' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    var d = JSON.parse(json);
    if (!d.email || !d.exp) return null;
    return { email: d.email, nome: d.name || d.email, foto: d.picture || '', exp: d.exp };
  } catch (e) { return null; }
}

// "12/10, 14:32" no fuso de quem está vendo.
function formatarData(iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

if (typeof module !== 'undefined' && module.exports) module.exports = {
  GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID, URL_SCRIPT: URL_SCRIPT, ETAPAS: ETAPAS,
  digitosNacionais: digitosNacionais, celularValido: celularValido, formatarCelular: formatarCelular,
  indiceEtapa: indiceEtapa, lerToken: lerToken, formatarData: formatarData
};

/* ================================ Navegador ================================ */
var Conta = typeof document === 'undefined' ? null : (function () {
  var CHAVE = 'ms-sessao';
  var semArmazenamento = null;   // só usado quando o sessionStorage está bloqueado
  var carregandoGoogle = null;

  function guarda(token) { try { sessionStorage.setItem(CHAVE, token); } catch (e) { semArmazenamento = token; } }
  function lido() { try { return sessionStorage.getItem(CHAVE); } catch (e) { return semArmazenamento; } }

  function sair() {
    semArmazenamento = null;
    try { sessionStorage.removeItem(CHAVE); } catch (e) {}
    if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect();
  }

  // Sessão válida por mais de 1 min, ou null (o token do Google vale 1 h).
  function atual() {
    var token = lido();
    if (!token) return null;
    var info = lerToken(token);
    if (!info || info.exp * 1000 < Date.now() + 60000) { sair(); return null; }
    info.token = token;
    return info;
  }

  // Script do Google só é baixado quando alguém precisa entrar.
  function carregaGoogle() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    if (carregandoGoogle) return carregandoGoogle;
    carregandoGoogle = new Promise(function (ok, falha) {
      var s = document.createElement('script');
      var limite = setTimeout(function () { falha(new Error('tempo')); }, 10000);
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = function () { clearTimeout(limite); ok(); };
      s.onerror = function () { clearTimeout(limite); falha(new Error('rede')); };
      document.head.appendChild(s);
    });
    carregandoGoogle.catch(function () { carregandoGoogle = null; });   // deixa tentar de novo
    return carregandoGoogle;
  }

  // Desenha o botão oficial do Google dentro de `lugar` (precisa estar visível para medir a largura).
  function entrar(lugar, aoEntrar) {
    return carregaGoogle().then(function () {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: function (r) { guarda(r.credential); aoEntrar(atual()); },
        auto_select: false,
        cancel_on_tap_outside: true
      });
      lugar.textContent = '';
      google.accounts.id.renderButton(lugar, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'pt-BR',
        width: Math.min(Math.max(lugar.clientWidth, 220), 400)
      });
    });
  }

  var FALHA_REDE = { rede: true, mensagem: 'Não deu para falar com o servidor agora.' };

  /* Corpo como texto puro: o navegador não faz a pergunta prévia de CORS (OPTIONS), que o
     Apps Script não responde. */
  function chamar(acao, dados) {
    var sessao = atual();
    if (!sessao) return Promise.reject({ precisaEntrar: true, mensagem: 'Entre com o Google para continuar.' });
    var controle = typeof AbortController === 'function' ? new AbortController() : null;
    var limite = setTimeout(function () { if (controle) controle.abort(); }, 20000);
    return fetch(URL_SCRIPT, {
      method: 'POST',
      body: JSON.stringify({ acao: acao, token: sessao.token, dados: dados || {} }),
      signal: controle ? controle.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .catch(function () { throw FALHA_REDE; })
      .then(function (resp) {
        if (resp && resp.ok) return resp.dados;
        if (resp && resp.codigo === 'login') { sair(); throw { precisaEntrar: true, mensagem: resp.erro }; }
        throw { mensagem: (resp && resp.erro) || 'Algo deu errado. Tente de novo.', codigo: resp && resp.codigo };
      })
      .finally(function () { clearTimeout(limite); });
  }

  // As 4 etapas em linha: feitas com ✓, a atual acesa em ouro, as próximas apagadas.
  function linhaDoTempo(etapa) {
    var agora = Math.max(0, indiceEtapa(etapa));
    var acabou = agora === ETAPAS.length - 1;
    var ol = document.createElement('ol');
    ol.className = 'tempo';
    ol.setAttribute('aria-label', 'Andamento do pedido: ' + ETAPAS[agora]);
    ETAPAS.forEach(function (nome, i) {
      var estado = i < agora || acabou ? 'feito' : (i === agora ? 'atual' : 'futuro');
      var li = document.createElement('li');
      li.className = 'tempo-passo ' + estado;
      if (i === agora) li.setAttribute('aria-current', 'step');
      var bola = document.createElement('span');
      bola.className = 'tempo-bola';
      bola.setAttribute('aria-hidden', 'true');
      if (estado === 'feito') bola.innerHTML = '<i class="ph-bold ph-check"></i>';
      else bola.textContent = String(i + 1);
      var rotulo = document.createElement('span');
      rotulo.className = 'tempo-nome';
      rotulo.textContent = nome;
      li.appendChild(bola);
      li.appendChild(rotulo);
      ol.appendChild(li);
    });
    return ol;
  }

  return {
    configurada: function () { return !!(GOOGLE_CLIENT_ID && URL_SCRIPT); },
    atual: atual, entrar: entrar, sair: sair, chamar: chamar, linhaDoTempo: linhaDoTempo
  };
})();
