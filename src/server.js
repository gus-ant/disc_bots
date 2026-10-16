import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  initStorage,
  getDashboardSummary,
  getDailyTrends,
  getProjectDistribution,
  getContentCategoryStats,
  getStudentsMetrics,
  getStudentDetails,
  getDailiesList,
  getProjectsList,
  getContents,
  getRankingsData
} from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Servir arquivos estáticos da pasta public
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Endpoint: Resumo Global (KPIs)
app.get('/api/metrics/summary', async (req, res) => {
  try {
    const summary = await getDashboardSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Tendência Temporal de Horas e Dailies
app.get('/api/metrics/trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const trends = await getDailyTrends(days);
    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Distribuição por Projeto
app.get('/api/metrics/projects', async (req, res) => {
  try {
    const projects = await getProjectDistribution();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Categorias de Conteúdo
app.get('/api/metrics/categories', async (req, res) => {
  try {
    const categories = await getContentCategoryStats();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Lista de Alunos / Bolsistas
app.get('/api/students', async (req, res) => {
  try {
    const students = await getStudentsMetrics();
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Detalhes de um Aluno Específico
app.get('/api/students/:id', async (req, res) => {
  try {
    const details = await getStudentDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ success: false, error: 'Aluno não encontrado' });
    }
    res.json({ success: true, data: details });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Dailies Registradas (com Filtros)
app.get('/api/dailies', async (req, res) => {
  try {
    const { project, userId, search, limit } = req.query;
    const dailies = await getDailiesList({
      project,
      userId,
      search,
      limit: parseInt(limit) || 100
    });
    res.json({ success: true, data: dailies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Lista de Projetos com Estatísticas
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await getProjectsList();
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Acervo de Conteúdos
app.get('/api/contents', async (req, res) => {
  try {
    const { userId, limit } = req.query;
    const contents = await getContents(userId || null, parseInt(limit) || 50);
    res.json({ success: true, data: contents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Rankings Globais
app.get('/api/rankings', async (req, res) => {
  try {
    const rankings = await getRankingsData();
    res.json({ success: true, data: rankings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rota padrão do SPA para qualquer página não API
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Iniciar Servidor
export async function startServer(port = PORT) {
  const server = app.listen(port, () => {
    console.log(`\n📊 Dashboard Web CIIA/DF rodando em: http://localhost:${port}`);
  });
  return server;
}

// Permitir execução direta com node src/server.js
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export default app;
