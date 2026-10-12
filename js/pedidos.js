/* Meus pedidos: os pedidos da conta Google logada, cada um com a linha do tempo das etapas.
   Quem filtra "só os seus" é o Apps Script (pelo e-mail do token), não esta página. */
(function () {
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var lista = $('[data-lista]');

  function mostra(estado) { $$('[data-estado]').forEach(function (s) { s.hidden = s.dataset.estado !== estado; }); }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function mostraQuem(sessao) {
    $('[data-nome]').textContent = sessao.nome;
    var foto = $('[data-foto]');
    foto.hidden = !sessao.foto;
    if (sessao.foto) foto.src = sessao.foto;
    $('[data-quem]').hidden = false;
  }

  function cartao(p) {
    var li = el('li', 'cartao');
    var topo = el('div', 'cartao-topo');
    topo.appendChild(el('span', 'cartao-num', p.numero));
    topo.appendChild(el('span', 'cartao-etapa', p.etapa));
    li.appendChild(topo);
    li.appendChild(el('h2', 'cartao-grupo', p.grupo));
    li.appendChild(el('p', 'cartao-info', p.esporte + ' · memberstars.com/' + p.endereco));
    li.appendChild(Conta.linhaDoTempo(p.etapa));
    if (p.recado) {
      // recado do admin: texto puro, as quebras de linha ficam por conta do CSS (white-space)
      var recado = el('div', 'cartao-recado');
      var titulo = el('p', 'cartao-recado-tit');
      titulo.innerHTML = '<i class="ph-fill ph-chat-circle-text"></i> ';
      titulo.appendChild(document.createTextNode('Recado da equipe MemberStars'));
      recado.appendChild(titulo);
      recado.appendChild(el('p', 'cartao-recado-texto', p.recado));
      li.appendChild(recado);
    }
    var quando = formatarData(p.atualizadoEm);
    if (quando) li.appendChild(el('p', 'cartao-data', 'Atualizado em ' + quando));
    if (p.etapa === 'Concluído') {
      var abrir = el('a', 'btn btn-ouro cartao-abrir');
      abrir.href = 'https://memberstars.com/' + p.endereco + '/';
      abrir.target = '_blank';
      abrir.rel = 'noopener';
      abrir.innerHTML = '<i class="ph-bold ph-rocket-launch"></i> ';
      abrir.appendChild(document.createTextNode('Abrir meu app'));
      li.appendChild(abrir);
    }
    return li;
  }

  function carrega() {
    mostra('carregando');
    Conta.chamar('meusPedidos').then(function (pedidos) {
      if (!pedidos.length) { mostra('vazio'); return; }
      lista.textContent = '';
      pedidos.forEach(function (p) { lista.appendChild(cartao(p)); });
      mostra('lista');
    }).catch(function (err) {
      if (err.precisaEntrar) { pedeLogin(err.mensagem); return; }
      $('[data-erro-texto]').textContent = err.mensagem;
      mostra('erro');
    });
  }

  // mensagem: por que voltou ao login (sessão vencida, ou o servidor recusou o token)
  function pedeLogin(mensagem) {
    var erro = $('[data-erro-login]');
    $('[data-quem]').hidden = true;
    erro.textContent = mensagem || '';
    erro.hidden = !mensagem;
    mostra('entrar');
    Conta.entrar($('[data-google]'), function (sessao) { mostraQuem(sessao); carrega(); }).catch(function () {
      var e = $('[data-erro-login]');
      e.textContent = 'Não deu para abrir o login do Google. Confira se o navegador não está bloqueando e recarregue a página.';
      e.hidden = false;
    });
  }

  $('[data-atualizar]').addEventListener('click', carrega);
  $('[data-tentar]').addEventListener('click', carrega);
  $('[data-sair]').addEventListener('click', function () { Conta.sair(); pedeLogin(); });

  if (!Conta.configurada()) { mostra('desligado'); return; }
  var sessao = Conta.atual();
  if (sessao) { mostraQuem(sessao); carrega(); } else pedeLogin();
})();
