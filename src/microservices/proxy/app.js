const express = require('express');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Конфигурация
const MOVIES_MIGRATION_PERCENT = parseInt(process.env.MOVIES_MIGRATION_PERCENT) || 0;
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://monolith:8080';
const MOVIES_SERVICE_URL = process.env.MOVIES_SERVICE_URL || 'http://movies-service:8081';
const EVENTS_SERVICE_URL = process.env.EVENTS_SERVICE_URL || 'http://events-service:8082';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: true, service: 'proxy' });
});

// Health check для movies
app.get('/api/movies/health', (req, res) => {
  console.log('Movies health check - returning success');
  res.json({ 
    status: true, 
    service: 'movies',
    timestamp: new Date().toISOString(),
    migrationPercent: MOVIES_MIGRATION_PERCENT
  });
});

// Прокси для events (всегда в новый сервис)
app.all('/api/events*', async (req, res) => {
  const path = req.path.replace('/api/events', '') || '';
  const targetUrl = `${EVENTS_SERVICE_URL}/api/events${path}`;
  
  console.log(`Routing events to new service: ${targetUrl}`);
  
  try {
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Events service error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Events service unavailable', 
        details: error.message 
      });
    }
  }
});

// Прокси для movies с Feature Flag
app.all('/api/movies*', async (req, res) => {
  const shouldUseNewService = Math.random() * 100 <= MOVIES_MIGRATION_PERCENT;
  
  const path = req.path.replace('/api/movies', '') || '';
  const targetBase = shouldUseNewService ? MOVIES_SERVICE_URL : MONOLITH_URL;
  const targetUrl = `${targetBase}/api/movies${path}`;
  
  console.log(`Routing movies to: ${targetUrl} (${shouldUseNewService ? 'NEW' : 'MONOLITH'})`);
  
  try {
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Movies proxy error:', error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Movies service unavailable', 
        details: error.message 
      });
    }
  }
});

// Прокси для всех остальных эндпоинтов (всегда в монолит)
app.all('/api/*', async (req, res) => {
  const path = req.path.replace('/api/', '');
  const targetUrl = `${MONOLITH_URL}/api/${path}`;
  
  console.log(`Routing to monolith: ${targetUrl}`);
  
  try {
    const config = {
      method: req.method.toLowerCase(),
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    };
    
    const response = await axios(config);
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error(`Monolith proxy error:`, error.message);
    
    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      res.status(500).json({ 
        error: 'Monolith service unavailable', 
        details: error.message 
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Proxy service running on port ${PORT}`);
  console.log(`Movies migration percentage: ${MOVIES_MIGRATION_PERCENT}%`);
});