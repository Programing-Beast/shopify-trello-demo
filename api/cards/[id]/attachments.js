const Busboy = require('busboy');
const trello = require('../../../lib/trelloService');
const { authenticate } = require('../../../lib/auth');

function parseFile(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    let file = null;

    busboy.on('file', (fieldname, stream, info) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => {
        file = {
          buffer: Buffer.concat(chunks),
          originalname: info.filename,
          mimetype: info.mimeType,
        };
      });
    });

    busboy.on('finish', () => resolve(file));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await authenticate(req);
    if (!user.trelloToken) return res.status(400).json({ error: 'Trello not connected' });

    const file = await parseFile(req);
    if (!file) return res.status(400).json({ error: 'file is required' });
    const attachment = await trello.addAttachment(user.trelloToken, req.query.id, file);
    res.json(attachment);
  } catch (err) {
    const status = err.statusCode || err.response?.status || 500;
    res.status(status).json({ error: err.response?.data || err.message });
  }
};

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
