/* MemberStars: comportamento da landing page.
   Sem framework: IntersectionObserver para tudo que depende de rolagem (nunca "scroll" no window),
   requestAnimationFrame só para números e formas, e tudo desligado para quem pede menos movimento. */

// WhatsApp que recebe os pedidos do pop-up "Quero no meu time" (formato wa.me: 55 + DDD + número, só dígitos).
var WHATSAPP = '5531987310965';

// Endereços que já são de grupos de verdade: o pop-up avisa em vez de prometer o mesmo endereço.
var ENDERECOS_EM_USO = ['volei', 'voleimeme'];

/* Nome do grupo -> pedaço do endereço (memberstars.com/xxx): minúsculas, sem acento, só letras,
   números e hífen. "Vôlei de Terça!" vira "volei-de-terca". */
function enderecoDoGrupo(nome) {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function linkWhatsApp(grupo, esporte) {
  var texto = 'Olá! Quero o MemberStars no meu time.\n\n' +
    '*Grupo:* ' + grupo + '\n' +
    '*Esporte:* ' + esporte + '\n' +
    '*Endereço desejado:* memberstars.com/' + enderecoDoGrupo(grupo);
  return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto);
}

/* ---------------- Sorteio (função pura: testada em Node, ver testes/sorteio.test.js) ----------------
   Mesma ideia do app: primeiro espalha as mulheres (nenhum time fica com 2 a mais que outro), depois
   completa com os homens sempre no time com menos gente; empate vai para quem tem menos estrelas.
   Dentro de cada nível de estrela a ordem é embaralhada, então cada sorteio sai diferente. */
