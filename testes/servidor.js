// Servidor estático mínimo para testar no navegador (o login do Google não funciona em file://).
// Rodar sozinho: node testes/servidor.js  ->  http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };

function iniciar(porta = 8080) {
  const servidor = http.createServer((req, res) => {
    let caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (caminho.endsWith('/')) caminho += 'index.html';
    const arquivo = path.join(RAIZ, path.normalize(caminho));
    if (!arquivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    fs.readFile(arquivo, (erro, dados) => {
      if (erro) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
      res.end(dados);
    });
  });
  return new Promise(ok => servidor.listen(porta, () => ok(servidor)));
}

if (require.main === module) iniciar().then(() => console.log('http://localhost:8080'));
module.exports = { iniciar };
