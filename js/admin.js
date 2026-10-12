/* Painel do administrador: todos os pedidos, filtro por etapa, busca e troca de etapa.
   A página é pública, mas os dados só saem do Apps Script para e-mails da propriedade ADMINS. */
(function () {
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var lista = $('[data-lista]'), filtros = $('[data-filtros]'), busca = $('[data-busca]');
  var pedidos = [], filtro = 'Todos';

  function mostra(estado) { $$('[data-estado]').forEach(function (s) { s.hidden = s.dataset.estado !== estado; }); }
  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }
  function normaliza(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
  function mostraQuem(sessao) {
    $('[data-nome]').textContent = sessao.nome;
    var foto = $('[data-foto]');
    foto.hidden = !sessao.foto;
    if (sessao.foto) foto.src = sessao.foto;
    $('[data-quem]').hidden = false;
  }

  function desenhaFiltros() {
    filtros.textContent = '';
    ['Todos'].concat(ETAPAS).forEach(function (nome) {
      var n = nome === 'Todos' ? pedidos.length : pedidos.filter(function (p) { return p.etapa === nome; }).length;
      var b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('aria-pressed', String(nome === filtro));
      b.appendChild(document.createTextNode(nome + ' '));
      b.appendChild(el('b', '', String(n)));
      b.addEventListener('click', function () { filtro = nome; desenhaFiltros(); desenhaLista(); });
      filtros.appendChild(b);
    });
  }

  function linha(p) {
    var li = el('li', 'adm-linha');
    var id = el('div', 'adm-id');
    id.appendChild(el('b', '', p.numero));
    id.appendChild(el('small', '', formatarData(p.criadoEm)));
    var grupo = el('div', 'adm-grupo');
    grupo.appendChild(el('strong', '', p.grupo));
    grupo.appendChild(el('small', '', 'memberstars.com/' + p.endereco + ' · ' + p.esporte));
    var contato = el('div', 'adm-contato');
    var zap = el('a', '', formatarCelular(p.celular));
    zap.href = 'https://wa.me/' + String(p.celular).replace(/\D/g, '');
    zap.target = '_blank';
    zap.rel = 'noopener';
    var email = el('a', '', p.email);
    email.href = 'mailto:' + p.email;
    contato.appendChild(zap);
    contato.appendChild(email);
    contato.appendChild(el('small', '', p.nome));

    var etapa = el('div', 'adm-etapa');
    var rotulo = el('label', 'so-leitor', 'Etapa do pedido ' + p.numero);
    var seletor = el('select');
    seletor.id = 'etapa-' + p.numero;
    rotulo.htmlFor = seletor.id;
    ETAPAS.forEach(function (e) { var o = el('option', '', e); o.value = e; seletor.appendChild(o); });
    seletor.value = p.etapa;
    var salvo = el('span', 'adm-salvo');
    salvo.setAttribute('data-salvo', '');
    salvo.setAttribute('aria-live', 'polite');
    seletor.addEventListener('change', function () {
      var anterior = p.etapa;
      seletor.disabled = true;
      salvo.className = 'adm-salvo';
      salvo.textContent = 'Salvando…';
      Conta.chamar('mudarEtapa', { numero: p.numero, etapa: seletor.value })
        .then(function (novo) {
          p.etapa = novo.etapa;
          p.atualizadoEm = novo.atualizadoEm;
          salvo.textContent = 'Salvo ✓';
          desenhaFiltros();   // só as contagens; a linha fica onde está para o "Salvo" continuar visível
        })
        .catch(function (err) {
          seletor.value = anterior;
          salvo.className = 'adm-salvo erro';
          salvo.textContent = err.mensagem || 'Não salvou. Tente de novo.';
          if (err.precisaEntrar) pedeLogin(err.mensagem);
        })
        .then(function () { seletor.disabled = false; });
    });
    etapa.appendChild(rotulo);
    etapa.appendChild(seletor);
    etapa.appendChild(salvo);

    [id, grupo, contato, etapa, campoRecado(p)].forEach(function (c) { li.appendChild(c); });
    return li;
  }

  // Recado que o cliente vê em /pedidos/. Um por pedido: salvar troca o anterior; em branco apaga.
  function campoRecado(p) {
    var caixa = el('div', 'adm-recado');
    var rotulo = el('label', '', 'Recado para o cliente');
    var texto = el('textarea');
    texto.id = 'recado-' + p.numero;
    rotulo.htmlFor = texto.id;
    texto.rows = 2;
    texto.maxLength = 500;
    texto.placeholder = 'Ex.: Mandamos o link de teste no seu WhatsApp.';
    texto.value = p.recado || '';
    var botao = el('button', 'btn btn-vidro btn-sm');
    botao.type = 'button';
    botao.setAttribute('data-salvar-recado', '');
    botao.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Salvar recado';
    var aviso = el('span', 'adm-salvo');
    aviso.setAttribute('data-salvo-recado', '');
    aviso.setAttribute('aria-live', 'polite');
    texto.addEventListener('input', function () { aviso.textContent = texto.value.trim() === (p.recado || '') ? '' : 'Não salvo'; aviso.className = 'adm-salvo'; });
    botao.addEventListener('click', function () {
      botao.disabled = true;
      aviso.className = 'adm-salvo';
      aviso.textContent = 'Salvando…';
      Conta.chamar('mudarRecado', { numero: p.numero, recado: texto.value })
        .then(function (novo) {
          p.recado = novo.recado;
          p.atualizadoEm = novo.atualizadoEm;
          texto.value = novo.recado;
          aviso.textContent = novo.recado ? 'Salvo ✓' : 'Recado apagado ✓';
        })
        .catch(function (err) {
          // o texto digitado fica no campo para tentar de novo
          aviso.className = 'adm-salvo erro';
          aviso.textContent = err.mensagem || 'Não salvou. Tente de novo.';
          if (err.precisaEntrar) pedeLogin(err.mensagem);
        })
        .then(function () { botao.disabled = false; });
    });
    var linhaBotao = el('div', 'adm-recado-acoes');
    linhaBotao.appendChild(botao);
    linhaBotao.appendChild(aviso);
    caixa.appendChild(rotulo);
    caixa.appendChild(texto);
    caixa.appendChild(linhaBotao);
    return caixa;
  }

  function desenhaLista() {
    var termo = normaliza(busca.value.trim());
    var digitos = termo.replace(/\D/g, '');
    var visiveis = pedidos.filter(function (p) {
      if (filtro !== 'Todos' && p.etapa !== filtro) return false;
      if (!termo) return true;
      var texto = normaliza([p.numero, p.grupo, p.endereco, p.email, p.nome, p.esporte].join(' '));
      return texto.indexOf(termo) >= 0 || (digitos.length >= 3 && String(p.celular).indexOf(digitos) >= 0);
    });
    lista.textContent = '';
    visiveis.forEach(function (p) { lista.appendChild(linha(p)); });
    $('[data-nenhum]').hidden = visiveis.length > 0;
  }

  function carrega() {
    mostra('carregando');
    Conta.chamar('todosPedidos').then(function (dados) {
      pedidos = dados;
      desenhaFiltros();
      desenhaLista();
      mostra('lista');
    }).catch(function (err) {
      if (err.precisaEntrar) { pedeLogin(err.mensagem); return; }
      if (err.codigo === 'admin') { mostra('negado'); return; }
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

  busca.addEventListener('input', desenhaLista);
  $('[data-atualizar]').addEventListener('click', carrega);
  $('[data-tentar]').addEventListener('click', carrega);
  $('[data-sair]').addEventListener('click', function () { Conta.sair(); pedeLogin(); });

  if (!Conta.configurada()) { mostra('desligado'); return; }
  var sessao = Conta.atual();
  if (sessao) { mostraQuem(sessao); carrega(); } else pedeLogin();
})();