function sortearTimes(jogadores, nTimes, aleatorio) {
  aleatorio = aleatorio || Math.random;
  var embaralhados = jogadores.slice();
  for (var i = embaralhados.length - 1; i > 0; i--) {
    var j = Math.floor(aleatorio() * (i + 1));
    var t = embaralhados[i]; embaralhados[i] = embaralhados[j]; embaralhados[j] = t;
  }
  // ordenação estável: mais estrelas primeiro, e a ordem embaralhada desempata
  var porForca = function (a, b) { return b.estrelas - a.estrelas; };
  var mulheres = embaralhados.filter(function (p) { return p.sexo === 'F'; }).sort(porForca);
  var homens = embaralhados.filter(function (p) { return p.sexo !== 'F'; }).sort(porForca);

  var times = [];
  for (var k = 0; k < nTimes; k++) times.push({ jogadores: [], estrelas: 0, mulheres: 0 });

  function escolher(criterios) {
    var melhores = [];
    var melhorChave = null;
    times.forEach(function (time, idx) {
      var chave = criterios(time);
      var cmp = melhorChave === null ? -1 : compara(chave, melhorChave);
      if (cmp < 0) { melhorChave = chave; melhores = [idx]; }
      else if (cmp === 0) melhores.push(idx);
    });
    return times[melhores[Math.floor(aleatorio() * melhores.length)]];
  }
  function compara(a, b) {
    for (var i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
    return 0;
  }
  function coloca(time, p) { time.jogadores.push(p); time.estrelas += p.estrelas; if (p.sexo === 'F') time.mulheres++; }

  mulheres.forEach(function (p) { coloca(escolher(function (t) { return [t.mulheres, t.jogadores.length, t.estrelas]; }), p); });
  homens.forEach(function (p) { coloca(escolher(function (t) { return [t.jogadores.length, t.estrelas]; }), p); });
  return times;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { sortearTimes: sortearTimes, enderecoDoGrupo: enderecoDoGrupo, linkWhatsApp: linkWhatsApp };

/* ================================== Página ================================== */
if (typeof document !== 'undefined') (function () {
  var raiz = document.documentElement;
  var podeAnimar = raiz.classList.contains('anima');
  var ponteiroFino = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var suave = function (t) { return 1 - Math.pow(1 - t, 3); };

  function animarValor(duracao, aCada) {
    if (!podeAnimar) { aCada(1); return; }
    var inicio = null;
    function passo(agora) {
      if (inicio === null) inicio = agora;
      var t = Math.min(1, (agora - inicio) / duracao);
      aCada(suave(t));
      if (t < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  /* ---------- pop-up "Quero no meu time" -> WhatsApp ---------- */
  var pedido = $('#pedido'), form = $('[data-pedido]');
  var campoGrupo = $('#pedido-grupo'), campoOutro = $('#pedido-outro'), caixaOutro = $('[data-outro]');
  var slug = $('[data-slug]'), erroGrupo = $('[data-erro-grupo]'), erroEsporte = $('[data-erro-esporte]');
  var temDialog = pedido && typeof pedido.showModal === 'function';

  function esporteEscolhido() {
    var marcado = $('input[name="esporte"]:checked', form);
    if (!marcado) return '';
    return marcado.value === 'Outro' ? campoOutro.value.trim() : marcado.value;
  }
  function mostraErro(el, campo, msg) {
    el.textContent = msg || ''; el.hidden = !msg;
    if (campo) campo.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function atualizaEndereco() {
    var s = enderecoDoGrupo(campoGrupo.value);
    slug.textContent = s || 'seu-grupo';
    if (ENDERECOS_EM_USO.indexOf(s) >= 0) mostraErro(erroGrupo, null, 'Esse endereço já é de outro grupo. Tudo bem, a gente combina um parecido no WhatsApp.');
    else if (!erroGrupo.hidden && campoGrupo.getAttribute('aria-invalid') !== 'true') mostraErro(erroGrupo, null, '');
  }
  function abrePedido(esporte) {
    if (!temDialog) { window.open(linkWhatsApp('(nome do grupo)', esporte || '(esporte)'), '_blank', 'noopener'); return; }
    form.reset(); caixaOutro.hidden = true; slug.textContent = 'seu-grupo';
    mostraErro(erroGrupo, campoGrupo, ''); mostraErro(erroEsporte, null, '');
    if (esporte) { var op = $('input[name="esporte"][value="' + esporte + '"]', form); if (op) op.checked = true; }
    pedido.showModal();
    campoGrupo.focus();
  }

  $$('[data-contato]').forEach(function (a) {
    a.addEventListener('click', function (ev) { ev.preventDefault(); abrePedido(a.dataset.esporte); });
  });
  if (temDialog) {
    $('[data-fecha]', form).addEventListener('click', function () { pedido.close(); });
    // clicar no fundo escuro fora da caixa também fecha
    pedido.addEventListener('click', function (ev) { if (ev.target === pedido) pedido.close(); });
    campoGrupo.addEventListener('input', function () {
      if (campoGrupo.getAttribute('aria-invalid') === 'true' && enderecoDoGrupo(campoGrupo.value)) mostraErro(erroGrupo, campoGrupo, '');
      atualizaEndereco();
    });
    $$('input[name="esporte"]', form).forEach(function (r) {
      r.addEventListener('change', function () {
        caixaOutro.hidden = r.value !== 'Outro' || !r.checked;
        if (!caixaOutro.hidden) campoOutro.focus();
        mostraErro(erroEsporte, null, '');
      });
    });
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var grupo = campoGrupo.value.trim().replace(/\s+/g, ' ');
      var esporte = esporteEscolhido();
      var ok = true;
      if (!enderecoDoGrupo(grupo)) { mostraErro(erroGrupo, campoGrupo, 'Digite o nome do grupo (pelo menos uma letra ou número).'); ok = false; }
      if (!esporte) {
        var marcadoOutro = $('input[name="esporte"][value="Outro"]:checked', form);
        mostraErro(erroEsporte, marcadoOutro ? campoOutro : null, marcadoOutro ? 'Escreva qual é o esporte.' : 'Escolha o esporte do grupo.');
        ok = false;
      }
      if (!ok) { (enderecoDoGrupo(grupo) ? (esporte ? campoGrupo : (caixaOutro.hidden ? $('input[name="esporte"]', form) : campoOutro)) : campoGrupo).focus(); return; }
      window.open(linkWhatsApp(grupo, esporte), '_blank', 'noopener');
      pedido.close();
    });
  }

  /* ---------- topo ganha fundo depois que a pessoa sai do alto da página ---------- */
  var topo = $('#topo');
  var sentinela = document.createElement('div');
  sentinela.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none';
  document.body.prepend(sentinela);
  new IntersectionObserver(function (e) { topo.classList.toggle('rolou', !e[0].isIntersecting); }).observe(sentinela);

  /* ---------- menu do celular ---------- */
  var menuBtn = $('.menu-btn'), menu = $('#menu-movel');
  function fechaMenu() { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.innerHTML = '<i class="ph-bold ph-list"></i>'; }
  menuBtn.addEventListener('click', function () {
    var abrir = menu.hidden;
    menu.hidden = !abrir;
    menuBtn.setAttribute('aria-expanded', String(abrir));
    menuBtn.innerHTML = abrir ? '<i class="ph-bold ph-x"></i>' : '<i class="ph-bold ph-list"></i>';
    if (abrir) topo.classList.add('rolou');
  });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', fechaMenu); });

  /* ---------- números que contam até o valor ---------- */
  function contar(el) {
    if (el.dataset.contou) return;
    el.dataset.contou = '1';
    var alvo = Number(el.dataset.conta);
    animarValor(1400, function (p) { el.textContent = Math.round(alvo * p); });
  }

  /* ---------- vídeos: só carregam quando aparecem, pausam quando saem da tela ---------- */
  function garantirFonte(v) { if (!v.getAttribute('src') && v.dataset.src) { v.src = v.dataset.src; v.load(); } }
  function tocar(v) { if (!podeAnimar) return; garantirFonte(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var obsVideo = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) { if (e.isIntersecting) tocar(e.target); else e.target.pause(); });
  }, { rootMargin: '120px' });
  $$('video[data-autoplay]').forEach(function (v) { obsVideo.observe(v); });

  /* ---------- celular do hero: troca de tela a cada poucos segundos ---------- */
  var telas = $$('.tela-video');
  var legendas = ['Campeões da semana', 'Check-in da rodada', 'Ranking da temporada'];
  var legenda = $('[data-legenda]');
  var atual = 0, timerTela = null, heroVisivel = true;
  function mostraTela(i) {
    telas.forEach(function (v, k) { v.classList.toggle('ativa', k === i); if (k !== i) v.pause(); });
    tocar(telas[i]);
    legenda.textContent = legendas[i];
    // reinicia a animação da legenda
    legenda.style.animation = 'none'; void legenda.offsetWidth; legenda.style.animation = '';
  }
  function cicloTelas() {
    clearInterval(timerTela);
    if (!podeAnimar) return;
    timerTela = setInterval(function () {
      if (!heroVisivel || document.hidden) return;
      atual = (atual + 1) % telas.length;
      garantirFonte(telas[(atual + 1) % telas.length]); // já adianta a próxima
      mostraTela(atual);
    }, 5200);
  }
  if (telas.length) {
    new IntersectionObserver(function (e) {
      heroVisivel = e[0].isIntersecting;
      if (heroVisivel) tocar(telas[atual]); else telas[atual].pause();
    }).observe($('.celular'));
    mostraTela(0);
    cicloTelas();
  }
  // contadores das fichas do hero entram junto com o palco
  setTimeout(function () { $$('.hero [data-conta]').forEach(contar); }, podeAnimar ? 900 : 0);

  /* ---------- profundidade: palco do hero acompanha o mouse ---------- */
  var palco = $('[data-parallax]');
  if (palco && podeAnimar && ponteiroFino) {
    var camadas = $$('[data-camada]', palco), quadroParallax = null, mx = 0, my = 0;
    palco.addEventListener('pointermove', function (ev) {
      var r = palco.getBoundingClientRect();
      mx = (ev.clientX - r.left) / r.width - 0.5;
      my = (ev.clientY - r.top) / r.height - 0.5;
      if (!quadroParallax) quadroParallax = requestAnimationFrame(aplicaParallax);
    });
    palco.addEventListener('pointerleave', function () { mx = 0; my = 0; if (!quadroParallax) quadroParallax = requestAnimationFrame(aplicaParallax); });
    function aplicaParallax() {
      quadroParallax = null;
      camadas.forEach(function (c) {
        var k = Number(c.dataset.camada) * 14;
        var extra = c.classList.contains('celular') ? ' rotateY(' + (mx * 14) + 'deg) rotateX(' + (-my * 10) + 'deg)' : '';
        c.style.transform = 'perspective(900px) translate3d(' + (mx * k) + 'px,' + (my * k) + 'px,0)' + extra;
      });
    }
  }

  /* ---------- radar do perfil ---------- */
  var RADAR = [['Presença', 92], ['Vitórias', 78], ['Títulos', 100], ['Sequência', 75], ['Parcerias', 64]];
  var R = 80;
  function pontoRadar(i, v) {
    var ang = -Math.PI / 2 + i * (2 * Math.PI / RADAR.length);
    return [Math.cos(ang) * R * v / 100, Math.sin(ang) * R * v / 100];
  }
  (function montaRadar() {
    var ns = 'http://www.w3.org/2000/svg';
    var grade = $('[data-radar-grade]'), rot = $('[data-radar-rotulos]'), pts = $('[data-radar-pontos]');
    if (!grade) return;
    [25, 50, 75, 100].forEach(function (nivel) {
      var pg = document.createElementNS(ns, 'polygon');
      pg.setAttribute('points', RADAR.map(function (_, i) { return pontoRadar(i, nivel).join(','); }).join(' '));
      grade.appendChild(pg);
    });
    RADAR.forEach(function (d, i) {
      var ln = document.createElementNS(ns, 'line'), fim = pontoRadar(i, 100);
      ln.setAttribute('x1', 0); ln.setAttribute('y1', 0); ln.setAttribute('x2', fim[0]); ln.setAttribute('y2', fim[1]);
      grade.appendChild(ln);
      var p = pontoRadar(i, 118), tx = document.createElementNS(ns, 'text');
      tx.setAttribute('x', p[0]); tx.setAttribute('y', p[1]);
      tx.setAttribute('text-anchor', Math.abs(p[0]) < 8 ? 'middle' : (p[0] > 0 ? 'start' : 'end'));
      tx.setAttribute('dominant-baseline', 'middle');
      tx.innerHTML = d[0] + ' <tspan class="v">' + d[1] + '</tspan>';
      rot.appendChild(tx);
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', 'r-ponto'); c.setAttribute('r', 4.5); c.setAttribute('cx', 0); c.setAttribute('cy', 0);
      pts.appendChild(c);
    });
  })();
  function animaRadar() {
    var forma = $('[data-radar-forma]'), circulos = $$('[data-radar-pontos] circle');
    animarValor(1300, function (p) {
      var coords = RADAR.map(function (d, i) { return pontoRadar(i, d[1] * p); });
      forma.setAttribute('points', coords.map(function (c) { return c.join(','); }).join(' '));
      circulos.forEach(function (c, i) { c.setAttribute('cx', coords[i][0]); c.setAttribute('cy', coords[i][1]); });
    });
  }

  /* ---------- linha: aproveitamento por mês (série única, com mira e dica ao passar) ---------- */
  var MESES = ['Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out'];
  var APROV = [50, 58, 55, 70, 64, 80, 72, 67];
  var L = { x0: 34, x1: 508, y0: 186, y1: 12 };
  var xDe = function (i) { return L.x0 + i * (L.x1 - L.x0) / (MESES.length - 1); };
  var yDe = function (v) { return L.y0 - (v / 100) * (L.y0 - L.y1); };
  (function montaLinha() {
    var ns = 'http://www.w3.org/2000/svg';
    var grade = $('[data-linha-grade]'), pts = $('[data-linha-pontos]'), path = $('[data-linha-path]');
    if (!grade) return;
    [0, 25, 50, 75, 100].forEach(function (v) {
      var ln = document.createElementNS(ns, 'line');
      ln.setAttribute('x1', L.x0); ln.setAttribute('x2', L.x1); ln.setAttribute('y1', yDe(v)); ln.setAttribute('y2', yDe(v));
      grade.appendChild(ln);
      var tx = document.createElementNS(ns, 'text');
      tx.setAttribute('x', L.x0 - 8); tx.setAttribute('y', yDe(v) + 4); tx.setAttribute('text-anchor', 'end'); tx.textContent = v;
      grade.appendChild(tx);
    });
    MESES.forEach(function (m, i) {
      var tx = document.createElementNS(ns, 'text');
      tx.setAttribute('x', xDe(i)); tx.setAttribute('y', 210); tx.setAttribute('text-anchor', 'middle'); tx.textContent = m;
      grade.appendChild(tx);
    });
    path.setAttribute('d', APROV.map(function (v, i) { return (i ? 'L' : 'M') + xDe(i) + ' ' + yDe(v); }).join(' '));
    APROV.forEach(function (v, i) {
      var c = document.createElementNS(ns, 'circle');
      c.setAttribute('class', 'g-pt'); c.setAttribute('cx', xDe(i)); c.setAttribute('cy', yDe(v)); c.setAttribute('r', 4.5);
      pts.appendChild(c);
    });
    // faixas invisíveis mais largas que o ponto: fáceis de acertar com o mouse ou o dedo
    var largura = (L.x1 - L.x0) / (MESES.length - 1);
    APROV.forEach(function (v, i) {
      var alvo = document.createElementNS(ns, 'rect');
      alvo.setAttribute('class', 'g-alvo');
      alvo.setAttribute('x', xDe(i) - largura / 2); alvo.setAttribute('width', largura);
      alvo.setAttribute('y', 0); alvo.setAttribute('height', 200);
      alvo.addEventListener('pointerenter', function () { mostraDica(i); });
      pts.appendChild(alvo);
    });
    var area = $('.g-area'), dica = $('[data-dica]'), mira = $('[data-linha-mira]'), svg = area.querySelector('svg');
    function mostraDica(i) {
      var esc = svg.getBoundingClientRect().width / 520;
      mira.setAttribute('x1', xDe(i)); mira.setAttribute('x2', xDe(i)); mira.style.opacity = 1;
      $$('.g-pt', pts).forEach(function (c, k) { c.setAttribute('r', k === i ? 7 : 4.5); });
      dica.hidden = false;
      dica.innerHTML = MESES[i] + ': <b>' + APROV[i] + '%</b>';
      dica.style.left = (xDe(i) * esc) + 'px';
      dica.style.top = (yDe(APROV[i]) * esc) + 'px';
    }
    area.addEventListener('pointerleave', function () {
      dica.hidden = true; mira.style.opacity = 0;
      $$('.g-pt', pts).forEach(function (c) { c.setAttribute('r', 4.5); });
    });
  })();
  function animaLinha() {
    var path = $('[data-linha-path]'); if (!path || !podeAnimar) return;
    var tam = path.getTotalLength();
    path.style.strokeDasharray = tam; path.style.strokeDashoffset = tam;
    path.getBoundingClientRect();
    path.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.16, 1, 0.3, 1)';
    path.style.strokeDashoffset = 0;
    $$('.g-pt').forEach(function (c, i) {
      if (c.animate) c.animate([{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'scale(1)' }],
        { duration: 400, delay: 300 + i * 160, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
    });
  }

  /* ---------- barras: aproveitamento dos 5 melhores (eixo único 0 a 100%) ---------- */
  var TOP5 = [['Karen Souza', 67, true], ['Léo Martins', 61], ['Hugo Alves', 50], ['Nando Freitas', 50], ['Ana Lima', 47]];
  (function montaBarras() {
    var lista = $('[data-barras]'); if (!lista) return;
    lista.innerHTML = TOP5.map(function (d, i) {
      return '<li class="barra' + (d[2] ? ' voce' : '') + '" style="--v:' + d[1] + '%" title="' + d[0] + ': ' + d[1] + '% de aproveitamento">' +
        '<span class="pos">' + (i + 1) + 'º</span><span class="nome">' + d[0] + '</span>' +
        '<span class="trilho"><span class="enche" style="transition-delay:' + (i * 110) + 'ms"></span><span class="valor">' + d[1] + '%</span></span></li>';
    }).join('');
  })();

  function animaMedidores(ctx) {
    $$('[data-medidor]', ctx).forEach(function (m) {
      var arco = $('.m-arco', m), C = 2 * Math.PI * 32;
      arco.style.strokeDashoffset = C * (1 - Number(m.dataset.medidor) / 100);
    });
  }

  /* ---------- sorteio interativo ---------- */
  var ELENCO = [
    { nome: 'Ana Lima', estrelas: 5, sexo: 'F', cor: '#ff7eb6' },
    { nome: 'Bruno Costa', estrelas: 4, sexo: 'M', cor: '#4d7cff' },
    { nome: 'Carla Dias', estrelas: 3, sexo: 'F', cor: '#c084fc' },
    { nome: 'Diego Rocha', estrelas: 4, sexo: 'M', cor: '#00c2a8' },
    { nome: 'Elisa Prado', estrelas: 4, sexo: 'F', cor: '#ff9f43' },
    { nome: 'Felipe Nunes', estrelas: 3, sexo: 'M', cor: '#3ddc84' },
    { nome: 'Gabi Torres', estrelas: 5, sexo: 'F', cor: '#e0664f' },
    { nome: 'Hugo Alves', estrelas: 3, sexo: 'M', cor: '#5ec8ff' },
    { nome: 'Iara Melo', estrelas: 4, sexo: 'F', cor: '#c084fc' },
    { nome: 'João Pires', estrelas: 4, sexo: 'M', cor: '#f6c344' },
    { nome: 'Karen Souza', estrelas: 4, sexo: 'F', cor: '#ff6b81' },
    { nome: 'Léo Martins', estrelas: 5, sexo: 'M', cor: '#2dd4bf' }
  ];
  var CORES_TIME = ['#f5c542', '#7fa6ff', '#3ddc84', '#ff8a3d'];
  var areaTimes = $('[data-times-area]'), placar = $('[data-placar]'), btnSortear = $('[data-sortear]');
  var nTimes = 3, chips = {}, jaSorteou = false;
  ELENCO.forEach(function (p) {
    var el = document.createElement('div');
    el.className = 'jog';
    var ini = p.nome.split(' ').map(function (x) { return x[0]; }).join('').slice(0, 2);
    el.innerHTML = '<span class="jog-ini" style="--cor:' + p.cor + '">' + ini + '</span><span class="jog-nome">' + p.nome.split(' ')[0] + '</span>' +
      (p.sexo === 'F' ? '<span class="jog-f" aria-label="mulher">♀</span>' : '') + '<span class="jog-est" aria-label="' + p.estrelas + ' estrelas">' + p.estrelas + '★</span>';
    chips[p.nome] = el;
  });

  function sortear() {
    if (!areaTimes) return;
    var times = sortearTimes(ELENCO, nTimes);
    // FLIP: guarda onde cada jogador estava, troca de time, e anima do lugar antigo para o novo
    var antes = {};
    if (jaSorteou && podeAnimar) Object.keys(chips).forEach(function (n) { antes[n] = chips[n].getBoundingClientRect(); });
    areaTimes.style.setProperty('--n', nTimes);
    areaTimes.innerHTML = '';
    times.forEach(function (t, i) {
      var col = document.createElement('div');
      col.className = 'time';
      col.style.setProperty('--cor-time', CORES_TIME[i]);
      col.setAttribute('role', 'group');
      col.setAttribute('aria-label', 'Time ' + (i + 1) + ', ' + t.estrelas + ' estrelas');
      col.innerHTML = '<div class="time-cab"><b>TIME ' + (i + 1) + '</b><span>' + t.estrelas + '★</span></div>';
      var lista = document.createElement('div');
      lista.className = 'time-lista';
      t.jogadores.forEach(function (p) { lista.appendChild(chips[p.nome]); });
      col.appendChild(lista);
      areaTimes.appendChild(col);
    });
    var estrelas = times.map(function (t) { return t.estrelas; });
    var dif = Math.max.apply(null, estrelas) - Math.min.apply(null, estrelas);
    placar.textContent = dif === 0 ? 'Times empatados em estrelas. Bom jogo!' : 'Diferença entre os times: ' + dif + (dif === 1 ? ' estrela.' : ' estrelas.');

    if (!podeAnimar) { jaSorteou = true; return; }
    var ordem = 0;
    times.forEach(function (t) {
      t.jogadores.forEach(function (p, k) {
        var el = chips[p.nome], depois = el.getBoundingClientRect(), a = antes[p.nome];
        var de = a ? 'translate(' + (a.left - depois.left) + 'px,' + (a.top - depois.top) + 'px)' : 'translateY(-30px) scale(.6)';
        el.animate([{ transform: de, opacity: a ? 1 : 0 }, { transform: 'none', opacity: 1 }],
          { duration: 650, delay: (ordem++) * 35, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)', fill: 'backwards' });
      });
    });
    jaSorteou = true;
  }
  if (btnSortear) {
    btnSortear.addEventListener('click', function () {
      btnSortear.classList.remove('rolando'); void btnSortear.offsetWidth; btnSortear.classList.add('rolando');
      sortear();
    });
    $$('[data-times]').forEach(function (b) {
      b.addEventListener('click', function () {
        nTimes = Number(b.dataset.times);
        $$('[data-times]').forEach(function (o) { o.setAttribute('aria-checked', String(o === b)); });
        sortear();
      });
    });
  }

  /* ---------- holofote + inclinação nas células do bento ---------- */
  if (ponteiroFino) $$('[data-holofote]').forEach(function (cel) {
    cel.addEventListener('pointermove', function (ev) {
      var r = cel.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      cel.style.setProperty('--mx', (x * 100) + '%'); cel.style.setProperty('--my', (y * 100) + '%');
      if (podeAnimar && cel.classList.contains('visivel')) cel.style.transform = 'perspective(1000px) rotateX(' + ((0.5 - y) * 5) + 'deg) rotateY(' + ((x - 0.5) * 6) + 'deg)';
    });
    cel.addEventListener('pointerleave', function () { cel.style.transform = ''; });
  });

  /* ---------- quem entra na tela, aparece (uma vez só) ---------- */
  var obsSurge = new IntersectionObserver(function (entradas) {
    entradas.forEach(function (e) {
      if (!e.isIntersecting) return;
      var el = e.target;
      el.classList.add('visivel');
      obsSurge.unobserve(el);
      $$('[data-conta]', el).forEach(contar);
      if (el.hasAttribute('data-hud')) { animaMedidores(el); animaRadar(); animaLinha(); }
      if (el.hasAttribute('data-quadra') && !jaSorteou) sortear();
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });
  $$('.surge, [data-jogadas]').forEach(function (el) { obsSurge.observe(el); });

  // garante times na quadra mesmo se o observador demorar (ex.: link direto para #sorteio)
  if (!podeAnimar) sortear();
})();
