/* Roda apps-script/Codigo.gs no Node com SpreadsheetApp, UrlFetchApp etc. de mentira.
   Usado pelos testes do Apps Script e como "backend" no roteiro do navegador.
   O token falso tem o formato de um JWT; a "conferência na Google" só lê o meio dele. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CLIENT_ID_TESTE = 'cliente-teste';

function tokenFalso(dados) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = Object.assign({ aud: CLIENT_ID_TESTE, email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600 }, dados);
  return b64({ alg: 'RS256' }) + '.' + b64(corpo) + '.ass' + Math.random().toString(36).slice(2);
}

/* Como o Sheets de verdade: texto que parece número ou data vira número ou data,
   a não ser que a célula esteja formatada como texto puro ("@"). */
function comoSheets(v, formato) {
  if (typeof v !== 'string' || formato === '@') return v;
  if (/^-?\d+(\.\d+)?(e\d+)?$/i.test(v.trim())) return Number(v);
  const data = v.trim().match(/^(\d{1,2})\/(\d{1,2})(\/(\d{2,4}))?$/);
  if (data) return new Date(Number(data[4] || 2026), Number(data[2]) - 1, Number(data[1]));
  return v;
}

function abaFalsa() {
  const dados = [];
  const formatos = [];
  return {
    dados,
    appendRow(r) { dados.push(r.map(v => comoSheets(v))); },
    getDataRange() { return { getValues: () => dados.map(r => r.slice()) }; },
    getLastRow() { return dados.length; },
    getRange(linha, coluna) {
      return {
        getValue() { return (dados[linha - 1] || [])[coluna - 1]; },
        setValue(v) { dados[linha - 1][coluna - 1] = comoSheets(v, (formatos[linha - 1] || [])[coluna - 1]); return this; },
        setNumberFormat(fmt) { (formatos[linha - 1] = formatos[linha - 1] || [])[coluna - 1] = fmt; return this; },
        setNumberFormats(fs) { formatos[linha - 1] = fs[0].slice(); return this; },
        setValues(vs) {
          const f = formatos[linha - 1] || [];
          dados[linha - 1] = vs[0].map((v, i) => comoSheets(v, f[coluna - 1 + i]));
          return this;
        },
        setDataValidation() {},
      };
    },
    getMaxRows() { return 1000; },
    setFrozenRows() {},
  };
}

function criarScriptFalso(opcoes = {}) {
  const abas = {};
  const planilha = {
    getSheetByName: n => abas[n] || null,
    insertSheet: n => (abas[n] = abaFalsa()),
  };
  const validacao = { requireValueInList() { return validacao; }, setAllowInvalid() { return validacao; }, build() { return {}; } };
  const cache = new Map();
  const propriedades = { CLIENT_ID: CLIENT_ID_TESTE, ADMINS: opcoes.admins || 'admin@teste.com' };
  const contexto = {
    console,
    SpreadsheetApp: {
      openById(id) { if (id !== contexto.PLANILHA_ID) throw new Error('planilha errada: ' + id); return planilha; },
      newDataValidation: () => validacao,
      flush() {},
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => propriedades[k] || null }) },
    UrlFetchApp: {
      fetch(url) {
        const token = decodeURIComponent(String(url).split('id_token=')[1] || '');
        const partes = token.split('.');
        let info = null;
        try { if (partes.length === 3) info = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')); } catch (e) { info = null; }
        // a Google devolve email_verified como texto
        const corpo = info ? JSON.stringify(Object.assign({}, info, { email_verified: String(info.email_verified) })) : '{"error":"invalid_token"}';
        return { getResponseCode: () => (info ? 200 : 400), getContentText: () => corpo };
      },
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: texto => ({ texto, setMimeType() { return this; } }),
    },
  };
  vm.createContext(contexto);
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Codigo.gs'), 'utf8');
  vm.runInContext(codigo, contexto, { filename: 'Codigo.gs' });

  if (opcoes.linhas) {
    const aba = planilha.insertSheet(contexto.ABA);
    aba.appendRow(opcoes.cabecalho || Array.from(contexto.COLUNAS));
    opcoes.linhas.forEach(r => aba.appendRow(r));
  }

  return {
    contexto,
    chamar(acao, token, dados) {
      const saida = contexto.doPost({ postData: { contents: JSON.stringify({ acao, token, dados }) } });
      return JSON.parse(saida.texto);
    },
    linhas: () => (abas[contexto.ABA] ? abas[contexto.ABA].dados : []),
  };
}

module.exports = { criarScriptFalso, tokenFalso };
