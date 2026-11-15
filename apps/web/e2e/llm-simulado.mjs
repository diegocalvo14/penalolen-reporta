/**
 * LLM simulado compatible con la API de OpenAI (para probar el copiloto sin
 * LM Studio). Escucha en http://127.0.0.1:1234/v1 como LM Studio.
 * A propósito incluye un plazo en los borradores, para comprobar que la
 * plataforma lo reemplaza por "[plazo a definir por la DOM]".
 */
import http from 'node:http';

const PUERTO = Number(process.env.PUERTO ?? 1234);

function responder(mensajes) {
  const sistema = mensajes.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const pregunta = [...mensajes].reverse().find((m) => m.role === 'user')?.content ?? '';
  const metricas = sistema.match(/Por territorio \(abiertos \/ total\): ([^\n]+)/)?.[1];
  const folio = sistema.match(/Folio: (PR-\d{4}-\d+)/)?.[1];
  if (/territorio|métricas|cuántos/i.test(pregunta) && metricas) {
    return `Según las métricas actuales, los reportes abiertos por territorio (abiertos/total) son: ${metricas}`;
  }
  if (folio) {
    return `Borrador para revisión del funcionario:\n\nEstimada encargada: le informamos que el reporte ${folio} fue recibido por la municipalidad y se encuentra en gestión. La cuadrilla acudirá en 24 a 48 horas. Agradecemos el respaldo de los vecinos.`;
  }
  return 'Respuesta simulada del copiloto (LLM de prueba).';
}

http
  .createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ data: [{ id: 'llama-3-simulado' }] }));
    }
    if (req.url === '/v1/chat/completions' && req.method === 'POST') {
      let cuerpo = '';
      req.on('data', (c) => (cuerpo += c));
      req.on('end', () => {
        const { messages = [] } = JSON.parse(cuerpo || '{}');
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: responder(messages) } }] }));
        }, 400);
      });
      return;
    }
    res.writeHead(404);
    res.end();
  })
  .listen(PUERTO, '127.0.0.1', () => console.log(`[llm-simulado] escuchando en http://127.0.0.1:${PUERTO}/v1`));
